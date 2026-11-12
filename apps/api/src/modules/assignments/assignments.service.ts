import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';

@Injectable()
export class AssignmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(teacherId: string, dto: CreateAssignmentDto) {
    const exam = await this.prisma.exam.findUnique({
      where: { id: dto.examId },
    });
    if (!exam || exam.ownerId !== teacherId) {
      throw new BadRequestException('Exam not found or not owned by you');
    }
    if (exam.status !== 'PUBLISHED') {
      throw new BadRequestException('Can only assign PUBLISHED exams');
    }

    const classroom = await this.prisma.classroom.findUnique({
      where: { id: dto.classroomId },
    });
    if (!classroom || classroom.ownerId !== teacherId) {
      throw new BadRequestException(
        'Classroom not found or not owned by you',
      );
    }

    return this.prisma.assignment.create({
      data: {
        examId: dto.examId,
        classroomId: dto.classroomId,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
      },
      include: { exam: true, classroom: true },
    });
  }

  async findByClassroom(classroomId: string, userId: string, role: string) {
    if (role === 'TEACHER') {
      const classroom = await this.prisma.classroom.findUnique({
        where: { id: classroomId },
      });
      if (!classroom || classroom.ownerId !== userId) {
        throw new ForbiddenException();
      }
    } else {
      const membership = await this.prisma.classroomMember.findUnique({
        where: {
          classroomId_userId: { classroomId, userId },
        },
      });
      if (!membership) {
        throw new ForbiddenException();
      }
    }

    return this.prisma.assignment.findMany({
      where: { classroomId, status: 'ACTIVE' },
      include: {
        exam: { select: { id: true, title: true, durationSeconds: true } },
      },
      orderBy: { assignedAt: 'desc' },
    });
  }

  async findById(id: string) {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id },
      include: { exam: true, classroom: true },
    });
    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }
    return assignment;
  }

  async close(id: string, teacherId: string) {
    const assignment = await this.findById(id);
    if (assignment.classroom.ownerId !== teacherId) {
      throw new ForbiddenException();
    }
    return this.prisma.assignment.update({
      where: { id },
      data: { status: 'CLOSED' },
    });
  }
}
