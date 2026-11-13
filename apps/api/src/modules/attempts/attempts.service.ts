import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  HttpException,
} from '@nestjs/common';
import { ExamAttempt, ExamQuestion, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  TX_OPTIONS,
  Tx,
  lockAttempt,
  lockStart,
  shareAttempt,
} from '../../common/db/locks';
import { fail } from '../../common/errors/app-error';
import { AttemptLifecycleService } from '../grading/attempt-lifecycle.service';
import { GradingService } from '../grading/grading.service';
import {
  Decimal,
  QuestionType,
  parseAnswerPayload,
  parseOptionsSnapshot,
  resolveType,
  snapshotOf,
} from '../grading/grading-engine';
import {
  orderQuestionsForAttempt,
  toStudentQuestion,
} from '../grading/question-view';
import {
  canStudentSeeResults,
  maskAttemptForStudent,
} from '../grading/result-visibility';
import { StartAttemptDto } from './dto/start-attempt.dto';
import {
  ESSAY_TEXT_MAX,
  SHORT_TEXT_MAX,
  SaveAnswerDto,
} from './dto/save-answer.dto';

const attemptNotFound = () =>
  fail(404, 'ATTEMPT_NOT_FOUND', 'Không tìm thấy bài làm');
const notAttemptOwner = () =>
  fail(403, 'NOT_ATTEMPT_OWNER', 'Bạn không có quyền với bài làm này');
const forbidden = () =>
  fail(403, 'FORBIDDEN', 'Bạn không có quyền thực hiện thao tác này');
const attemptNotSubmitted = () =>
  fail(400, 'ATTEMPT_NOT_SUBMITTED', 'Bài làm chưa được nộp');

type Db = PrismaService | Tx;

/** The exam fields the in-progress view is built from. */
type ExamForView = {
  title: string;
  instructions: string | null;
  durationSeconds: number;
  allowFileSubmission: boolean;
  shuffleOptions: boolean;
  questions: ExamQuestion[];
};

type AssignmentCandidate = {
  id: string;
  status: string;
  dueAt: Date | null;
  _count: { targets: number };
  targets: { id: string }[];
};

/** The attempt fields every result summary carries. */
type SummaryAttempt = Pick<
  ExamAttempt,
  | 'id'
  | 'examId'
  | 'assignmentId'
  | 'status'
  | 'startedAt'
  | 'expiresAt'
  | 'submittedAt'
  | 'score'
  | 'feedback'
  | 'manualScoreOverride'
> & {
  exam: {
    title: string;
    showResultImmediately: boolean;
    resultsReleased: boolean;
  };
  assignment: { hideResults: boolean } | null;
};

const SUMMARY_INCLUDE = {
  exam: {
    select: {
      title: true,
      ownerId: true,
      showResultImmediately: true,
      resultsReleased: true,
    },
  },
  assignment: { select: { hideResults: true } },
} satisfies Prisma.ExamAttemptInclude;

@Injectable()
export class AttemptsService {
  private readonly logger = new Logger(AttemptsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly lifecycle: AttemptLifecycleService,
    private readonly grading: GradingService,
  ) {}

  // ---------------------------------------------------------------------
  // Start (design 5.1)
  // ---------------------------------------------------------------------

