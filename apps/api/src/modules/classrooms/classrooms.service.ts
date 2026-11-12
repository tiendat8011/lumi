import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateClassroomDto } from './dto/create-classroom.dto';
import { UpdateClassroomDto } from './dto/update-classroom.dto';
import * as crypto from 'crypto';

@Injectable()
export class ClassroomsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(ownerId: string, dto: CreateClassroomDto) {
    const joinCode = this.generateJoinCode();
    return this.prisma.classroom.create({
      data: {
        name: dto.name,
        joinCode,
        ownerId,
      },
    });
  }

  async findAllForUser(userId: string, role: string) {
    if (role === 'TEACHER') {
      return this.prisma.classroom.findMany({
        where: { ownerId: userId, archivedAt: null },
        include: { _count: { select: { members: true } } },
        orderBy: { createdAt: 'desc' },
      });
    }
    return this.prisma.classroom.findMany({
      where: { members: { some: { userId } }, archivedAt: null },
      include: { _count: { select: { members: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    const classroom = await this.prisma.classroom.findUnique({
      where: { id },
    });
    if (!classroom) {
      throw new NotFoundException('Classroom not found');
    }
    return classroom;
  }

  async update(id: string, ownerId: string, dto: UpdateClassroomDto) {
    const classroom = await this.findById(id);
    if (classroom.ownerId !== ownerId) {
      throw new ForbiddenException();
    }
    return this.prisma.classroom.update({
      where: { id },
      data: { ...(dto.name !== undefined && { name: dto.name }) },
    });
  }

  async delete(id: string, ownerId: string) {
    const classroom = await this.findById(id);
    if (classroom.ownerId !== ownerId) {
      throw new ForbiddenException();
    }
    await this.prisma.classroom.delete({ where: { id } });
  }

  async archive(id: string, ownerId: string) {
    const classroom = await this.findById(id);
    if (classroom.ownerId !== ownerId) throw new ForbiddenException();
    return this.prisma.classroom.update({
      where: { id },
      data: { archivedAt: new Date() },
    });
  }

  async unarchive(id: string, ownerId: string) {
    const classroom = await this.findById(id);
    if (classroom.ownerId !== ownerId) throw new ForbiddenException();
    return this.prisma.classroom.update({
      where: { id },
      data: { archivedAt: null },
    });
  }

  async join(classroomId: string, userId: string, joinCode: string) {
    const classroom = await this.prisma.classroom.findUnique({
      where: { id: classroomId },
    });
    if (!classroom) {
      throw new NotFoundException('Classroom not found');
    }
    if (classroom.joinCode !== joinCode) {
      throw new BadRequestException('Invalid join code');
    }

    const existing = await this.prisma.classroomMember.findUnique({
      where: { classroomId_userId: { classroomId, userId } },
    });
    if (existing) {
      return existing;
    }

    return this.prisma.classroomMember.create({
      data: { classroomId, userId },
    });
  }

  async joinByCode(userId: string, joinCode: string) {
    const classroom = await this.prisma.classroom.findUnique({
      where: { joinCode },
    });
    if (!classroom) {
      throw new BadRequestException('Invalid join code');
    }
    return this.join(classroom.id, userId, joinCode);
  }

  async getMembers(classroomId: string) {
    return this.prisma.classroomMember.findMany({
      where: { classroomId },
      include: {
        user: {
          select: { id: true, email: true, displayName: true, role: true },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });
  }

  async removeMember(classroomId: string, memberId: string, ownerId: string) {
    const classroom = await this.findById(classroomId);
    if (classroom.ownerId !== ownerId) throw new ForbiddenException();
    const member = await this.prisma.classroomMember.findFirst({
      where: { classroomId, userId: memberId },
    });
    if (!member) throw new NotFoundException('Member not found');
    await this.prisma.classroomMember.delete({ where: { id: member.id } });
  }

  async isOwner(classroomId: string, userId: string): Promise<boolean> {
    const classroom = await this.prisma.classroom.findUnique({
      where: { id: classroomId },
    });
    return classroom?.ownerId === userId;
  }

  async isMember(classroomId: string, userId: string): Promise<boolean> {
    const member = await this.prisma.classroomMember.findUnique({
      where: { classroomId_userId: { classroomId, userId } },
    });
    return !!member;
  }

  private generateJoinCode(): string {
    return crypto.randomBytes(3).toString('hex').toUpperCase();
  }
}
