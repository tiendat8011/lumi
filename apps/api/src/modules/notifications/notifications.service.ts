import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { NotificationType } from '@prisma/client';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    link?: string;
  }) {
    return this.prisma.notification.create({ data });
  }

  async createMany(
    userIds: string[],
    data: { type: NotificationType; title: string; body: string; link?: string },
  ) {
    return this.prisma.notification.createMany({
      data: userIds.map((userId) => ({ userId, ...data })),
    });
  }

  async notify(
    userIds: string[],
    data: {
      type: NotificationType;
      title: string;
      body: string;
      link?: string;
      dedupeKey?: string;
    },
    db?: Prisma.TransactionClient,
  ): Promise<void> {
    if (!userIds.length) return;
    const client = db ?? this.prisma;
    await client.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        type: data.type,
        title: data.title,
        body: data.body,
        link: data.link ?? null,
        dedupeKey: data.dedupeKey ?? null,
      })),
      skipDuplicates: true,
    });
  }

  async getForUser(userId: string, unreadOnly: boolean, limit: number) {
    return this.prisma.notification.findMany({
      where: { userId, ...(unreadOnly && { read: false }) },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getUnreadCount(userId: string) {
    return this.prisma.notification.count({
      where: { userId, read: false },
    });
  }

  async markAsRead(id: string, userId: string) {
    const notif = await this.prisma.notification.findUnique({ where: { id } });
    if (!notif || notif.userId !== userId) throw new NotFoundException();
    return this.prisma.notification.update({
      where: { id },
      data: { read: true },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
  }
}