  async start(studentId: string, dto: StartAttemptDto) {
    // Set when this request auto-submits the student's expired attempt.
    const expired: { id: string | null } = { id: null };

    let outcome: { created: boolean; attempt: unknown };
    try {
      outcome = await this.prisma.$transaction(async (tx) => {
        // 1. Everything below is serialised per student and exam.
        await lockStart(tx, studentId, dto.examId);
        const now = new Date();

        // 2.
        const exam = await tx.exam.findUnique({
          where: { id: dto.examId },
          include: { questions: true },
        });
        if (!exam) throw fail(404, 'EXAM_NOT_FOUND', 'Không tìm thấy đề thi');

        // 3. Resume first. No other check runs for a running attempt, so a
        // closed assignment, a passed deadline or a changed access code
        // never locks a student out of an attempt they already started.
        const inProgress = await tx.examAttempt.findFirst({
          where: { examId: exam.id, studentId, status: 'IN_PROGRESS' },
        });
        if (inProgress) {
          if (now <= inProgress.expiresAt) {
            return {
              created: false,
              attempt: await this.inProgressView(tx, inProgress, exam),
            };
          }
          await lockAttempt(tx, inProgress.id);
          const current = await tx.examAttempt.findUnique({
            where: { id: inProgress.id },
          });
          if (current && current.status === 'IN_PROGRESS') {
            await this.lifecycle.finalize(tx, current, now);
            expired.id = current.id;
          }
        }

        // 4. ARCHIVED lands here too.
        if (exam.status !== 'PUBLISHED') {
          throw fail(400, 'EXAM_NOT_PUBLISHED', 'Đề thi chưa được xuất bản');
        }

        // 5.
        const assignmentId = await this.resolveAssignment(
          tx,
          exam.id,
          studentId,
          dto.assignmentId,
          now,
        );

        // 6.
        if (exam.availableFrom && now < exam.availableFrom) {
          throw fail(
            403,
            'EXAM_NOT_YET_AVAILABLE',
            'Chưa đến thời gian làm bài',
          );
        }
        if (exam.availableUntil && now > exam.availableUntil) {
          throw fail(403, 'EXAM_EXPIRED', 'Đã hết thời gian làm bài');
        }

        // 7. Exact, case-sensitive.
        if (exam.accessCode && dto.accessCode !== exam.accessCode) {
          throw fail(403, 'INVALID_ACCESS_CODE', 'Mã truy cập không đúng');
        }

        // 8. Counted under the advisory lock, so two requests cannot both
        // pass. maxAttempts is per exam, across assignments.
        const used = await tx.examAttempt.count({
          where: { examId: exam.id, studentId },
        });
        if (used >= exam.maxAttempts) {
          throw fail(
            403,
            'MAX_ATTEMPTS_REACHED',
            'Bạn đã hết số lần làm bài cho đề thi này',
          );
        }

        // 9. expiresAt is not shortened by the assignment deadline (D6).
        const created = await tx.examAttempt.create({
          data: {
            examId: exam.id,
            studentId,
            assignmentId,
            startedAt: now,
            expiresAt: new Date(now.getTime() + exam.durationSeconds * 1000),
            ...(exam.shuffleQuestions && {
              questionOrder: this.shuffle(
                [...exam.questions]
                  .sort((a, b) => a.position - b.position)
                  .map((q) => q.id),
              ),
            }),
          },
        });
        return {
          created: true,
          attempt: await this.inProgressView(tx, created, exam),
        };
      }, TX_OPTIONS);
    } catch (error) {
      // The refusal rolled back the auto-submit of the expired attempt done
      // in step 3. Submit it on its own so it does not stay IN_PROGRESS.
      if (expired.id) {
        await this.lifecycle
          .submitIfExpired(expired.id)
          .catch((e: unknown) =>
            this.logger.error(`submitIfExpired failed: ${String(e)}`),
          );
      }
      throw error;
    }

    if (expired.id) await this.lifecycle.notifySubmitted(expired.id);
    return outcome;
  }

  /**
   * Step 5 of start. Candidates are the assignments of this exam in
   * non-archived classrooms where the student is a member.
   */
  private async resolveAssignment(
    tx: Tx,
    examId: string,
    studentId: string,
    requestedId: string | undefined,
    now: Date,
  ): Promise<string> {
    const candidates: AssignmentCandidate[] = await tx.assignment.findMany({
      where: {
        examId,
        classroom: {
          archivedAt: null,
          members: { some: { userId: studentId } },
        },
      },
      orderBy: [
        { dueAt: { sort: 'asc', nulls: 'last' } },
        { assignedAt: 'asc' },
      ],
      select: {
        id: true,
        status: true,
        dueAt: true,
        _count: { select: { targets: true } },
        targets: { where: { studentId }, select: { id: true } },
      },
    });

    const notAssigned = () =>
      fail(403, 'NOT_ASSIGNED', 'Bạn không được giao đề thi này');

    if (requestedId) {
      const requested = candidates.find((c) => c.id === requestedId);
      if (!requested) throw notAssigned();
      const refusal = this.assignmentRefusal(requested, now);
      if (refusal) throw refusal;
      return requested.id;
    }

    if (candidates.length === 0) throw notAssigned();
    let firstRefusal: HttpException | null = null;
    for (const candidate of candidates) {
      const refusal = this.assignmentRefusal(candidate, now);
      if (!refusal) return candidate.id;
      firstRefusal ??= refusal;
    }
    throw firstRefusal!;
  }

