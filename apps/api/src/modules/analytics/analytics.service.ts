import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getClassroomPerformance(classroomId: string, teacherId: string) {
    const classroom = await this.prisma.classroom.findUnique({
      where: { id: classroomId },
    });
    if (!classroom || classroom.ownerId !== teacherId) throw new ForbiddenException();

    const memberCount = await this.prisma.classroomMember.count({
      where: { classroomId },
    });

    const assignments = await this.prisma.assignment.findMany({
      where: { classroomId },
      select: { id: true, examId: true },
    });

    const examIds = assignments.map((a) => a.examId);
    const examCount = new Set(examIds).size;

    const attempts = await this.prisma.examAttempt.findMany({
      where: { examId: { in: examIds }, status: 'SUBMITTED' },
      select: { score: true, studentId: true },
    });

    const scores = attempts
      .map((a) => (a.score ? Number(a.score) : null))
      .filter((s): s is number => s !== null);

    const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    const highestScore = scores.length > 0 ? Math.max(...scores) : null;
    const lowestScore = scores.length > 0 ? Math.min(...scores) : null;

    const uniqueStudents = new Set(attempts.map((a) => a.studentId)).size;
    const submissionRate = memberCount > 0 ? uniqueStudents / memberCount : 0;

    return {
      memberCount,
      examCount,
      avgScore: avgScore ? Math.round(avgScore * 100) / 100 : null,
      highestScore,
      lowestScore,
      submissionRate: Math.round(submissionRate * 100) / 100,
      totalAttempts: attempts.length,
    };
  }

  async getExamDistribution(examId: string, teacherId: string) {
    const exam = await this.prisma.exam.findUnique({ where: { id: examId } });
    if (!exam || exam.ownerId !== teacherId) throw new ForbiddenException();

    const attempts = await this.prisma.examAttempt.findMany({
      where: { examId, status: 'SUBMITTED' },
      select: { score: true },
    });

    const buckets = Array.from({ length: 10 }, (_, i) => ({
      range: `${i}-${i + 1}`,
      count: 0,
    }));

    for (const attempt of attempts) {
      if (attempt.score === null) continue;
      const score = Number(attempt.score);
      const idx = Math.min(Math.floor(score), 9);
      buckets[idx]!.count++;
    }

    return { buckets, totalAttempts: attempts.length };
  }

  async getExamQuestionStats(examId: string, teacherId: string) {
    const exam = await this.prisma.exam.findUnique({ where: { id: examId } });
    if (!exam || exam.ownerId !== teacherId) throw new ForbiddenException();

    const examQuestions = await this.prisma.examQuestion.findMany({
      where: { examId },
      orderBy: { position: 'asc' },
    });

    const answers = await this.prisma.answer.findMany({
      where: { attempt: { examId, status: 'SUBMITTED' } },
    });

    return examQuestions.map((eq) => {
      const qAnswers = answers.filter((a) => a.examQuestionId === eq.id);
      const options = eq.optionsSnapshot as Array<{ id: string; content: string; isCorrect: boolean }> | null;

      let correctCount = 0;
      const optionCounts: Record<string, number> = {};

      for (const answer of qAnswers) {
        const payload = answer.answerPayload as { selectedOptionId?: string };
        if (!payload.selectedOptionId || !options) continue;
        optionCounts[payload.selectedOptionId] = (optionCounts[payload.selectedOptionId] || 0) + 1;
        const selected = options.find((o) => o.id === payload.selectedOptionId);
        if (selected?.isCorrect) correctCount++;
      }

      const mostSelectedId = Object.entries(optionCounts).sort(([, a], [, b]) => b - a)[0]?.[0];

      return {
        questionId: eq.id,
        position: eq.position,
        content: eq.contentSnapshot,
        totalAnswered: qAnswers.length,
        correctCount,
        correctRate: qAnswers.length > 0 ? Math.round((correctCount / qAnswers.length) * 100) / 100 : null,
        mostSelectedOption: mostSelectedId ?? null,
      };
    });
  }

  async getExamRanking(examId: string, teacherId: string) {
    const exam = await this.prisma.exam.findUnique({ where: { id: examId } });
    if (!exam || exam.ownerId !== teacherId) throw new ForbiddenException();

    const attempts = await this.prisma.examAttempt.findMany({
      where: { examId, status: 'SUBMITTED' },
      include: { student: { select: { id: true, displayName: true, email: true } } },
      orderBy: { score: 'desc' },
    });

    let rank = 0;
    let lastScore: number | null = null;

    return attempts.map((a, idx) => {
      const score = a.score ? Number(a.score) : 0;
      if (score !== lastScore) {
        rank = idx + 1;
        lastScore = score;
      }
      return {
        rank,
        student: a.student,
        score,
        submittedAt: a.submittedAt,
      };
    });
  }

  async getStudentPerformance(studentId: string) {
    const attempts = await this.prisma.examAttempt.findMany({
      where: { studentId, status: 'SUBMITTED' },
      include: { exam: { select: { title: true } } },
      orderBy: { submittedAt: 'asc' },
    });

    return attempts.map((a) => ({
      examTitle: a.exam.title,
      score: a.score ? Number(a.score) : null,
      date: a.submittedAt,
    }));
  }
}
