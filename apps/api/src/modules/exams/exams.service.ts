import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateExamDto } from './dto/create-exam.dto';
import { UpdateExamDto } from './dto/update-exam.dto';
import { AddExamQuestionDto } from './dto/add-exam-question.dto';

@Injectable()
export class ExamsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(ownerId: string, dto: CreateExamDto) {
    return this.prisma.exam.create({
      data: {
        ownerId,
        title: dto.title,
        description: dto.description,
        instructions: dto.instructions,
        durationSeconds: dto.durationSeconds,
        availableFrom: dto.availableFrom ? new Date(dto.availableFrom) : null,
        availableUntil: dto.availableUntil ? new Date(dto.availableUntil) : null,
        maxAttempts: dto.maxAttempts ?? 1,
        showResultImmediately: dto.showResultImmediately ?? true,
        shuffleQuestions: dto.shuffleQuestions ?? false,
        shuffleOptions: dto.shuffleOptions ?? false,
        accessCode: dto.accessCode,
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
    if (exam.status !== 'DRAFT') {
      throw new BadRequestException('Can only modify DRAFT exams');
    }
    return this.prisma.exam.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.instructions !== undefined && { instructions: dto.instructions }),
        ...(dto.durationSeconds !== undefined && { durationSeconds: dto.durationSeconds }),
        ...(dto.availableFrom !== undefined && {
          availableFrom: dto.availableFrom ? new Date(dto.availableFrom) : null,
        }),
        ...(dto.availableUntil !== undefined && {
          availableUntil: dto.availableUntil ? new Date(dto.availableUntil) : null,
        }),
        ...(dto.maxAttempts !== undefined && { maxAttempts: dto.maxAttempts }),
        ...(dto.showResultImmediately !== undefined && { showResultImmediately: dto.showResultImmediately }),
        ...(dto.shuffleQuestions !== undefined && { shuffleQuestions: dto.shuffleQuestions }),
        ...(dto.shuffleOptions !== undefined && { shuffleOptions: dto.shuffleOptions }),
        ...(dto.accessCode !== undefined && { accessCode: dto.accessCode }),
      },
    });
  }

  async addQuestion(examId: string, ownerId: string, dto: AddExamQuestionDto) {
    const exam = await this.findByIdForOwner(examId, ownerId);
    if (exam.status !== 'DRAFT') {
      throw new BadRequestException('Can only modify DRAFT exams');
    }

    const question = await this.prisma.question.findUnique({
      where: { id: dto.questionId },
    });
    if (!question || question.ownerId !== ownerId) {
      throw new BadRequestException('Question not found or not owned by you');
    }

    return this.prisma.examQuestion.create({
      data: {
        examId,
        sourceQuestionId: dto.questionId,
        points: dto.points,
        position: dto.position,
      },
    });
  }

  async removeQuestion(examId: string, eqId: string, ownerId: string) {
    const exam = await this.findByIdForOwner(examId, ownerId);
    if (exam.status !== 'DRAFT') {
      throw new BadRequestException('Can only modify DRAFT exams');
    }
    await this.prisma.examQuestion.delete({ where: { id: eqId } });
  }

  async publish(examId: string, ownerId: string) {
    const exam = await this.findByIdForOwner(examId, ownerId);
    if (exam.status !== 'DRAFT') {
      throw new BadRequestException('Exam is not in DRAFT status');
    }
    if (exam.questions.length === 0) {
      throw new BadRequestException('Exam must have at least one question');
    }

    return this.prisma.$transaction(async (tx) => {
      for (const eq of exam.questions) {
        if (!eq.sourceQuestion) continue;
        const options = await tx.questionOption.findMany({
          where: { questionId: eq.sourceQuestion.id },
          orderBy: { position: 'asc' },
        });

        await tx.examQuestion.update({
          where: { id: eq.id },
          data: {
            contentSnapshot: eq.sourceQuestion.content,
            optionsSnapshot: options.map((o) => ({
              id: o.id,
              content: o.content,
              isCorrect: o.isCorrect,
              position: o.position,
            })),
          },
        });
      }

      return tx.exam.update({
        where: { id: examId },
        data: { status: 'PUBLISHED' },
        include: { questions: { orderBy: { position: 'asc' } } },
      });
    });
  }

  async releaseResults(examId: string, ownerId: string, release: boolean) {
    await this.findByIdForOwner(examId, ownerId);
    return this.prisma.exam.update({
      where: { id: examId },
      data: { resultsReleased: release },
    });
  }

  async regrade(examId: string, ownerId: string) {
    const exam = await this.findByIdForOwner(examId, ownerId);
    if (exam.status !== 'PUBLISHED') {
      throw new BadRequestException('Can only regrade PUBLISHED exams');
    }

    const attempts = await this.prisma.examAttempt.findMany({
      where: { examId, status: 'SUBMITTED', manualScoreOverride: false },
      include: { answers: { include: { examQuestion: true } } },
    });

    const examQuestions = await this.prisma.examQuestion.findMany({
      where: { examId },
    });

    return this.prisma.$transaction(async (tx) => {
      for (const attempt of attempts) {
        let totalPoints = 0;
        let earnedPoints = 0;

        for (const eq of examQuestions) {
          totalPoints += eq.points;
          const answer = attempt.answers.find((a) => a.examQuestionId === eq.id);
          if (!answer) continue;

          const payload = answer.answerPayload as { selectedOptionId?: string };
          const options = eq.optionsSnapshot as Array<{ id: string; isCorrect: boolean }> | null;
          if (!options || !payload.selectedOptionId) continue;

          const selected = options.find((o) => o.id === payload.selectedOptionId);
          if (selected?.isCorrect) {
            earnedPoints += eq.points;
          }
        }

        const { Decimal } = require('@prisma/client/runtime/library');
        const score = totalPoints > 0
          ? new Decimal((earnedPoints / totalPoints) * 10).toDecimalPlaces(2)
          : new Decimal(0);

        await tx.examAttempt.update({
          where: { id: attempt.id },
          data: { score },
        });
      }

      return { regraded: attempts.length };
    });
  }
}