  private assignmentRefusal(
    assignment: AssignmentCandidate,
    now: Date,
  ): HttpException | null {
    if (assignment._count.targets > 0 && assignment.targets.length === 0) {
      return fail(403, 'NOT_TARGETED', 'Bài tập này không được giao cho bạn');
    }
    if (assignment.status !== 'ACTIVE') {
      return fail(403, 'ASSIGNMENT_CLOSED', 'Bài tập đã đóng');
    }
    if (assignment.dueAt && now >= assignment.dueAt) {
      return fail(403, 'DEADLINE_PASSED', 'Đã quá hạn nộp bài');
    }
    return null;
  }

  /**
   * The body of start and of GET /attempts/:id while IN_PROGRESS. Questions
   * go through toStudentQuestion, the only student serializer, and are
   * already in display order.
   */
  private async inProgressView(
    db: Db,
    attempt: ExamAttempt,
    exam: ExamForView,
  ) {
    const answers = await db.answer.findMany({
      where: { attemptId: attempt.id },
      select: { examQuestionId: true, answerPayload: true },
    });
    return {
      id: attempt.id,
      examId: attempt.examId,
      status: attempt.status,
      startedAt: attempt.startedAt,
      expiresAt: attempt.expiresAt,
      serverTime: new Date(),
      exam: {
        title: exam.title,
        instructions: exam.instructions,
        durationSeconds: exam.durationSeconds,
        allowFileSubmission: exam.allowFileSubmission,
      },
      assignmentId: attempt.assignmentId,
      questions: orderQuestionsForAttempt(
        exam.questions,
        attempt.questionOrder,
      ).map((eq) => toStudentQuestion(eq, attempt.id, exam.shuffleOptions)),
      answers,
    };
  }

  // ---------------------------------------------------------------------
  // Save answer (design 5.2)
  // ---------------------------------------------------------------------

  async saveAnswer(attemptId: string, studentId: string, dto: SaveAnswerDto) {
    const result = await this.prisma.$transaction(async (tx) => {
      // FOR SHARE: saves run together, and each waits for, or is waited on
      // by, the FOR UPDATE in submit. A save either commits before grading
      // reads the answers or sees SUBMITTED here.
      const found = await shareAttempt(tx, attemptId);
      const attempt = found
        ? await tx.examAttempt.findUnique({ where: { id: attemptId } })
        : null;
      if (!attempt) throw attemptNotFound();
      if (attempt.studentId !== studentId) throw notAttemptOwner();
      if (attempt.status !== 'IN_PROGRESS') {
        throw fail(400, 'ATTEMPT_ALREADY_SUBMITTED', 'Bài làm đã được nộp');
      }

      const now = new Date();
      if (now > attempt.expiresAt) return { expired: true as const };

      const question = await tx.examQuestion.findFirst({
        where: { id: dto.examQuestionId, examId: attempt.examId },
      });
      if (!question) {
        throw fail(
          400,
          'INVALID_QUESTION',
          'Câu hỏi không thuộc đề thi của bài làm này',
        );
      }

      const answerPayload = this.buildAnswerPayload(question, dto);
      const saved = await tx.answer.upsert({
        where: {
          attemptId_examQuestionId: {
            attemptId,
            examQuestionId: question.id,
          },
        },
        create: {
          attemptId,
          examQuestionId: question.id,
          answerPayload,
          savedAt: now,
        },
        update: { answerPayload, savedAt: now },
        select: { examQuestionId: true, savedAt: true },
      });
      return { expired: false as const, saved };
    }, TX_OPTIONS);

    if (result.expired) {
      // The save transaction has ended and released its share lock.
      await this.lifecycle.submitIfExpired(attemptId);
      throw fail(
        400,
        'ATTEMPT_EXPIRED',
        'Đã hết thời gian làm bài, bài làm đã được nộp tự động',
      );
    }
    return result.saved;
  }

