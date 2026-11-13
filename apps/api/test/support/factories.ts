import { TestApp, ApiResponse } from './app';

/**
 * Factory helpers. Every helper goes through the HTTP API (never Prisma), so
 * it keeps working when the schema changes. Each one fails loudly, with the
 * response body, if the API rejects the request.
 */

export interface Actor {
  id: string;
  email: string;
  displayName: string;
  role: 'TEACHER' | 'STUDENT';
  password: string;
  token: string;
  refreshToken: string;
}

export const DEFAULT_PASSWORD = 'Password123!';

let seq = 0;
/** Unique within the process and across runs. */
export function unique(prefix = 'u'): string {
  seq += 1;
  return `${prefix}${Date.now().toString(36)}${seq}`;
}

export function expectStatus(res: ApiResponse, expected: number | number[], what: string): void {
  const list = Array.isArray(expected) ? expected : [expected];
  if (!list.includes(res.status)) {
    throw new Error(
      `${what}: expected HTTP ${list.join(' or ')}, got ${res.status}: ${res.raw}`,
    );
  }
}

export async function registerUser(
  t: TestApp,
  role: 'TEACHER' | 'STUDENT',
  overrides: Partial<{ email: string; password: string; displayName: string }> = {},
): Promise<Actor> {
  const email = overrides.email ?? `${unique(role.toLowerCase())}@example.test`;
  const password = overrides.password ?? DEFAULT_PASSWORD;
  const displayName = overrides.displayName ?? `${role} ${seq}`;

  const reg = await t.post('/auth/register', {
    body: { email, password, displayName, role },
  });
  expectStatus(reg, [200, 201], 'register');

  // Always log in: works whether or not register itself returns tokens.
  const login = await t.post('/auth/login', { body: { email, password } });
  expectStatus(login, 200, 'login');

  return {
    id: login.data.user.id,
    email,
    displayName,
    role,
    password,
    token: login.data.accessToken,
    refreshToken: login.data.refreshToken,
  };
}

export const createTeacher = (t: TestApp, o = {}) => registerUser(t, 'TEACHER', o);
export const createStudent = (t: TestApp, o = {}) => registerUser(t, 'STUDENT', o);

export async function createClassroom(t: TestApp, teacher: Actor, name = unique('Lop ')) {
  const res = await t.post('/classrooms', { token: teacher.token, body: { name } });
  expectStatus(res, 201, 'create classroom');
  return res.data as { id: string; name: string; joinCode: string; ownerId: string };
}

export async function joinClassroom(t: TestApp, student: Actor, joinCode: string) {
  const res = await t.post('/classrooms/join', {
    token: student.token,
    body: { joinCode },
  });
  expectStatus(res, [200, 201], 'join classroom');
  return res.data;
}

export interface OptionInput {
  content: string;
  isCorrect: boolean;
  position: number;
}

/** Single-select MCQ with four options; option at index `correctIndex` is correct. */
export async function createMcqQuestion(
  t: TestApp,
  teacher: Actor,
  overrides: Partial<{ content: string; correctIndex: number; optionCount: number }> = {},
) {
  const count = overrides.optionCount ?? 4;
  const correctIndex = overrides.correctIndex ?? 0;
  const options: OptionInput[] = Array.from({ length: count }, (_, i) => ({
    content: `Dap an ${String.fromCharCode(65 + i)}`,
    isCorrect: i === correctIndex,
    position: i,
  }));
  return createQuestion(t, teacher, {
    type: 'MCQ',
    content: overrides.content ?? unique('Cau hoi '),
    options,
  });
}

export async function createQuestion(t: TestApp, teacher: Actor, body: Record<string, unknown>) {
  const res = await t.post('/questions', { token: teacher.token, body });
  expectStatus(res, 201, 'create question');
  return res.data as {
    id: string;
    type: string;
    content: string;
    options: Array<{ id: string; content: string; isCorrect: boolean; position: number }>;
  };
}

export async function createExam(
  t: TestApp,
  teacher: Actor,
  overrides: Record<string, unknown> = {},
) {
  const res = await t.post('/exams', {
    token: teacher.token,
    body: { title: unique('De thi '), durationSeconds: 600, ...overrides },
  });
  expectStatus(res, 201, 'create exam');
  return res.data as { id: string; status: string; [k: string]: any };
}

