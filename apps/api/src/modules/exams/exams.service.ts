import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  TX_OPTIONS,
  TX_OPTIONS_LONG,
  Tx,
  lockExam,
  lockSubmittedAttempts,
} from '../../common/db/locks';
import { fail } from '../../common/errors/app-error';
import { runAfterCommit } from '../../common/utils/after-commit';
import { GradingService } from '../grading/grading.service';
import { NotificationEvents } from '../notifications/notification-events.service';
import { CreateExamDto } from './dto/create-exam.dto';
import { UpdateExamDto } from './dto/update-exam.dto';
import { AddExamQuestionDto } from './dto/add-exam-question.dto';
import { validateQuestionInput } from '../question-bank/question-validation';

/** Hard cap on questions per exam (design 4.4). */
export const MAX_EXAM_QUESTIONS = 200;

const OPTION_TYPES = ['MCQ', 'MCQ_MULTI', 'TRUE_FALSE'];

type SourceQuestion = {
  type: string;
  content: string;
  correctAnswer: string | null;
  options: { isCorrect: boolean }[];
};

function isPublishableQuestion(source: SourceQuestion | null): boolean {
  if (!source) return false;
  if (source.content.trim() === '') return false;
  const { valid } = validateQuestionInput({
    type: source.type,
    options: source.options,
    correctAnswer: source.correctAnswer,
  });
  return valid;
}

@Injectable()
export class ExamsService {
  private readonly logger = new Logger(ExamsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly grading: GradingService,
    private readonly events: NotificationEvents,
  ) {}

  private validateWindow(
    from: string | undefined | null,
    until: string | undefined | null,
    checkPast: boolean,
  ) {
    if (from && until) {
      if (new Date(from) >= new Date(until)) {
        throw fail(
          400,
          'INVALID_AVAILABILITY_WINDOW',
          'Thời gian bắt đầu phải trước thời gian kết thúc',
        );
      }
    }
    if (checkPast && from && new Date(from) < new Date()) {
      throw fail(
        400,
        'AVAILABILITY_IN_PAST',
        'Thời gian bắt đầu không thể trong quá khứ',
      );
    }
  }

  async create(ownerId: string, dto: CreateExamDto) {
    this.validateWindow(dto.availableFrom, dto.availableUntil, true);
    return this.prisma.exam.create({
      data: {
        ownerId,
        title: dto.title,
        description: dto.description,
        instructions: dto.instructions,
        durationSeconds: dto.durationSeconds,
        availableFrom: dto.availableFrom ? new Date(dto.availableFrom) : null,
        availableUntil: dto.availableUntil
          ? new Date(dto.availableUntil)
          : null,
        maxAttempts: dto.maxAttempts ?? 1,
        showResultImmediately: dto.showResultImmediately ?? true,
        shuffleQuestions: dto.shuffleQuestions ?? false,
        shuffleOptions: dto.shuffleOptions ?? false,
        accessCode: dto.accessCode,
        ...(dto.gradingMode !== undefined && { gradingMode: dto.gradingMode }),
        ...(dto.allowFileSubmission !== undefined && {
          allowFileSubmission: dto.allowFileSubmission,
        }),
      },
    });
  }

