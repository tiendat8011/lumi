/**
 * Seed script — populates lumi_dev with realistic Vietnamese test data.
 *
 * Usage:  npx tsx apps/api/prisma/seed.ts
 *
 * Idempotent: skips if teacher1@lumi.test already exists.
 * Password for all seeded users: "password123"
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const PWD = 'password123';

async function main() {
  // Idempotency check
  const existing = await prisma.user.findUnique({
    where: { email: 'teacher1@lumi.test' },
  });
  if (existing) {
    console.log('⏩ Seed data already exists (teacher1@lumi.test found). Skipping.');
    return;
  }

  const hash = await bcrypt.hash(PWD, 12);
  console.log('🌱 Seeding Lumi dev database...\n');

  // ─── 1. Users ───
  const teacher1 = await prisma.user.create({
    data: {
      email: 'teacher1@lumi.test',
      passwordHash: hash,
      displayName: 'Trần Quốc Nam',
      role: 'TEACHER',
    },
  });

  const teacher2 = await prisma.user.create({
    data: {
      email: 'teacher2@lumi.test',
      passwordHash: hash,
      displayName: 'Nguyễn Thị Hương',
      role: 'TEACHER',
    },
  });

  const students = await Promise.all(
    [
      { email: 'student1@lumi.test', name: 'Lê Hoàng My' },
      { email: 'student2@lumi.test', name: 'Trần Minh Khang' },
      { email: 'student3@lumi.test', name: 'Phạm Gia Hân' },
      { email: 'student4@lumi.test', name: 'Nguyễn Đức Anh' },
      { email: 'student5@lumi.test', name: 'Võ Thị Lan Anh' },
      { email: 'student6@lumi.test', name: 'Đỗ Quang Minh' },
      { email: 'student7@lumi.test', name: 'Bùi Thanh Tùng' },
      { email: 'student8@lumi.test', name: 'Hoàng Thị Mai' },
    ].map((s) =>
      prisma.user.create({
        data: {
          email: s.email,
          passwordHash: hash,
          displayName: s.name,
          role: 'STUDENT',
        },
      }),
    ),
  );
  console.log(`✅ Created ${2 + students.length} users`);

  // ─── 2. Classrooms ───
  const class1 = await prisma.classroom.create({
    data: {
      name: 'Toán 12A1',
      joinCode: 'TOAN12',
      ownerId: teacher1.id,
    },
  });

  const class2 = await prisma.classroom.create({
    data: {
      name: 'Toán 11A3',
      joinCode: 'TOAN11',
      ownerId: teacher1.id,
    },
  });

  const class3 = await prisma.classroom.create({
    data: {
      name: 'Ôn thi THPT Quốc gia',
      joinCode: 'ONTHI25',
      ownerId: teacher2.id,
    },
  });
  console.log('✅ Created 3 classrooms');

  // ─── 3. Classroom members ───
  // Class 1: all 8 students
  for (const s of students) {
    await prisma.classroomMember.create({
      data: { classroomId: class1.id, userId: s.id },
    });
  }
  // Class 2: first 5 students
  for (const s of students.slice(0, 5)) {
    await prisma.classroomMember.create({
      data: { classroomId: class2.id, userId: s.id },
    });
  }
  // Class 3: all 8 students
  for (const s of students) {
    await prisma.classroomMember.create({
      data: { classroomId: class3.id, userId: s.id },
    });
  }
  console.log('✅ Added students to classrooms');

  // ─── 4. Question categories ───
  const catLog = await prisma.questionCategory.create({
    data: { name: 'Hàm số mũ - Logarit', ownerId: teacher1.id },
  });
  const catPT = await prisma.questionCategory.create({
    data: { name: 'Phương trình Logarit', ownerId: teacher1.id },
  });
  const catGH = await prisma.questionCategory.create({
    data: { name: 'Giới hạn', ownerId: teacher1.id },
  });
  const catTH = await prisma.questionCategory.create({
    data: { name: 'Tổ hợp - Xác suất', ownerId: teacher1.id },
  });
  console.log('✅ Created 4 question categories');

  // ─── 5. Questions ───
  type QDef = {
    content: string;
    type: string;
    difficulty: 'EASY' | 'MEDIUM' | 'HARD';
    catId: string;
    options?: { content: string; isCorrect: boolean }[];
    correctAnswer?: string;
  };

  const questionDefs: QDef[] = [
    {
      content: 'Tập xác định của hàm số y = log₂(x − 1) là?',
      type: 'MCQ',
      difficulty: 'EASY',
      catId: catLog.id,
      options: [
        { content: '(−∞; 1)', isCorrect: false },
        { content: '(1; +∞)', isCorrect: true },
        { content: '[1; +∞)', isCorrect: false },
        { content: 'ℝ', isCorrect: false },
      ],
    },
    {
      content: 'Hàm số nào sau đây đồng biến trên ℝ?',
      type: 'MCQ',
      difficulty: 'EASY',
      catId: catLog.id,
      options: [
        { content: 'y = (1/2)ˣ', isCorrect: false },
        { content: 'y = 2ˣ', isCorrect: true },
        { content: 'y = −x²', isCorrect: false },
        { content: 'y = log₁/₂x', isCorrect: false },
      ],
    },
    {
      content: 'Nghiệm của phương trình 2ˣ = 8 là?',
      type: 'MCQ',
      difficulty: 'EASY',
      catId: catLog.id,
      options: [
        { content: 'x = 2', isCorrect: false },
        { content: 'x = 3', isCorrect: true },
        { content: 'x = 4', isCorrect: false },
        { content: 'x = 8', isCorrect: false },
      ],
    },
    {
      content: 'Giá trị của log₃27 bằng?',
      type: 'MCQ',
      difficulty: 'EASY',
      catId: catLog.id,
      options: [
        { content: '2', isCorrect: false },
        { content: '3', isCorrect: true },
        { content: '6', isCorrect: false },
        { content: '9', isCorrect: false },
      ],
    },
    {
      content: 'Hàm số y = 2ˣ đồng biến trên ℝ.',
      type: 'TRUE_FALSE',
      difficulty: 'EASY',
      catId: catLog.id,
      options: [
        { content: 'Đúng', isCorrect: true },
        { content: 'Sai', isCorrect: false },
      ],
    },
    {
      content: 'Khẳng định log₂8 = 4 là đúng hay sai?',
      type: 'TRUE_FALSE',
      difficulty: 'MEDIUM',
      catId: catLog.id,
      options: [
        { content: 'Đúng', isCorrect: false },
        { content: 'Sai', isCorrect: true },
      ],
    },
    {
      content: 'Giải phương trình log₂(x) + log₂(x − 2) = 3',
      type: 'ESSAY',
      difficulty: 'HARD',
      catId: catPT.id,
    },
    {
      content: 'Giải phương trình 3^(2x−1) = 27',
      type: 'SHORT_ANSWER',
      difficulty: 'MEDIUM',
      catId: catPT.id,
      correctAnswer: 'x = 2',
    },
    {
      content: 'Điền kết quả: lim(x→∞) (2x + 1)/(x − 3) = ...',
      type: 'SHORT_ANSWER',
      difficulty: 'EASY',
      catId: catGH.id,
      correctAnswer: '2',
    },
    {
      content: 'Cho hàm số f(x) = x³ − 3x + 2. Tìm các điểm cực trị của f(x).',
      type: 'ESSAY',
      difficulty: 'HARD',
      catId: catGH.id,
    },
    {
      content: 'Trong một lớp có 10 học sinh, cần chọn ra 3 học sinh để tham gia cuộc thi. Số cách chọn là?',
      type: 'MCQ',
      difficulty: 'MEDIUM',
      catId: catTH.id,
      options: [
        { content: '120', isCorrect: true },
        { content: '720', isCorrect: false },
        { content: '30', isCorrect: false },
        { content: '210', isCorrect: false },
      ],
    },
    {
      content: 'Gieo một đồng xu 3 lần. Xác suất để được ít nhất 1 mặt ngửa là?',
      type: 'MCQ',
      difficulty: 'MEDIUM',
      catId: catTH.id,
      options: [
        { content: '7/8', isCorrect: true },
        { content: '3/8', isCorrect: false },
        { content: '1/2', isCorrect: false },
        { content: '1/8', isCorrect: false },
      ],
    },
  ];

  const createdQuestions = [];
  for (const q of questionDefs) {
    const question = await prisma.question.create({
      data: {
        ownerId: teacher1.id,
        content: q.content,
        type: q.type,
        difficulty: q.difficulty,
        categoryId: q.catId,
        correctAnswer: q.correctAnswer,
        options: q.options
          ? {
              create: q.options.map((o, i) => ({
                content: o.content,
                isCorrect: o.isCorrect,
                position: i,
              })),
            }
          : undefined,
      },
      include: { options: true },
    });
    createdQuestions.push(question);
  }
  console.log(`✅ Created ${createdQuestions.length} questions`);

  // ─── 6. Exams ───
  // Exam 1: Published, with 5 MCQ questions
  const exam1 = await prisma.exam.create({
    data: {
      ownerId: teacher1.id,
      title: 'Kiểm tra 45 phút • Chương 3',
      description: 'Kiểm tra kiến thức Hàm số mũ và Logarit.',
      instructions:
        'Thời gian làm bài: 45 phút. Không sử dụng tài liệu. Chọn đáp án đúng nhất.',
      durationSeconds: 45 * 60,
      status: 'PUBLISHED',
      maxAttempts: 2,
      shuffleQuestions: true,
      shuffleOptions: true,
      showResultImmediately: true,
    },
  });

  // Add 5 questions to exam 1
  const mcqQuestions = createdQuestions.filter((q) =>
    ['MCQ', 'TRUE_FALSE'].includes(q.type),
  );
  for (let i = 0; i < Math.min(5, mcqQuestions.length); i++) {
    const q = mcqQuestions[i];
    await prisma.examQuestion.create({
      data: {
        examId: exam1.id,
        sourceQuestionId: q.id,
        position: i,
        points: 2,
        contentSnapshot: q.content,
        typeSnapshot: q.type,
        optionsSnapshot: q.options.map(
          (o: { id: string; content: string; isCorrect: boolean; position: number }) => ({
            id: o.id,
            content: o.content,
            isCorrect: o.isCorrect,
            position: o.position,
          }),
        ),
        correctAnswerSnapshot: q.correctAnswer,
        explanationSnapshot: q.explanation,
      },
    });
  }

  // Exam 2: Draft
  const exam2 = await prisma.exam.create({
    data: {
      ownerId: teacher1.id,
      title: 'Ôn tập Hàm số Logarit',
      description: 'Bài ôn tập cho kỳ thi giữa kỳ.',
      durationSeconds: 30 * 60,
      status: 'DRAFT',
      maxAttempts: 3,
      showResultImmediately: true,
    },
  });

  // Add questions to exam 2
  for (let i = 0; i < Math.min(4, mcqQuestions.length); i++) {
    const q = mcqQuestions[i];
    await prisma.examQuestion.create({
      data: {
        examId: exam2.id,
        sourceQuestionId: q.id,
        position: i,
        points: 2.5,
        contentSnapshot: q.content,
        typeSnapshot: q.type,
        optionsSnapshot: q.options.map(
          (o: { id: string; content: string; isCorrect: boolean; position: number }) => ({
            id: o.id,
            content: o.content,
            isCorrect: o.isCorrect,
            position: o.position,
          }),
        ),
        correctAnswerSnapshot: q.correctAnswer,
      },
    });
  }

  // Exam 3: Published exam by teacher2
  const exam3 = await prisma.exam.create({
    data: {
      ownerId: teacher2.id,
      title: 'Khảo sát hàm số',
      description: 'Đề thi thử THPT Quốc gia.',
      durationSeconds: 60 * 60,
      status: 'PUBLISHED',
      maxAttempts: 1,
      shuffleQuestions: true,
      showResultImmediately: false,
    },
  });

  for (let i = 0; i < Math.min(3, mcqQuestions.length); i++) {
    const q = mcqQuestions[i];
    await prisma.examQuestion.create({
      data: {
        examId: exam3.id,
        sourceQuestionId: q.id,
        position: i,
        points: 3,
        contentSnapshot: q.content,
        typeSnapshot: q.type,
        optionsSnapshot: q.options.map(
          (o: { id: string; content: string; isCorrect: boolean; position: number }) => ({
            id: o.id,
            content: o.content,
            isCorrect: o.isCorrect,
            position: o.position,
          }),
        ),
      },
    });
  }
  console.log('✅ Created 3 exams with questions');

  // ─── 7. Assignments ───
  const now = new Date();

  const assign1 = await prisma.assignment.create({
    data: {
      examId: exam1.id,
      classroomId: class1.id,
      dueAt: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
      status: 'ACTIVE',
    },
  });

  const assign2 = await prisma.assignment.create({
    data: {
      examId: exam3.id,
      classroomId: class3.id,
      dueAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      status: 'ACTIVE',
    },
  });
  console.log('✅ Created 2 assignments');

  // ─── 8. Exam attempts (simulate some students taking exam1) ───
  const exam1Questions = await prisma.examQuestion.findMany({
    where: { examId: exam1.id },
    include: { answers: true },
    orderBy: { position: 'asc' },
  });

  // Students 1-5 have taken exam1 and submitted
  for (let si = 0; si < 5; si++) {
    const student = students[si];
    const started = new Date(now.getTime() - (60 - si * 5) * 60 * 1000);
    const submitted = new Date(started.getTime() + (25 + si * 3) * 60 * 1000);
    const expires = new Date(started.getTime() + 45 * 60 * 1000);

    const attempt = await prisma.examAttempt.create({
      data: {
        examId: exam1.id,
        studentId: student.id,
        assignmentId: assign1.id,
        startedAt: started,
        expiresAt: expires,
        submittedAt: submitted,
        status: 'SUBMITTED',
      },
    });

    // Answer each question
    let totalEarned = 0;
    for (const eq of exam1Questions) {
      const opts = (eq.optionsSnapshot as Array<{
        id: string;
        content: string;
        isCorrect: boolean;
      }>) || [];
      const correctOpt = opts.find((o) => o.isCorrect);
      // Students 0-2 answer mostly correctly, 3-4 make more mistakes
      const correct = si < 3 ? Math.random() > 0.2 : Math.random() > 0.5;
      const selectedOpt = correct
        ? correctOpt
        : opts.find((o) => !o.isCorrect) || correctOpt;

      const earned = correct ? eq.points : 0;
      totalEarned += earned;

      await prisma.answer.create({
        data: {
          attemptId: attempt.id,
          examQuestionId: eq.id,
          answerPayload: { selectedOptionId: selectedOpt?.id },
          earnedPoints: earned,
        },
      });
    }

    // Calculate score as 0-10 scale
    const totalPoints = exam1Questions.reduce((s, q) => s + q.points, 0);
    const score10 = totalPoints > 0 ? (totalEarned / totalPoints) * 10 : 0;

    await prisma.examAttempt.update({
      where: { id: attempt.id },
      data: { score: Math.round(score10 * 100) / 100 },
    });
  }

  // Student 6 started but hasn't submitted (IN_PROGRESS)
  await prisma.examAttempt.create({
    data: {
      examId: exam1.id,
      studentId: students[5].id,
      assignmentId: assign1.id,
      startedAt: new Date(now.getTime() - 10 * 60 * 1000),
      expiresAt: new Date(now.getTime() + 35 * 60 * 1000),
      status: 'IN_PROGRESS',
    },
  });
  console.log('✅ Created 6 exam attempts (5 submitted, 1 in progress)');

  // ─── 9. Announcements ───
  await prisma.announcement.createMany({
    data: [
      {
        classroomId: class1.id,
        content:
          'Các em xem tài liệu ôn tập đã được đăng trong lớp và hoàn thành trước thứ Sáu. Nội dung sẽ bao gồm trong bài kiểm tra giữa kỳ.',
        createdAt: new Date(now.getTime() - 10 * 60 * 1000),
      },
      {
        classroomId: class1.id,
        content:
          'Bài kiểm tra 45 phút Chương 3 sẽ bắt đầu lúc 09:30. Các em chuẩn bị đầy đủ dụng cụ.',
        createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      },
      {
        classroomId: class2.id,
        content: 'Nhắc nhở: Bài tập hàm số sẽ hết hạn vào thứ Năm tuần này.',
        createdAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      },
    ],
  });
  console.log('✅ Created 3 announcements');

  // ─── 10. Notifications ───
  const notifData = [];
  for (const s of students) {
    notifData.push(
      {
        userId: s.id,
        type: 'NEW_ASSIGNMENT' as const,
        title: 'Bài kiểm tra mới đã được giao',
        body: 'Kiểm tra 45 phút • Chương 3 — Toán 12A1. Hạn nộp: 3 ngày.',
        link: '/dashboard/assignments',
        createdAt: new Date(now.getTime() - 5 * 60 * 1000),
      },
      {
        userId: s.id,
        type: 'ANNOUNCEMENT' as const,
        title: 'Thông báo từ lớp Toán 12A1',
        body: 'Thầy Nam đã đăng tài liệu ôn tập giữa kỳ.',
        link: `/dashboard/classrooms/${class1.id}`,
        createdAt: new Date(now.getTime() - 20 * 60 * 1000),
      },
      {
        userId: s.id,
        type: 'DEADLINE_REMINDER' as const,
        title: 'Nhắc hạn nộp bài',
        body: 'Bài tập Hàm số mũ và Logarit sẽ hết hạn sau 3 ngày.',
        link: '/dashboard/assignments',
        read: true,
        createdAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      },
    );
  }

  // Notifications for teacher1 (submission received)
  for (let i = 0; i < 5; i++) {
    notifData.push({
      userId: teacher1.id,
      type: 'SUBMISSION_RECEIVED' as const,
      title: `${students[i].displayName} đã nộp bài`,
      body: `Kiểm tra 45 phút • Chương 3 — Toán 12A1.`,
      link: '/dashboard/results',
      createdAt: new Date(now.getTime() - (30 + i * 5) * 60 * 1000),
    });
  }

  await prisma.notification.createMany({ data: notifData });
  console.log(`✅ Created ${notifData.length} notifications`);

  // ─── Summary ───
  console.log('\n🎉 Seed complete!\n');
  console.log('Accounts (password for all: "password123"):');
  console.log('  👨‍🏫 teacher1@lumi.test — Trần Quốc Nam (owns Toán 12A1, Toán 11A3)');
  console.log('  👨‍🏫 teacher2@lumi.test — Nguyễn Thị Hương (owns Ôn thi THPT)');
  console.log('  👩‍🎓 student1@lumi.test — Lê Hoàng My');
  console.log('  👩‍🎓 student2@lumi.test — Trần Minh Khang');
  console.log('  👩‍🎓 student3@lumi.test — Phạm Gia Hân');
  console.log('  👩‍🎓 student4@lumi.test — Nguyễn Đức Anh');
  console.log('  👩‍🎓 student5@lumi.test — Võ Thị Lan Anh');
  console.log('  👩‍🎓 student6@lumi.test — Đỗ Quang Minh');
  console.log('  👩‍🎓 student7@lumi.test — Bùi Thanh Tùng');
  console.log('  👩‍🎓 student8@lumi.test — Hoàng Thị Mai');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