export async function addExamQuestion(
  t: TestApp,
  teacher: Actor,
  examId: string,
  questionId: string,
  position: number,
  points = 1,
) {
  const res = await t.post(`/exams/${examId}/questions`, {
    token: teacher.token,
    body: { questionId, points, position },
  });
  expectStatus(res, 201, 'add exam question');
  return res.data as { id: string; examId: string; points: number; position: number };
}

export async function publishExam(t: TestApp, teacher: Actor, examId: string) {
  const res = await t.post(`/exams/${examId}/publish`, { token: teacher.token });
  expectStatus(res, 200, 'publish exam');
  return res.data as {
    id: string;
    status: string;
    questions: Array<{
      id: string;
      points: number;
      position: number;
      contentSnapshot: string;
      optionsSnapshot: Array<{ id: string; content: string; isCorrect?: boolean; position: number }>;
    }>;
  };
}

export async function assignExam(
  t: TestApp,
  teacher: Actor,
  examId: string,
  classroomId: string,
  overrides: Record<string, unknown> = {},
) {
  const res = await t.post('/assignments', {
    token: teacher.token,
    body: { examId, classroomId, ...overrides },
  });
  expectStatus(res, 201, 'create assignment');
  return res.data as { id: string; examId: string; classroomId: string; [k: string]: any };
}

export function startAttempt(
  t: TestApp,
  student: Actor,
  examId: string,
  assignmentId?: string,
  extra: Record<string, unknown> = {},
) {
  return t.post('/attempts/start', {
    token: student.token,
    body: { examId, ...(assignmentId && { assignmentId }), ...extra },
  });
}

/** Saves a single-select answer. One place to change if the payload shape changes. */
export function saveAnswer(
  t: TestApp,
  student: Actor,
  attemptId: string,
  examQuestionId: string,
  selectedOptionId: string,
) {
  return t.post(`/attempts/${attemptId}/answer`, {
    token: student.token,
    body: { examQuestionId, selectedOptionId },
  });
}

/** Saves an answer with any payload shape: {selectedOptionId} | {selectedOptionIds} | {text}. */
export function saveAnswerBody(
  t: TestApp,
  student: Actor,
  attemptId: string,
  examQuestionId: string,
  payload: Record<string, unknown>,
) {
  return t.post(`/attempts/${attemptId}/answer`, {
    token: student.token,
    body: { examQuestionId, ...payload },
  });
}

export function submitAttempt(t: TestApp, student: Actor, attemptId: string) {
  return t.post(`/attempts/${attemptId}/submit`, { token: student.token });
}

export interface ExamScenario {
  teacher: Actor;
  student: Actor;
  classroom: { id: string; joinCode: string };
  exam: Awaited<ReturnType<typeof publishExam>>;
  assignment: { id: string };
  /** Per exam question: its id, points, and the ids of the correct and one wrong option. */
  questions: Array<{ examQuestionId: string; points: number; correctOptionId: string; wrongOptionId: string }>;
}

/**
 * The full legitimate setup: a teacher with a classroom, a student who is a
 * member, a published MCQ exam and an assignment of that exam to the
 * classroom. Tests that start an attempt always pass the assignment id, so
 * they stay valid once start-attempt enforcement (module E) is implemented.
 */
export async function createExamScenario(
  t: TestApp,
  opts: Partial<{ questionCount: number; points: number[]; exam: Record<string, unknown>; assignment: Record<string, unknown> }> = {},
): Promise<ExamScenario> {
  const questionCount = opts.questionCount ?? 2;
  const teacher = await createTeacher(t);
  const student = await createStudent(t);
  const classroom = await createClassroom(t, teacher);
  await joinClassroom(t, student, classroom.joinCode);

  const draft = await createExam(t, teacher, opts.exam ?? {});
  const sources: Array<Awaited<ReturnType<typeof createMcqQuestion>>> = [];
  for (let i = 0; i < questionCount; i++) {
    const q = await createMcqQuestion(t, teacher, { correctIndex: i % 4 });
    sources.push(q);
    await addExamQuestion(t, teacher, draft.id, q.id, i, opts.points?.[i] ?? 1);
  }
  const exam = await publishExam(t, teacher, draft.id);
  const assignment = await assignExam(t, teacher, exam.id, classroom.id, opts.assignment ?? {});

  // Correct answers come from the teacher's own question bank response, not
  // from anything a student can see.
  const ordered = [...exam.questions].sort((a, b) => a.position - b.position);
  const questions = ordered.map((eq, i) => {
    const src = sources[i];
    const correct = src.options.find((o) => o.isCorrect)!;
    const wrong = src.options.find((o) => !o.isCorrect)!;
    return {
      examQuestionId: eq.id,
      points: eq.points,
      correctOptionId: correct.id,
      wrongOptionId: wrong.id,
    };
  });

  return { teacher, student, classroom, exam, assignment, questions };
}