  async findAllForOwner(ownerId: string) {
    return this.prisma.exam.findMany({
      where: { ownerId },
      include: { _count: { select: { questions: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    const exam = await this.prisma.exam.findUnique({
      where: { id },
      include: {
        questions: {
          orderBy: { position: 'asc' },
          include: { sourceQuestion: { include: { options: true } } },
        },
      },
    });
    if (!exam) {
      throw new NotFoundException('Exam not found');
    }
    return exam;
  }

  async findByIdForOwner(id: string, ownerId: string) {
    const exam = await this.findById(id);
    if (exam.ownerId !== ownerId) {
      throw new ForbiddenException();
    }
    return exam;
  }

  async update(id: string, ownerId: string, dto: UpdateExamDto) {
    const exam = await this.findByIdForOwner(id, ownerId);
    // Every field, gradingMode included, is read-only after publish
    // (G7-BR-02, ruling D9/B2).
    if (exam.status !== 'DRAFT') {
      throw fail(
        400,
        'EXAM_NOT_DRAFT',
        'Chỉ có thể sửa đề thi ở trạng thái nháp',
      );
    }
    const effectiveFrom =
      dto.availableFrom !== undefined
        ? dto.availableFrom
        : exam.availableFrom?.toISOString() ?? null;
    const effectiveUntil =
      dto.availableUntil !== undefined
        ? dto.availableUntil
        : exam.availableUntil?.toISOString() ?? null;
    this.validateWindow(effectiveFrom, effectiveUntil, false);

    return this.prisma.exam.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.instructions !== undefined && {
          instructions: dto.instructions,
        }),
        ...(dto.durationSeconds !== undefined && {
          durationSeconds: dto.durationSeconds,
        }),
        ...(dto.availableFrom !== undefined && {
          availableFrom: dto.availableFrom ? new Date(dto.availableFrom) : null,
        }),
        ...(dto.availableUntil !== undefined && {
          availableUntil: dto.availableUntil
            ? new Date(dto.availableUntil)
            : null,
        }),
        ...(dto.maxAttempts !== undefined && { maxAttempts: dto.maxAttempts }),
        ...(dto.showResultImmediately !== undefined && {
          showResultImmediately: dto.showResultImmediately,
        }),
        ...(dto.shuffleQuestions !== undefined && {
          shuffleQuestions: dto.shuffleQuestions,
        }),
        ...(dto.shuffleOptions !== undefined && {
          shuffleOptions: dto.shuffleOptions,
        }),
        ...(dto.accessCode !== undefined && { accessCode: dto.accessCode }),
        ...(dto.gradingMode !== undefined && { gradingMode: dto.gradingMode }),
        ...(dto.allowFileSubmission !== undefined && {
          allowFileSubmission: dto.allowFileSubmission,
        }),
      },
    });
  }

  /**
   * Takes the exam row lock and returns the exam as it is under that lock.
   * 404 when it does not exist, 403 when the caller does not own it.
   */
  private async lockOwnedExam(tx: Tx, examId: string, ownerId: string) {
    const found = await lockExam(tx, examId);
    const exam = found
      ? await tx.exam.findUnique({ where: { id: examId } })
      : null;
    if (!exam) throw fail(404, 'EXAM_NOT_FOUND', 'Không tìm thấy đề thi');
    if (exam.ownerId !== ownerId) {
      throw fail(403, 'FORBIDDEN', 'Bạn không có quyền với đề thi này');
    }
    return exam;
  }

  private assertDraft(exam: { status: string }) {
    if (exam.status !== 'DRAFT') {
      throw fail(
        400,
        'EXAM_NOT_DRAFT',
        'Chỉ có thể thay đổi đề thi ở trạng thái nháp',
      );
    }
  }

  async addQuestion(examId: string, ownerId: string, dto: AddExamQuestionDto) {
    return this.prisma.$transaction(async (tx) => {
      // The lock serialises this with publish: a question cannot be added
      // while the exam is being snapshotted (design 5.5).
      const exam = await this.lockOwnedExam(tx, examId, ownerId);
      this.assertDraft(exam);

      const question = await tx.question.findUnique({
        where: { id: dto.questionId },
        select: { ownerId: true },
      });
      if (!question || question.ownerId !== ownerId) {
        throw fail(
          400,
          'QUESTION_NOT_OWNED',
          'Câu hỏi không tồn tại hoặc không thuộc về bạn',
        );
      }

      const count = await tx.examQuestion.count({ where: { examId } });
      if (count >= MAX_EXAM_QUESTIONS) {
        throw fail(
          400,
          'MAX_QUESTIONS_REACHED',
          `Đề thi chỉ được có tối đa ${MAX_EXAM_QUESTIONS} câu hỏi`,
        );
      }

      // A duplicate position violates the unique (examId, position) and
      // surfaces as 409 through the exception filter.
      return tx.examQuestion.create({
        data: {
          examId,
          sourceQuestionId: dto.questionId,
          points: dto.points,
          position: dto.position,
        },
      });
    }, TX_OPTIONS);
  }

  async removeQuestion(examId: string, eqId: string, ownerId: string) {
    await this.prisma.$transaction(async (tx) => {
      const exam = await this.lockOwnedExam(tx, examId, ownerId);
      this.assertDraft(exam);

      // Scoped to this exam: an id from another exam removes nothing.
      const { count } = await tx.examQuestion.deleteMany({
        where: { id: eqId, examId },
      });
      if (count === 0) {
        throw fail(
          404,
          'QUESTION_NOT_FOUND',
          'Không tìm thấy câu hỏi trong đề thi',
        );
      }
    }, TX_OPTIONS);
  }

  async publish(examId: string, ownerId: string) {
    return this.prisma.$transaction(async (tx) => {
      const exam = await this.lockOwnedExam(tx, examId, ownerId);
      this.assertDraft(exam);

      // Read under the lock, so the set of questions cannot change.
      const questions = await tx.examQuestion.findMany({
        where: { examId },
        orderBy: { position: 'asc' },
        include: {
          sourceQuestion: {
            include: { options: { orderBy: { position: 'asc' } } },
          },
        },
      });
      if (questions.length === 0) {
        throw fail(
          400,
          'EXAM_HAS_NO_QUESTIONS',
          'Đề thi phải có ít nhất một câu hỏi',
        );
      }

      const invalid = questions
        .map((eq, index) => ({ eq, ordinal: index + 1 }))
        .filter(({ eq }) => !isPublishableQuestion(eq.sourceQuestion))
        .map(({ ordinal }) => ordinal);
      if (invalid.length > 0) {
        throw fail(
          400,
          'INVALID_QUESTIONS',
          `Không thể xuất bản: câu hỏi không hợp lệ hoặc đã bị xoá ở vị trí ${invalid.join(', ')}`,
        );
      }

      for (const eq of questions) {
        const source = eq.sourceQuestion!;
        const hasOptions = OPTION_TYPES.includes(source.type);
        await tx.examQuestion.update({
          where: { id: eq.id },
          data: {
            contentSnapshot: source.content,
            optionsSnapshot: hasOptions
              ? source.options.map((o) => ({
                  id: o.id,
                  content: o.content,
                  isCorrect: o.isCorrect,
                  position: o.position,
                }))
              : Prisma.DbNull,
            typeSnapshot: source.type,
            correctAnswerSnapshot: source.correctAnswer,
            imageUrlSnapshot: source.imageUrl,
            explanationSnapshot: source.explanation,
          },
        });
      }

      return tx.exam.update({
        where: { id: examId },
        data: { status: 'PUBLISHED' },
        include: { questions: { orderBy: { position: 'asc' } } },
      });
    }, TX_OPTIONS);
  }

  async releaseResults(examId: string, ownerId: string, release: boolean) {
    await this.findByIdForOwner(examId, ownerId);

    // Conditional update: only the request that actually flips the flag
    // gets count 1, so a repeated or concurrent release notifies once.
    const { count } = await this.prisma.exam.updateMany({
      where: { id: examId, ownerId, resultsReleased: !release },
      data: { resultsReleased: release },
    });
    if (release && count === 1) {
      await runAfterCommit(this.logger, `resultsReleased ${examId}`, () =>
        this.events.resultsReleased(examId),
      );
    }
    return { id: examId, resultsReleased: release };
  }

  /**
   * Regrade (design 5.4): one all-or-nothing transaction. Attempts with a
   * manual score override are skipped; in the others, answers graded by
   * hand are kept and the rest are graded again by the engine.
   */
  async regrade(examId: string, ownerId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const exam = await this.lockOwnedExam(tx, examId, ownerId);
      if (exam.status !== 'PUBLISHED') {
        throw fail(
          400,
          'EXAM_NOT_PUBLISHED',
          'Chỉ có thể chấm lại đề thi đã xuất bản',
        );
      }

      const ids = await lockSubmittedAttempts(tx, examId);
      const attempts = await tx.examAttempt.findMany({
        where: { id: { in: ids } },
        select: { id: true, score: true, manualScoreOverride: true },
      });
      const context = await this.grading.loadContext(tx, examId);

      let regraded = 0;
      let skipped = 0;
      const changed: string[] = [];
      for (const attempt of attempts) {
        if (attempt.manualScoreOverride) {
          skipped += 1;
          continue;
        }
        const { score } = await this.grading.gradeAttempt(tx, attempt.id, {
          preserveManual: true,
          context,
        });
        if (attempt.score === null || !score.equals(attempt.score)) {
          await tx.examAttempt.update({
            where: { id: attempt.id },
            data: { score },
          });
          changed.push(attempt.id);
        }
        regraded += 1;
      }
      return { regraded, skipped, changed };
    }, TX_OPTIONS_LONG);

    if (result.changed.length > 0) {
      await runAfterCommit(this.logger, `examRegraded ${examId}`, () =>
        this.events.examRegraded(examId, result.changed),
      );
    }
    return { regraded: result.regraded, skipped: result.skipped };
  }
}