  /**
   * Checks the request against the snapshot and returns the payload to
   * store. Exactly one of the three answer fields, the one the question
   * type takes; every option id must be in optionsSnapshot.
   */
  private buildAnswerPayload(
    question: ExamQuestion,
    dto: SaveAnswerDto,
  ): Prisma.InputJsonObject {
    const invalidShape = (message: string) =>
      fail(400, 'VALIDATION_ERROR', message);
    const invalidOption = () =>
      fail(400, 'INVALID_OPTION', 'Lựa chọn không thuộc câu hỏi này');

    const given = [
      dto.selectedOptionId !== undefined,
      dto.selectedOptionIds !== undefined,
      dto.text !== undefined,
    ].filter(Boolean).length;
    if (given !== 1) {
      throw invalidShape(
        'Cần gửi đúng một trong ba trường: selectedOptionId, selectedOptionIds, text',
      );
    }

    const type: QuestionType = resolveType(snapshotOf(question));
    const optionIds = new Set(
      (parseOptionsSnapshot(question.optionsSnapshot) ?? []).map((o) => o.id),
    );

    switch (type) {
      case 'MCQ':
      case 'TRUE_FALSE': {
        if (dto.selectedOptionId === undefined) {
          throw invalidShape('Câu hỏi này cần trường selectedOptionId');
        }
        if (!optionIds.has(dto.selectedOptionId)) throw invalidOption();
        return { selectedOptionId: dto.selectedOptionId };
      }
      case 'MCQ_MULTI': {
        if (dto.selectedOptionIds === undefined) {
          throw invalidShape('Câu hỏi này cần trường selectedOptionIds');
        }
        const selected = [...new Set(dto.selectedOptionIds)];
        if (selected.some((id) => !optionIds.has(id))) throw invalidOption();
        return { selectedOptionIds: selected };
      }
      case 'SHORT_ANSWER':
      case 'FILL_BLANK':
      case 'ESSAY': {
        if (dto.text === undefined) {
          throw invalidShape('Câu hỏi này cần trường text');
        }
        const max = type === 'ESSAY' ? ESSAY_TEXT_MAX : SHORT_TEXT_MAX;
        if (dto.text.length > max) {
          throw invalidShape(`Câu trả lời không được dài quá ${max} ký tự`);
        }
        return { text: dto.text };
      }
    }
  }

  // ---------------------------------------------------------------------
  // Submit (design 5.3)
  // ---------------------------------------------------------------------

