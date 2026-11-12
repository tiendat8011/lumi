import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { StartAttemptDto } from './dto/start-attempt.dto';
import { SaveAnswerDto } from './dto/save-answer.dto';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class AttemptsService {
  constructor(private readonly prisma: PrismaService) {}

  async start(studentId: string, dto: StartAttemptDto) {
    const exam = await this.prisma.exam.findUnique({
      where: { id: dto.examId },
      include: { questions: { orderBy: { position: 'asc' } } },
    });
    if (!exam || exam.status !== 'PUBLISHED') {
      throw new BadRequestException('Exam not found or not published');
    }

    const now = new Date();
    if (exam.availableFrom && now < exam.availableFrom) {
      throw new BadRequestException('Exam is not yet available');
    }
    if (exam.availableUntil && now > exam.availableUntil) {
      throw new BadRequestException('Exam availability has ended');
    }

    const existingAttempts = await this.prisma.examAttempt.count({
      where: { examId: dto.examId, studentId },
    });
    if (existingAttempts >= exam.maxAttempts) {
      throw new BadRequestException('Maximum attempts reached');
    }

    const inProgress = await this.prisma.examAttempt.findFirst({
      where: { examId: dto.examId, studentId, status: 'IN_PROGRESS' },
    });
    if (inProgress) {
      if (now > inProgress.expiresAt) {
        await this.autoSubmit(inProgress.id);
      } else {
        return this.getAttemptWithQuestions(inProgress.id);
      }
    }

    const expiresAt = new Date(now.getTime() + exam.durationSeconds * 1000);

    let questionOrder: string[] | undefined = undefined;
    if (exam.shuffleQuestions) {
      const ids = exam.questions.map((q) => q.id);
      questionOrder = this.shuffle(ids);
    }

    const attempt = await this.prisma.examAttempt.create({
      data: {
        examId: dto.examId,
        studentId,
        assignmentId: dto.assignmentId || null,
        expiresAt,
        ...(questionOrder && { questionOrder }),
      },
    });

    return this.getAttemptWithQuestions(attempt.id);
  }

  async saveAnswer(attemptId: string, studentId: string, dto: SaveAnswerDto) {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
    });
    if (!attempt) throw new NotFoundException('Attempt not found');
    if (attempt.studentId !== studentId) throw new ForbiddenException();

    if (attempt.status === 'SUBMITTED') {
      throw new BadRequestException('Attempt already submitted');
    }

    const now = new Date();
    if (now > attempt.expiresAt) {
      await this.autoSubmit(attemptId);
      throw new BadRequestException('Time expired — attempt auto-submitted');
    }

    return this.prisma.answer.upsert({
      where: {
        attemptId_examQuestionId: {
          attemptId,
          examQuestionId: dto.examQuestionId,
        },
      },
      create: {
        attemptId,
        examQuestionId: dto.examQuestionId,
        answerPayload: { selectedOptionId: dto.selectedOptionId },
      },
      update: {
        answerPayload: { selectedOptionId: dto.selectedOptionId },
        savedAt: now,
      },
    });
  }

  async getMyAttempts(studentId: string) {
    return this.prisma.examAttempt.findMany({
      where: { studentId },
      include: {
        exam: { select: { title: true, showResultImmediately: true, resultsReleased: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async submit(attemptId: string, studentId: string) {
    return this.prisma.$transaction(async (tx) => {
      const attempt = await tx.examAttempt.findUnique({
        where: { id: attemptId },
      });
      if (!attempt) throw new NotFoundException('Attempt not found');
      if (attempt.studentId !== studentId) throw new ForbiddenException();

      if (attempt.status === 'SUBMITTED') {
        return this.getResult(attemptId);
      }

      return this.gradeAndSubmit(tx, attemptId);
    });
  }

  async getAttemptForStudent(attemptId: string, studentId: string) {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
    });
    if (!attempt) throw new NotFoundException('Attempt not found');
    if (attempt.studentId !== studentId) throw new ForbiddenException();

    const now = new Date();
    if (attempt.status === 'IN_PROGRESS' && now > attempt.expiresAt) {
      await this.autoSubmit(attemptId);
    }

    return this.getAttemptWithQuestions(attemptId);
  }

  async getResult(attemptId: string) {
    return this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        exam: { select: { title: true, showResultImmediately: true, resultsReleased: true } },
        answers: {
          include: {
            examQuestion: {
              select: {
                id: true,
                contentSnapshot: true,
                optionsSnapshot: true,
                points: true,
                position: true,
              },
            },
          },
        },
      },
    });
  }

  async getAnswerReview(attemptId: string, userId: string, role: string) {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        exam: true,
        answers: { include: { examQuestion: true } },
      },
    });
    if (!attempt) throw new NotFoundException('Attempt not found');

    if (role === 'STUDENT') {
      if (attempt.studentId !== userId) throw new ForbiddenException();
      if (!attempt.exam.showResultImmediately && !attempt.exam.resultsReleased) {
        throw new BadRequestException('Results not available yet');
      }
    } else if (role === 'TEACHER') {
      if (attempt.exam.ownerId !== userId) throw new ForbiddenException();
    }

    const examQuestions = await this.prisma.examQuestion.findMany({
      where: { examId: attempt.examId },
      orderBy: { position: 'asc' },
    });

    return examQuestions.map((eq) => {
      const answer = attempt.answers.find((a) => a.examQuestionId === eq.id);
      const options = eq.optionsSnapshot as Array<{ id: string; content: string; isCorrect: boolean }> | null;
      const payload = answer?.answerPayload as { selectedOptionId?: string } | null;

      const correctOption = options?.find((o) => o.isCorrect);
      const selectedOption = options?.find((o) => o.id === payload?.selectedOptionId);
      const isCorrect = selectedOption?.isCorrect ?? false;

      return {
        position: eq.position,
        content: eq.contentSnapshot,
        options: options?.map((o) => ({ id: o.id, content: o.content })),
        correctOptionId: correctOption?.id ?? null,
        selectedOptionId: payload?.selectedOptionId ?? null,
        isCorrect,
        points: eq.points,
        earnedPoints: isCorrect ? eq.points : 0,
        feedback: answer?.feedback ?? null,
      };
    });
  }

  async getAttemptsForExam(examId: string, teacherId: string) {
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
    });
    if (!exam || exam.ownerId !== teacherId) {
      throw new ForbiddenException();
    }

    return this.prisma.examAttempt.findMany({
      where: { examId },
      include: {
        student: { select: { id: true, displayName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateScore(attemptId: string, teacherId: string, score: number) {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: { exam: true },
    });
    if (!attempt) throw new NotFoundException();
    if (attempt.exam.ownerId !== teacherId) throw new ForbiddenException();

    return this.prisma.examAttempt.update({
      where: { id: attemptId },
      data: { score: new Decimal(score), manualScoreOverride: true },
    });
  }

  async updateAttemptFeedback(attemptId: string, teacherId: string, feedback: string) {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: { exam: true },
    });
    if (!attempt) throw new NotFoundException();
    if (attempt.exam.ownerId !== teacherId) throw new ForbiddenException();

    return this.prisma.examAttempt.update({
      where: { id: attemptId },
      data: { feedback },
    });
  }

  async updateAnswerFeedback(answerId: string, teacherId: string, feedback: string) {
    const answer = await this.prisma.answer.findUnique({
      where: { id: answerId },
      include: { attempt: { include: { exam: true } } },
    });
    if (!answer) throw new NotFoundException('Answer not found');
    if (answer.attempt.exam.ownerId !== teacherId) throw new ForbiddenException();

    return this.prisma.answer.update({
      where: { id: answerId },
      data: { feedback },
    });
  }

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

  private async autoSubmit(attemptId: string) {
    await this.prisma.$transaction(async (tx) => {
      const attempt = await tx.examAttempt.findUnique({
        where: { id: attemptId },
      });
      if (!attempt || attempt.status !== 'IN_PROGRESS') return;
      await this.gradeAndSubmit(tx, attemptId);
    });
  }

  private async gradeAndSubmit(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    attemptId: string,
  ) {
    const answers = await tx.answer.findMany({
      where: { attemptId },
      include: { examQuestion: true },
    });

    let totalPoints = 0;
    let earnedPoints = 0;

    const examQuestions = await tx.examQuestion.findMany({
      where: {
        examId: (
          await tx.examAttempt.findUnique({ where: { id: attemptId } })
        )!.examId,
      },
    });

    for (const eq of examQuestions) {
      totalPoints += eq.points;
      const answer = answers.find((a) => a.examQuestionId === eq.id);
      if (!answer) continue;

      const payload = answer.answerPayload as { selectedOptionId?: string };
      const options = eq.optionsSnapshot as Array<{
        id: string;
        isCorrect: boolean;
      }> | null;
      if (!options || !payload.selectedOptionId) continue;

      const selected = options.find((o) => o.id === payload.selectedOptionId);
      if (selected?.isCorrect) {
        earnedPoints += eq.points;
      }
    }

    const score =
      totalPoints > 0
        ? new Decimal((earnedPoints / totalPoints) * 10).toDecimalPlaces(2)
        : new Decimal(0);

    const result = await tx.examAttempt.update({
      where: { id: attemptId },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
        score,
      },
      include: {
        exam: { select: { title: true, showResultImmediately: true } },
        answers: true,
      },
    });

    return result;
  }

  private async getAttemptWithQuestions(attemptId: string) {
    return this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        exam: {
          include: {
            questions: {
              orderBy: { position: 'asc' },
              select: {
                id: true,
                contentSnapshot: true,
                optionsSnapshot: true,
                points: true,
                position: true,
              },
            },
          },
        },
        answers: true,
      },
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
