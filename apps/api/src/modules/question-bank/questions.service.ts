import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { PaginationQueryDto, paginate } from '../../common/dto/pagination.dto';

@Injectable()
export class QuestionsService {
  constructor(private readonly prisma: PrismaService) {}

  // --- Categories ---

  async createCategory(ownerId: string, dto: CreateCategoryDto) {
    return this.prisma.questionCategory.create({
      data: { ownerId, name: dto.name, parentId: dto.parentId },
    });
  }

  async getCategories(ownerId: string) {
    return this.prisma.questionCategory.findMany({
      where: { ownerId },
      include: { children: true, _count: { select: { questions: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async deleteCategory(id: string, ownerId: string) {
    const cat = await this.prisma.questionCategory.findUnique({ where: { id } });
    if (!cat) throw new NotFoundException('Category not found');
    if (cat.ownerId !== ownerId) throw new ForbiddenException();
    await this.prisma.questionCategory.delete({ where: { id } });
  }

  // --- Questions ---

  async create(ownerId: string, dto: CreateQuestionDto) {
    const type = dto.type || 'MCQ';
    const needsOptions = ['MCQ', 'MCQ_MULTI', 'TRUE_FALSE'].includes(type);

    if (needsOptions) {
      if (!dto.options || dto.options.length < 2) {
        throw new BadRequestException('Options required for this question type');
      }
      if (type === 'MCQ' || type === 'TRUE_FALSE') {
        const correctCount = dto.options.filter((o) => o.isCorrect).length;
        if (correctCount !== 1) {
          throw new BadRequestException('Exactly one correct option required');
        }
      }
      if (type === 'MCQ_MULTI') {
        const correctCount = dto.options.filter((o) => o.isCorrect).length;
        if (correctCount < 1) {
          throw new BadRequestException('At least one correct option required');
        }
      }
    }

    return this.prisma.question.create({
      data: {
        ownerId,
        type,
        content: dto.content,
        explanation: dto.explanation,
        difficulty: dto.difficulty,
        categoryId: dto.categoryId,
        imageUrl: dto.imageUrl,
        correctAnswer: dto.correctAnswer,
        ...(needsOptions && dto.options && {
          options: {
            create: dto.options.map((o) => ({
              content: o.content,
              isCorrect: o.isCorrect,
              position: o.position,
            })),
          },
        }),
      },
      include: { options: { orderBy: { position: 'asc' } }, category: true },
    });
  }

  async findAll(
    ownerId: string,
    query: PaginationQueryDto & {
      search?: string;
      categoryId?: string;
      difficulty?: string;
      type?: string;
    },
  ) {
    const where: Record<string, unknown> = { ownerId };
    if (query.search) {
      where.content = { contains: query.search, mode: 'insensitive' };
    }
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.difficulty) where.difficulty = query.difficulty;
    if (query.type) where.type = query.type;

    const [items, total] = await Promise.all([
      this.prisma.question.findMany({
        where,
        include: { options: { orderBy: { position: 'asc' } }, category: true },
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.question.count({ where }),
    ]);
    return paginate(items, total, query);
  }

  async findById(id: string, ownerId: string) {
    const question = await this.prisma.question.findUnique({
      where: { id },
      include: { options: { orderBy: { position: 'asc' } }, category: true },
    });
    if (!question) {
      throw new NotFoundException('Question not found');
    }
    if (question.ownerId !== ownerId) {
      throw new ForbiddenException();
    }
    return question;
  }

  async update(id: string, ownerId: string, dto: UpdateQuestionDto) {
    const question = await this.findById(id, ownerId);

    if (dto.options) {
      const type = question.type;
      if (type === 'MCQ' || type === 'TRUE_FALSE') {
        const correctCount = dto.options.filter((o) => o.isCorrect).length;
        if (correctCount !== 1) {
          throw new BadRequestException('Exactly one correct option required');
        }
      }
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.options) {
        await tx.questionOption.deleteMany({
          where: { questionId: question.id },
        });
        await tx.questionOption.createMany({
          data: dto.options.map((o) => ({
            questionId: question.id,
            content: o.content,
            isCorrect: o.isCorrect,
            position: o.position,
          })),
        });
      }

      return tx.question.update({
        where: { id },
        data: {
          ...(dto.content !== undefined && { content: dto.content }),
          ...(dto.explanation !== undefined && { explanation: dto.explanation }),
          ...(dto.difficulty !== undefined && { difficulty: dto.difficulty }),
          ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
          ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl }),
          ...(dto.correctAnswer !== undefined && { correctAnswer: dto.correctAnswer }),
        },
        include: { options: { orderBy: { position: 'asc' } }, category: true },
      });
    });
  }

  async delete(id: string, ownerId: string) {
    await this.findById(id, ownerId);
    await this.prisma.question.delete({ where: { id } });
  }
}