export interface MixedScenario {
  teacher: Actor;
  student: Actor;
  classroom: { id: string; joinCode: string };
  examId: string;
  assignment: { id: string };
  /** Exam question ids and option ids, keyed by question type. */
  mcq: { eqId: string; correct: string; wrong: string };
  multi: { eqId: string; correct: string[]; wrong: string[] };
  trueFalse: { eqId: string; correct: string; wrong: string };
  short: { eqId: string };
  fill: { eqId: string };
  essay: { eqId: string };
}

/**
 * A published exam with one question of each type, 1 point each unless
 * `points` says otherwise, in the order MCQ, MCQ_MULTI (3 correct of 4),
 * TRUE_FALSE, SHORT_ANSWER ("Hà Nội, Ha Noi"), FILL_BLANK ("42"), ESSAY.
 */
export async function createMixedScenario(
  t: TestApp,
  opts: Partial<{ exam: Record<string, unknown>; points: number[] }> = {},
): Promise<MixedScenario> {
  const teacher = await createTeacher(t);
  const student = await createStudent(t);
  const classroom = await createClassroom(t, teacher);
  await joinClassroom(t, student, classroom.joinCode);
  const draft = await createExam(t, teacher, opts.exam ?? {});

  const opt = (content: string, isCorrect: boolean, position: number) => ({
    content,
    isCorrect,
    position,
  });
  const sources = [
    await createMcqQuestion(t, teacher, { correctIndex: 1 }),
    await createQuestion(t, teacher, {
      type: 'MCQ_MULTI',
      content: unique('Nhieu dap an '),
      options: [opt('A', true, 0), opt('B', true, 1), opt('C', true, 2), opt('D', false, 3)],
    }),
    await createQuestion(t, teacher, {
      type: 'TRUE_FALSE',
      content: unique('Dung sai '),
      options: [opt('Dung', true, 0), opt('Sai', false, 1)],
    }),
    await createQuestion(t, teacher, {
      type: 'SHORT_ANSWER',
      content: unique('Thu do '),
      correctAnswer: 'Hà Nội, Ha Noi',
      explanation: 'Giai thich bi mat',
    }),
    await createQuestion(t, teacher, {
      type: 'FILL_BLANK',
      content: unique('Dien so '),
      correctAnswer: '42',
    }),
    await createQuestion(t, teacher, { type: 'ESSAY', content: unique('Tu luan ') }),
  ];
  const eqIds: string[] = [];
  for (let i = 0; i < sources.length; i++) {
    const eq = await addExamQuestion(t, teacher, draft.id, sources[i].id, i, opts.points?.[i] ?? 1);
    eqIds.push(eq.id);
  }
  await publishExam(t, teacher, draft.id);
  const assignment = await assignExam(t, teacher, draft.id, classroom.id);

  const ids = (i: number, correct: boolean) =>
    sources[i].options.filter((o) => o.isCorrect === correct).map((o) => o.id);
  return {
    teacher,
    student,
    classroom,
    examId: draft.id,
    assignment,
    mcq: { eqId: eqIds[0], correct: ids(0, true)[0], wrong: ids(0, false)[0] },
    multi: { eqId: eqIds[1], correct: ids(1, true), wrong: ids(1, false) },
    trueFalse: { eqId: eqIds[2], correct: ids(2, true)[0], wrong: ids(2, false)[0] },
    short: { eqId: eqIds[3] },
    fill: { eqId: eqIds[4] },
    essay: { eqId: eqIds[5] },
  };
}