  async submit(attemptId: string, studentId: string) {
    const submitted = await this.lifecycle.submitByStudent(
      attemptId,
      studentId,
    );
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: submitted.id },
      include: SUMMARY_INCLUDE,
    });
    if (!attempt) throw attemptNotFound();

    const masked = maskAttemptForStudent(attempt);
    return {
      id: masked.id,
      status: masked.status,
      submittedAt: masked.submittedAt,
      score: masked.score,
      resultsHidden: masked.resultsHidden,
      exam: { showResultImmediately: attempt.exam.showResultImmediately },
    };
  }

  // ---------------------------------------------------------------------
  // Student reads
  // ---------------------------------------------------------------------

  async getMyAttempts(studentId: string) {
    const expired = await this.prisma.examAttempt.findMany({
      where: { studentId, status: 'IN_PROGRESS', expiresAt: { lt: new Date() } },
      select: { id: true },
    });
    for (const { id } of expired) {
      await this.lifecycle.submitIfExpired(id);
    }

    const attempts = await this.prisma.examAttempt.findMany({
      where: { studentId },
      include: SUMMARY_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return attempts.map((attempt) => this.studentSummary(attempt));
  }

  async getAttemptForStudent(attemptId: string, studentId: string) {
    const load = () =>
      this.prisma.examAttempt.findUnique({
        where: { id: attemptId },
        include: {
          exam: { include: { questions: true } },
          assignment: { select: { hideResults: true } },
        },
      });

    let attempt = await load();
    if (!attempt) throw attemptNotFound();
    if (attempt.studentId !== studentId) throw notAttemptOwner();

    if (attempt.status === 'IN_PROGRESS' && new Date() > attempt.expiresAt) {
      await this.lifecycle.submitIfExpired(attemptId);
      attempt = await load();
      if (!attempt) throw attemptNotFound();
    }

    if (attempt.status === 'IN_PROGRESS') {
      return this.inProgressView(this.prisma, attempt, attempt.exam);
    }
    // After submit: no questions, the masked result.
    return this.studentSummary(attempt);
  }

  /**
   * GET /attempts/:id/result. The attempt owner gets the masked summary,
   * the exam owner the full one. Never carries optionsSnapshot.
   */
  async getResult(attemptId: string, userId: string) {
    const loadAttempt = () =>
      this.prisma.examAttempt.findUnique({
        where: { id: attemptId },
        include: {
          ...SUMMARY_INCLUDE,
          student: { select: { id: true, displayName: true, email: true } },
        },
      });

    let attempt = await loadAttempt();
    if (!attempt) throw attemptNotFound();

    if (
      attempt.status === 'IN_PROGRESS' &&
      new Date() > attempt.expiresAt
    ) {
      await this.lifecycle.submitIfExpired(attemptId);
      attempt = await loadAttempt();
      if (!attempt) throw attemptNotFound();
    }

    if (attempt.exam.ownerId === userId) {
      return { ...this.summary(attempt), student: attempt.student };
    }
    if (attempt.studentId === userId) return this.studentSummary(attempt);
    throw forbidden();
  }

  /**
   * GET /attempts/:id/review: the answer key. Exam owner, or the attempt
   * owner when results are visible; SUBMITTED for both.
   */
  async getAnswerReview(attemptId: string, userId: string) {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        exam: { include: { questions: { orderBy: { position: 'asc' } } } },
        assignment: { select: { hideResults: true } },
        answers: true,
      },
    });
    if (!attempt) throw attemptNotFound();

    const isExamOwner = attempt.exam.ownerId === userId;
    const isAttemptOwner = attempt.studentId === userId;
    if (!isExamOwner && !isAttemptOwner) throw forbidden();
    if (attempt.status !== 'SUBMITTED') throw attemptNotSubmitted();
    if (
      !isExamOwner &&
      !canStudentSeeResults(attempt.exam, attempt.assignment)
    ) {
      throw fail(403, 'RESULTS_NOT_AVAILABLE', 'Kết quả chưa được công bố');
    }

    const answerByQuestion = new Map(
      attempt.answers.map((a) => [a.examQuestionId, a]),
    );
    let pending = 0;

    const questions = attempt.exam.questions.map((eq) => {
      const type = resolveType(snapshotOf(eq));
      const options = parseOptionsSnapshot(eq.optionsSnapshot);
      const hasOptions = !!options && options.length > 0;
      const sorted = hasOptions
        ? [...options].sort((a, b) => a.position - b.position)
        : [];
      const correctIds = sorted.filter((o) => o.isCorrect).map((o) => o.id);

      const answer = answerByQuestion.get(eq.id);
      const payload = answer ? parseAnswerPayload(answer.answerPayload) : null;
      const selectedIds =
        payload?.selectedOptionIds ??
        (payload?.selectedOptionId ? [payload.selectedOptionId] : []);

      // Stored values only; nothing is graded again here. A question with
      // no answer row is graded, at 0.
      const earned: Decimal | null = answer
        ? answer.earnedPoints
        : new Decimal(0);
      if (earned === null) pending += 1;

      return {
        examQuestionId: eq.id,
        position: eq.position,
        questionType: type,
        content: eq.contentSnapshot,
        imageUrl: eq.imageUrlSnapshot,
        options: hasOptions
          ? sorted.map((o) => ({ id: o.id, content: o.content }))
          : null,
        correctOptionId:
          type === 'MCQ' || type === 'TRUE_FALSE'
            ? (correctIds[0] ?? null)
            : null,
        correctOptionIds: correctIds,
        correctAnswer: eq.correctAnswerSnapshot,
        selectedOptionId: payload?.selectedOptionId ?? null,
        selectedOptionIds: selectedIds,
        text: payload?.text ?? null,
        isCorrect: earned === null ? null : earned.equals(eq.points),
        points: eq.points,
        earnedPoints: earned === null ? null : earned.toNumber(),
        manuallyGraded: answer?.manuallyGraded ?? false,
        explanation: eq.explanationSnapshot,
        feedback: answer?.feedback ?? null,
      };
    });

    const total = questions.length;
    return {
      gradingMode: attempt.exam.gradingMode,
      gradingProgress: { graded: total - pending, total },
      questions,
    };
  }

  private summary(attempt: SummaryAttempt) {
    return {
      id: attempt.id,
      examId: attempt.examId,
      assignmentId: attempt.assignmentId,
      status: attempt.status,
      startedAt: attempt.startedAt,
      expiresAt: attempt.expiresAt,
      submittedAt: attempt.submittedAt,
      score: attempt.score,
      feedback: attempt.feedback,
      manualScoreOverride: attempt.manualScoreOverride,
      resultsHidden: false,
      exam: {
        title: attempt.exam.title,
        showResultImmediately: attempt.exam.showResultImmediately,
        resultsReleased: attempt.exam.resultsReleased,
      },
    };
  }

  /** The summary as its student may see it (result-visibility.ts). */
  private studentSummary(attempt: SummaryAttempt) {
    const masked = maskAttemptForStudent(attempt);
    return {
      ...this.summary(attempt),
      score: masked.score,
      feedback: masked.feedback,
      resultsHidden: masked.resultsHidden,
    };
  }

  // ---------------------------------------------------------------------
  // Teacher
  // ---------------------------------------------------------------------

  async getAttemptsForExam(examId: string, teacherId: string) {
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      select: { ownerId: true },
    });
    if (!exam || exam.ownerId !== teacherId) throw forbidden();

    // Lazy expiry reaches the teacher's list here.
    await this.lifecycle.sweepExpired({ examId });

    const attempts = await this.prisma.examAttempt.findMany({
      where: { examId },
      include: {
        student: { select: { id: true, displayName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const { total, pendingByAttempt } = await this.grading.progressForExam(
      this.prisma,
      examId,
      attempts.filter((a) => a.status === 'SUBMITTED').map((a) => a.id),
    );

    // attemptNumber: 1 for a student's first attempt on this exam.
    const attemptNumber = new Map<string, number>();
    const seen = new Map<string, number>();
    for (const a of [...attempts].sort(
      (x, y) =>
        x.startedAt.getTime() - y.startedAt.getTime() ||
        x.createdAt.getTime() - y.createdAt.getTime(),
    )) {
      const n = (seen.get(a.studentId) ?? 0) + 1;
      seen.set(a.studentId, n);
      attemptNumber.set(a.id, n);
    }

    return attempts.map((a) => ({
      ...a,
      attemptNumber: attemptNumber.get(a.id) ?? 1,
      gradingProgress:
        a.status === 'SUBMITTED'
          ? { graded: total - (pendingByAttempt.get(a.id) ?? 0), total }
          : null,
    }));
  }

  /**
   * Row lock, exam-owner check and SUBMITTED check shared by the two
   * teacher writes below.
   */
  private async lockSubmittedForTeacher(
    tx: Tx,
    attemptId: string,
    teacherId: string,
  ) {
    const found = await lockAttempt(tx, attemptId);
    const attempt = found
      ? await tx.examAttempt.findUnique({
          where: { id: attemptId },
          include: { exam: { select: { ownerId: true } } },
        })
      : null;
    if (!attempt) throw attemptNotFound();
    if (attempt.exam.ownerId !== teacherId) throw forbidden();
    if (attempt.status !== 'SUBMITTED') throw attemptNotSubmitted();
    return attempt;
  }

  /**
   * Bulk score override (G3). Per-answer earnedPoints are left as they are.
   */
  async updateScore(attemptId: string, teacherId: string, score: number) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockSubmittedForTeacher(tx, attemptId, teacherId);
      return tx.examAttempt.update({
        where: { id: attemptId },
        data: {
          score: new Decimal(score).toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
          manualScoreOverride: true,
        },
        select: { id: true, score: true, manualScoreOverride: true },
      });
    }, TX_OPTIONS);
  }

  async updateAttemptFeedback(
    attemptId: string,
    teacherId: string,
    feedback: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockSubmittedForTeacher(tx, attemptId, teacherId);
      return tx.examAttempt.update({
        where: { id: attemptId },
        data: { feedback },
        select: { id: true, feedback: true },
      });
    }, TX_OPTIONS);
  }

  // ---------------------------------------------------------------------
  // Screen-exit log (unchanged)
  // ---------------------------------------------------------------------

  async logExit(attemptId: string, studentId: string) {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
    });
    if (!attempt) throw new NotFoundException();
    if (attempt.studentId !== studentId) throw new ForbiddenException();
    if (attempt.status !== 'IN_PROGRESS') return;

    return this.prisma.examExitLog.create({
      data: { attemptId, exitedAt: new Date() },
    });
  }

  async logReturn(attemptId: string, studentId: string) {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
    });
    if (!attempt) throw new NotFoundException();
    if (attempt.studentId !== studentId) throw new ForbiddenException();

    const lastExit = await this.prisma.examExitLog.findFirst({
      where: { attemptId, returnedAt: null },
      orderBy: { exitedAt: 'desc' },
    });
    if (lastExit) {
      return this.prisma.examExitLog.update({
        where: { id: lastExit.id },
        data: { returnedAt: new Date() },
      });
    }
    return null;
  }

  async getExitLogs(attemptId: string, teacherId: string) {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: { exam: true },
    });
    if (!attempt) throw new NotFoundException();
    if (attempt.exam.ownerId !== teacherId) throw new ForbiddenException();

    return this.prisma.examExitLog.findMany({
      where: { attemptId },
      orderBy: { exitedAt: 'asc' },
    });
  }

  private shuffle<T>(array: T[]): T[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j]!, arr[i]!];
    }
    return arr;
  }
}
