import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

type Db = PrismaService | Prisma.TransactionClient;

export type SelectionCriteria = {
  categoryId?: string;
  groupId?: string;
  difficulty?: string;
  type?: string;
};

@Injectable()
export class QuestionSelectionService {
  constructor(private readonly prisma: PrismaService) {}

  async count(ownerId: string, criteria: SelectionCriteria): Promise<number> {
    return this.prisma.question.count({
      where: this.buildWhere(ownerId, criteria),
    });
  }

  async pickRandom(
    db: Db,
    ownerId: string,
    criteria: SelectionCriteria,
    count: number,
    excludeIds: string[] = [],
  ): Promise<{ id: string }[]> {
    const where: Record<string, unknown> = this.buildWhere(ownerId, criteria);
    if (excludeIds.length > 0) {
      where.id = { notIn: excludeIds };
    }

    const prismaClient = 'question' in db ? db : (db as any);
    return prismaClient.question.findMany({
      where,
      select: { id: true },
      orderBy: { id: 'asc' },
    }).then((questions: { id: string }[]) => {
      // Shuffle in memory and take `count` — Prisma doesn't support ORDER BY random()
      for (let i = questions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = questions[i]!;
        questions[i] = questions[j]!;
        questions[j] = tmp;
      }
      return questions.slice(0, count);
    });
  }

  private buildWhere(
    ownerId: string,
    criteria: SelectionCriteria,
  ): Record<string, unknown> {
    const where: Record<string, unknown> = { ownerId };
    if (criteria.categoryId) where.categoryId = criteria.categoryId;
    if (criteria.difficulty) where.difficulty = criteria.difficulty;
    if (criteria.type) where.type = criteria.type;
    if (criteria.groupId) {
      where.groupItems = { some: { groupId: criteria.groupId } };
    }
    return where;
  }
}
