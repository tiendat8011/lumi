# Design: Implement all missing features (20261112-implement-missing-features)

Author: architect. Status: draft for review by qa-engineer and orchestrator.
Section 6 goes to the business analyst.

Legend: **[V]** verified in code or database, **[A]** assumption, **[R]** recommendation.

## Summary

About 35 features across 9 modules are specified and not built. They share
four things the code does not have: a place to store files, a way to send
mail, a single grading path, and an attempt lifecycle that is safe under
concurrency. This design puts those four into one sequential Package 0, with
one additive migration, and then splits the rest into eight backend and nine
frontend packages that own disjoint files.

The main design choices:

- **One grading engine** (`modules/grading`) used by submit, lazy auto-submit,
  regrade and manual grading. It writes `Answer.earnedPoints` and derives the
  attempt score from the stored values, so every path produces the same score
  by construction.
- **One attempt lifecycle service** that owns every state transition of an
  attempt. A transaction-scoped advisory lock serialises "start" per student
  and exam; a partial unique index guarantees one IN_PROGRESS attempt; a row
  lock (`FOR UPDATE` on submit, `FOR SHARE` on save) guarantees that no answer
  changes after grading.
- **One result-visibility function**, applied by every endpoint that returns a
  score, feedback or an answer key to a student.
- **Files go through the API**, not presigned URLs (ruling D3). One private
  MinIO bucket, three key prefixes.
- **Notifications are called through one facade**, after the triggering
  transaction commits, deduplicated by a unique key.
- No Redis, no queue. One in-process cron, for reminders only (ruling D2).

Six findings need a ruling before developers start (section 6, B1 to B6).

## 1. Current state and risks

All paths are under `apps/api/src` unless stated. All statements here are [V].

### Attempts (`modules/attempts/attempts.service.ts`)

| # | Fact | Where |
|---|---|---|
| C1 | `start()` checks exam status, window and attempt count only. No membership, assignment, target, access code or `dueAt` check. | `:16-70` |
| C2 | The attempt count runs before the IN_PROGRESS lookup, so with `maxAttempts = 1` a student cannot resume their own attempt. | `:33-49` |
| C3 | Count, lookup and create are three separate statements with no transaction and no constraint. Two concurrent starts create two IN_PROGRESS attempts. | `:33-67` |
| C4 | `assignmentId` from the client is stored without checking that it exists or belongs to the exam. | `:63` |
| C5 | `saveAnswer` does not check that `examQuestionId` belongs to the attempt's exam or that the option exists, and it stores only `{selectedOptionId}`. | `:89-105`, `dto/save-answer.dto.ts` |
| C6 | `saveAnswer` reads the status, then upserts, with no lock. A save that races a submit can change an answer after it was graded. | `:73-105` |
| C7 | `submit()` opens a transaction but reads the attempt with a plain `findUnique`. Two concurrent submits both grade. AD-08 requires `SELECT ... FOR UPDATE`. | `:118-132` |
| C8 | `getResult` has no ownership check, and the controller route has no role. Any authenticated user can read any attempt, including `optionsSnapshot` with `isCorrect`. | `:149-169`, `attempts.controller.ts:64-67` |
| C9 | `getAttemptWithQuestions` returns `optionsSnapshot` unfiltered, so `isCorrect` reaches the student during the attempt. | `:393-414` |
| C10 | `getAnswerReview` does not check the attempt status. A student with `showResultImmediately = true` can call it while IN_PROGRESS and receive `correctOptionId` for every question. | `:171-216` |
| C11 | `gradeAndSubmit` grades single-select only and computes the score in floating point before rounding. | `:334-391` |
| C12 | `getMyAttempts` always returns `score`; visibility is left to the browser. | `:108-116` |
| C13 | `updateScore` and feedback do not require a SUBMITTED attempt. `updateAnswerFeedback` exists but no route calls it. | `:235-275` |

### Other modules

| # | Fact | Where |
|---|---|---|
| C14 | `ExamQuestion` has no snapshot of question type, `correctAnswer`, image or explanation. `publish()` copies content and options only, skips questions whose source was deleted, and validates nothing. | `prisma/schema.prisma:225-240`, `modules/exams/exams.service.ts:125-162` |
| C15 | `publish()`, `addQuestion()` and `removeQuestion()` check DRAFT and then write, with no lock on the exam. A question added during publish ends up in a PUBLISHED exam with a null snapshot. | `exams.service.ts:94-162` |
| C16 | `regrade()` duplicates the grading loop and loads the Decimal class with `require` inside the loop. | `exams.service.ts:172-220` |
| C17 | `gradingMode` exists in the schema and in neither exam DTO. | `modules/exams/dto/*.ts` |
| C18 | `GET /assignments/:id` has no ownership or membership check and returns the whole exam, including `accessCode`. | `modules/assignments/assignments.controller.ts:37-40`, `assignments.service.ts:72-81` |
| C19 | Creating a duplicate assignment hits the unique constraint and surfaces as HTTP 500. | `assignments.service.ts:34-41` |
| C20 | `GET /classrooms/:id` and `GET /classrooms/:id/members` have no ownership or membership check; the first returns `joinCode`. | `modules/classrooms/classrooms.controller.ts:49-52,102-105` |
| C21 | `GET /analytics/students/:id/performance` lets any teacher read any student. `students/me/performance` returns scores regardless of result visibility. | `modules/analytics/analytics.controller.ts:46-56` |
| C22 | `register()` returns no tokens; `RegisterDto` accepts `ADMIN`. | `modules/auth/auth.service.ts:26-41`, `dto/register.dto.ts:16-17` |
| C23 | `forgotPassword()` always returns the raw token. `resetPassword()` does not revoke refresh tokens. `refresh()` does find-then-delete, so two concurrent refreshes with one token make the second throw a 500. | `auth.service.ts:86-143` |
| C24 | `NotificationsService.create/createMany` have no caller. | `modules/notifications/notifications.service.ts:9-26` |
| C25 | `TransformInterceptor` wraps every return value; there is no path for a file response. | `common/interceptors/transform.interceptor.ts:23-35` |
| C26 | Error codes work today only if the service throws `new XException({code, message})`; the filter reads `code` from the response object. Almost no service does. | `common/filters/http-exception.filter.ts:26-33` |
| C27 | The web client sets `Content-Type: application/json` on every request and discards the error code. | `apps/web/src/lib/api.ts:71-74,91-94` |
| C28 | `modules/grading/` is empty. No storage, mail, scheduler or test files exist. | directory listing |

### Dev database (read-only check, 2026-11-12)

`lumi_dev` holds 3 users, 0 exams, 0 attempts, 0 answers, 0 question groups,
0 users whose email differs from its lower-case form. The migration below is
therefore a no-op on existing rows there. The backfill statements are kept for
any other environment.

### Risks carried by the current code if left alone

1. Answer keys leak through three endpoints (C8, C9, C10). This is the highest
   risk and is fixed in Package 0.
2. Scores can disagree with answers (C6, C7).
3. A student can sit an exam they were never assigned (C1).

## 2. Schema

One migration, `apps/api/prisma/migrations/<ts>_missing_features/`. Every
change is additive: new nullable columns, new columns with defaults, new
tables, new indexes, one new enum value. Nothing is dropped, renamed or
retyped.

### 2.1 Changed models

Only added lines are shown; existing fields stay as they are.

```prisma
model User {
  // added columns
  isActive                  Boolean @default(true) @map("is_active")                     // A6
  emailNotificationsEnabled Boolean @default(true) @map("email_notifications_enabled")   // J4
  createdByTeacherId        String? @map("created_by_teacher_id") @db.Uuid               // A7, B10

  // added relations
  createdByTeacher  User?              @relation("CreatedStudents", fields: [createdByTeacherId], references: [id], onDelete: SetNull)
  createdStudents   User[]             @relation("CreatedStudents")
  questionGroups    QuestionGroup[]
  assignmentTargets AssignmentTarget[]

  @@index([createdByTeacherId])
}

model Announcement {
  @@index([classroomId, createdAt])                                                      // B5, B7
}

model Question {
  @@index([ownerId])                                                                     // C13, D10: no index on owner today
}

model QuestionGroup {
  description String?                                                                    // C12
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @default(now()) @updatedAt @map("updated_at")

  owner User @relation(fields: [ownerId], references: [id], onDelete: Cascade)

  @@index([ownerId])
}

model Exam {
  allowFileSubmission Boolean @default(false) @map("allow_file_submission")              // F7 OQ-01 (c)
}

model ExamQuestion {
  typeSnapshot          String? @map("type_snapshot")                                    // G7-BR-09
  correctAnswerSnapshot String? @map("correct_answer_snapshot")                          // G1 SHORT_ANSWER, FILL_BLANK
  imageUrlSnapshot      String? @map("image_url_snapshot")                               // PD-06
  explanationSnapshot   String? @map("explanation_snapshot")                             // review, preview
}

model Assignment {
  reminderIntervals Json? @default("[\"24h\",\"1h\"]") @map("reminder_intervals")        // J5

  targets           AssignmentTarget[]
  attachments       AssignmentAttachment[]
  deadlineReminders DeadlineReminder[]

  @@index([classroomId])
}

model ExamAttempt {
  submissionFiles SubmissionFile[]

  @@index([assignmentId])
  // plus the partial unique index in 2.3, which Prisma cannot express
}

model Answer {
  earnedPoints   Decimal? @map("earned_points") @db.Decimal(10, 4)                       // F8, see finding B1
  manuallyGraded Boolean  @default(false) @map("manually_graded")                        // F8 OQ-04, see finding B3
}

enum NotificationType {
  NEW_ASSIGNMENT
  SUBMISSION_RECEIVED
  GRADING_COMPLETE
  RESULTS_RELEASED
  ANNOUNCEMENT
  DEADLINE_REMINDER                                                                      // J5
}

model Notification {
  dedupeKey String? @map("dedupe_key")                                                   // J1 rule 2

  @@unique([userId, dedupeKey])
  @@index([userId, createdAt])
}
```

### 2.2 New models

```prisma
// D11
model AssignmentTarget {
  id           String @id @default(uuid()) @db.Uuid
  assignmentId String @map("assignment_id") @db.Uuid
  studentId    String @map("student_id") @db.Uuid

  assignment Assignment @relation(fields: [assignmentId], references: [id], onDelete: Cascade)
  student    User       @relation(fields: [studentId], references: [id], onDelete: Cascade)

  @@unique([assignmentId, studentId])
  @@index([studentId])
  @@map("assignment_targets")
}

// F6
model AssignmentAttachment {
  id           String   @id @default(uuid()) @db.Uuid
  assignmentId String   @map("assignment_id") @db.Uuid
  filename     String
  storageKey   String   @unique @map("storage_key")
  size         Int
  mimeType     String   @map("mime_type")
  uploadedAt   DateTime @default(now()) @map("uploaded_at")

  assignment Assignment @relation(fields: [assignmentId], references: [id], onDelete: Cascade)

  @@index([assignmentId])
  @@map("assignment_attachments")
}

// F7
model SubmissionFile {
  id           String   @id @default(uuid()) @db.Uuid
  attemptId    String   @map("attempt_id") @db.Uuid
  storageKey   String   @unique @map("storage_key")
  originalName String   @map("original_name")
  mimeType     String   @map("mime_type")
  sizeBytes    Int      @map("size_bytes")
  uploadedAt   DateTime @default(now()) @map("uploaded_at")

  attempt ExamAttempt @relation(fields: [attemptId], references: [id], onDelete: Cascade)

  @@unique([attemptId, originalName])
  @@map("submission_files")
}

// J5
model DeadlineReminder {
  id             String   @id @default(uuid()) @db.Uuid
  assignmentId   String   @map("assignment_id") @db.Uuid
  interval       String
  sentAt         DateTime @default(now()) @map("sent_at")
  recipientCount Int      @map("recipient_count")

  assignment Assignment @relation(fields: [assignmentId], references: [id], onDelete: Cascade)

  @@unique([assignmentId, interval])
  @@map("deadline_reminders")
}
```

### 2.3 SQL appended by hand to the generated migration

```sql
-- One IN_PROGRESS attempt per student and exam (E1-OQ-01 option B).
CREATE UNIQUE INDEX "exam_attempts_one_in_progress"
  ON "exam_attempts" ("exam_id", "student_id")
  WHERE "status" = 'IN_PROGRESS';

-- Backfill snapshots for exams published before this migration.
UPDATE "exam_questions" eq
SET "type_snapshot"           = q."type",
    "correct_answer_snapshot" = q."correct_answer",
    "image_url_snapshot"      = q."image_url",
    "explanation_snapshot"    = q."explanation"
FROM "questions" q, "exams" e
WHERE q."id" = eq."source_question_id"
  AND e."id" = eq."exam_id"
  AND e."status" <> 'DRAFT'
  AND eq."type_snapshot" IS NULL;

-- Published questions whose source was deleted: infer the type from the options.
UPDATE "exam_questions" eq
SET "type_snapshot" = CASE
      WHEN (SELECT count(*) FROM jsonb_array_elements(eq."options_snapshot") o
            WHERE (o->>'isCorrect')::boolean) > 1 THEN 'MCQ_MULTI'
      ELSE 'MCQ' END
FROM "exams" e
WHERE e."id" = eq."exam_id"
  AND e."status" <> 'DRAFT'
  AND eq."type_snapshot" IS NULL
  AND jsonb_typeof(eq."options_snapshot") = 'array';
```

### 2.4 Safety of each change on a database with rows

| Change | Additive | Effect on existing rows | Backfill |
|---|---|---|---|
| `users.is_active`, `email_notifications_enabled` | Yes | Default `true` | None |
| `users.created_by_teacher_id` + FK + index | Yes | NULL = self-registered | None |
| `question_groups` columns, FK to users, index | Yes | Timestamps default to now. The FK fails if a group row has an owner that is not a user. | None. Table is empty in dev [V]; no endpoint ever wrote to it. |
| `exams.allow_file_submission` | Yes | Default `false` | None |
| `exam_questions.*_snapshot` | Yes | NULL | 2.3. The backfill reads the live question, which may have been edited since publish. That is the best available source; the engine falls back to inferring from options when the type is NULL. |
| `assignments.reminder_intervals` | Yes | Default `["24h","1h"]`. Existing ACTIVE assignments with a future `dueAt` start to receive reminders. Intended. | None |
| `answers.earned_points`, `manually_graded` | Yes | NULL / `false` | Script, 2.5 |
| `notifications.dedupe_key` + unique | Yes | NULL; PostgreSQL treats NULLs as distinct, so existing rows never collide | None |
| `NotificationType` + `DEADLINE_REMINDER` | Yes | None. `ALTER TYPE ... ADD VALUE` is allowed in a transaction on PostgreSQL 16 as long as the value is not used in the same transaction; it is not. | None |
| Partial unique index | Yes | Fails if two IN_PROGRESS attempts exist for one student and exam. Dev has none [V]. For any other database, run the check query in 2.5 first. | Manual, if the check finds rows |
| Four new tables, plain indexes | Yes | None | None |

### 2.5 How the developer creates and applies it

1. Edit `schema.prisma`. Run
   `npm run prisma:migrate:dev --workspace=apps/api -- --create-only --name missing_features`.
2. Append the SQL in 2.3 to the generated `migration.sql`. Read the file: it
   must contain no `DROP`, no `ALTER COLUMN ... TYPE`, no `RENAME`.
3. Before applying to a database that has attempts, run:
   `SELECT exam_id, student_id, count(*) FROM exam_attempts WHERE status = 'IN_PROGRESS' GROUP BY 1, 2 HAVING count(*) > 1;`
   Any row returned must be resolved by submitting the older attempt, not by deleting it.
4. Apply with `prisma migrate dev`. If Prisma offers to reset the database, stop and report (ruling D7).
5. Run `prisma migrate dev` a second time. It must report that the schema is
   in sync. If it generates a migration that drops `exam_attempts_one_in_progress`,
   stop and report; see section 9.
6. Run the one-off script `apps/api/prisma/backfill-earned-points.ts` (Package 0).
   For every SUBMITTED attempt it runs the grading engine and writes
   `earnedPoints` on answers where it is NULL. It never changes `score` or
   `manuallyGraded`. It is idempotent.

## 3. Shared infrastructure

Everything in this section is built in Package 0. Later packages call it and
do not edit it.

### 3.1 New and changed files

```text
apps/api/src/
  main.ts                                   edit: multipart plugin, validation error code
  app.module.ts                             edit: register every new module once (see 7.1)
  config/app.config.ts                      edit: new optional env vars
  common/
    errors/app-error.ts                     fail(status, code, message) -> HttpException({code, message})
    filters/http-exception.filter.ts        edit: map Prisma P2002 -> 409, P2025 -> 404
    interceptors/transform.interceptor.ts   edit: pass StreamableFile through unwrapped
    db/locks.ts                             row-lock and advisory-lock helpers (3.3)
    csv/csv.util.ts                         toCsv(), parseCsv(), csvDownload()
    utils/text.ts                           slugify(), normalizeAnswerText()
    utils/datetime.ts                       formatVn(date, 'date' | 'datetime'), Asia/Ho_Chi_Minh
    pipes/uuid.pipe.ts                      ParseUUIDPipe preset that fails with VALIDATION_ERROR
  modules/
    storage/   storage.module.ts, storage.service.ts, upload.util.ts, uploads.controller.ts
    mail/      mail.module.ts, mail.service.ts
    grading/   grading.module.ts, grading-engine.ts, grading.service.ts,
               attempt-lifecycle.service.ts, result-visibility.ts, question-view.ts
    notifications/ notification-events.service.ts (new), notifications.service.ts (edit)
    users/     student-accounts.service.ts (new)
    question-bank/ question-validation.ts, question-selection.service.ts (new)
apps/api/prisma/
  backfill-earned-points.ts, create-admin.ts
```

### 3.2 Conventions every package follows

- **Errors.** Throw `fail(status, 'CODE', 'Thông báo tiếng Việt')`. The filter
  already copies `code` into the envelope (`http-exception.filter.ts:29`).
  `ValidationPipe` gets an `exceptionFactory` so DTO failures carry
  `VALIDATION_ERROR` instead of `BAD_REQUEST`.
- **IDs.** Every `:id` path parameter goes through the UUID pipe. Today a
  malformed id reaches Prisma and returns 500.
- **Authorization.** `@Roles()` on the route, ownership or membership in the
  service, as now. The only `@Public()` routes added are
  `GET /uploads/images/:key` (question images, 3.5).
- **Pagination.** `PaginationQueryDto` and `paginate()` as in
  `questions.service.ts:105-115`. The interceptor already hoists `meta`.
- **File responses.** A controller returns
  `csvDownload(filename, content)` or `fileDownload(...)`, both of which
  return a Nest `StreamableFile` with `type` and `disposition` set. The
  interceptor gains one line: `if (data instanceof StreamableFile) return data;`.
  Errors thrown before the return still go through the filter and produce the
  normal error envelope. `@Res()` is not used, so interceptors and filters
  keep working. `Content-Disposition` always carries both forms:
  `filename="<ascii slug>"; filename*=UTF-8''<percent-encoded original>`.
  This satisfies the specs that want an ASCII name (F10-BR-09, H8-BR-08) and
  the ones that want Vietnamese characters preserved (G9-BR-09, B10-BR-14).
- **CSV.** UTF-8 with BOM, CRLF, every text cell quoted, a leading `'` added
  to cells starting with `=`, `+`, `-`, `@`. Dates in `Asia/Ho_Chi_Minh`,
  `DD/MM/YYYY HH:mm` (finding M8). Headers in Vietnamese with diacritics.
- **Notifications.** Called after the transaction commits, never inside it,
  wrapped so a failure is logged and not rethrown (A-J1-01).

### 3.3 Lock helpers (`common/db/locks.ts`)

All take the transaction client and use `$queryRaw`. They are the only place
raw locking SQL lives.

| Helper | SQL | Used by |
|---|---|---|
| `lockAttempt(tx, id)` | `SELECT ... FROM exam_attempts WHERE id = $1 FOR UPDATE` | submit, auto-submit, manual grade, score override, file upload and delete |
| `shareAttempt(tx, id)` | `... FOR SHARE` | save answer |
| `lockExam(tx, id)` | `SELECT ... FROM exams WHERE id = $1 FOR UPDATE` | publish, archive, add, remove, inline create, generate |
| `lockAssignment(tx, id)` | `SELECT ... FROM assignments WHERE id = $1 FOR UPDATE` | update, targets, attachments, reminder dispatch |
| `lockUser(tx, id)` | `SELECT ... FROM users WHERE id = $1 FOR UPDATE` | student-creation limit, disable account |
| `lockStart(tx, studentId, examId)` | `SELECT pg_advisory_xact_lock(hashtextextended($1 \|\| ':' \|\| $2, 0))` | attempt start |

### 3.4 Grading engine (`modules/grading`)

`grading-engine.ts` is pure: no Prisma, no clock. It is the unit-test target.

```ts
type SnapshotQuestion = {
  id: string; points: number;
  type: QuestionType | null;            // typeSnapshot
  options: { id: string; isCorrect: boolean }[] | null;
  correctAnswer: string | null;         // correctAnswerSnapshot
};
type AnswerPayload = { selectedOptionId?: string; selectedOptionIds?: string[]; text?: string };

// Returns earned points (4 decimal places, ROUND_HALF_UP), or null when a human must grade.
gradeAnswer(q: SnapshotQuestion, payload: AnswerPayload | null, mode: GradingMode): Decimal | null;

// (sum of earned, null counted as 0) / totalPoints * 10, 2 decimal places, ROUND_HALF_UP. 0 when totalPoints is 0.
computeScore(earned: (Decimal | null)[], totalPoints: number): Decimal;
```

| Type | Rule |
|---|---|
| MCQ, TRUE_FALSE | Full points if `selectedOptionId` is the option with `isCorrect`; else 0. |
| MCQ_MULTI, ALL_OR_NOTHING | Full points if the selected set equals the correct set; else 0. |
| MCQ_MULTI, PARTIAL | `max(0, correctSelected - incorrectSelected) / totalCorrect * points` (ruling D5). 0 when `totalCorrect` is 0. |
| SHORT_ANSWER, FILL_BLANK | Split `correctAnswer` on commas. Full points if the student's text equals any part after `normalizeAnswerText`: Unicode NFC, trim, collapse inner whitespace, lower-case. Else 0. |
| ESSAY | Non-empty text: `null` (needs grading). Empty or no answer: 0. |
| No answer row, or an empty payload | 0 for every type. |
| `type` is NULL (legacy snapshot) | Infer: more than one correct option is MCQ_MULTI; options present is MCQ; no options and a `correctAnswer` is SHORT_ANSWER; otherwise ESSAY. |
| MCQ_MULTI with a legacy `{selectedOptionId}` payload | Treated as a one-element selection. |

All arithmetic is in `Decimal`. The current code multiplies floats first
(`attempts.service.ts:374`), which is what makes ROUND_HALF_UP unreliable.

`grading.service.ts`:

```ts
// Grades every answer of one attempt and writes earnedPoints. Caller holds lockAttempt.
// preserveManual = true keeps answers where manuallyGraded is true (regrade).
gradeAttempt(tx, attemptId, opts: { preserveManual: boolean }): Promise<{ score: Decimal; pending: number }>;

// Re-reads stored earnedPoints and returns the score. Used after a manual grade.
recalculateScore(tx, attemptId): Promise<{ score: Decimal; graded: number; total: number }>;
```

`gradeAttempt` issues one `UPDATE answers ... FROM (VALUES ...)` per attempt,
not one statement per answer, so a regrade of 1,000 attempts is about 3,000
statements.

**Invariant: the attempt score always equals `computeScore` over the stored
`earnedPoints`, unless `manualScoreOverride` is true.** Submit, auto-submit,
regrade and manual grading all end by calling `computeScore` over the same
stored values, which is what protects it.

`graded` and `total` (F8 `gradingProgress`): `total` is the number of exam
questions; `graded` is `total` minus the number of answers whose
`earnedPoints` is NULL. A question with no answer row is graded, at 0.

### 3.5 Attempt lifecycle (`attempt-lifecycle.service.ts`)

The only code that moves an attempt out of IN_PROGRESS.

```ts
// Caller holds lockAttempt. Grades, sets SUBMITTED, submittedAt = min(now, expiresAt), score.
finalize(tx, attempt, now): Promise<ExamAttempt>;

// Own transaction: lockAttempt, re-check IN_PROGRESS and now > expiresAt, finalize. No-op otherwise.
submitIfExpired(attemptId): Promise<void>;

// Lazy expiry for teacher-facing reads. Finds IN_PROGRESS attempts past expiresAt in scope and
// calls submitIfExpired for each. Returns how many were submitted.
sweepExpired(scope: { examId: string } | { assignmentId: string } | { classroomId: string }): Promise<number>;
```

`sweepExpired` is how lazy expiry (AD-06, AD-11) reaches results, exports,
tracking and analytics without a scheduler: each of those endpoints calls it
first. After a successful `finalize` commit the service calls
`events.attemptSubmitted(attemptId)`.

### 3.6 Result visibility (`result-visibility.ts`) and question view (`question-view.ts`)

```ts
canStudentSeeResults(
  exam: { showResultImmediately: boolean; resultsReleased: boolean },
  assignment: { hideResults: boolean } | null,
): boolean
// = (showResultImmediately || resultsReleased) && !(assignment?.hideResults)

// For list endpoints: returns the attempt with score and feedback nulled and resultsHidden = true when not visible.
maskAttemptForStudent(attempt): MaskedAttempt

// The only serializer for a question shown to a student during an attempt.
// Drops isCorrect, correctAnswerSnapshot, explanationSnapshot; applies option shuffle.
toStudentQuestion(eq: ExamQuestion, attemptId: string, shuffleOptions: boolean): StudentQuestion
```

Every endpoint that returns a score, feedback, earned points or an answer key
to a STUDENT calls one of the first two. The list is in 4.5; the reviewer
should check each one.

Option shuffle is deterministic: options of MCQ and MCQ_MULTI questions are
sorted by `sha256(attemptId + ':' + optionId)`. The order is stable across
resume, refresh and tabs with no extra column. TRUE_FALSE keeps its authored
order.

### 3.7 Storage (`modules/storage`)

- Client: the `minio` package against one private bucket, `MINIO_BUCKET`
  (default `lumi`), created on boot if absent.
- Key prefixes: `question-images/{uuid}.{ext}`, `assignments/{assignmentId}/{uuid}.{ext}`,
  `submissions/{attemptId}/{uuid}.{ext}`.
- `StorageService`: `put(key, buffer, mimeType)`, `getStream(key)`,
  `remove(key)`, `isConfigured()`. When `MINIO_ENDPOINT` is unset or MinIO is
  unreachable, every method fails with 503 `STORAGE_UNAVAILABLE`. The API
  still boots, so the user's running dev server is not broken by this change.
- `upload.util.ts`: `readUpload(req, { maxBytes, allowed })` reads one file
  from a multipart request into a buffer and checks, in order: size
  (`FILE_TOO_LARGE`), extension against the allow-list, declared MIME type
  against the extension, and the file's leading bytes against the extension
  (`INVALID_FILE_TYPE`). The byte check is a small table for PDF, PNG, JPEG,
  GIF, ZIP-based Office files and OLE Office files; no dependency.
  Buffering up to 10 MB is acceptable at this scale.
- Downloads are streamed by the API after the authorization check (ruling
  D3). No presigned URLs, so MinIO needs no port published to browsers and
  there is no internal-versus-public host mismatch to configure.
- Question images are the exception in D3: `GET /uploads/images/:key` is
  `@Public()` because an `<img>` tag cannot send a bearer token. The key is a
  random UUID. `Question.imageUrl` stores the relative path
  `/uploads/images/<key>`; the web app prefixes the API base URL.
- **Consistency between rows and objects.** Upload: put the object, then
  insert the row in a transaction; if the transaction fails, remove the
  object. Delete: delete the row, then remove the object. A failed removal is
  logged with the key. The worst case is an orphaned object, never a row
  pointing at nothing.

### 3.8 Mail (`modules/mail`)

`MailService.send({ to, subject, text, html? }): Promise<void>` over
Nodemailer. When `SMTP_HOST` is unset it logs the message at `log` level and
returns (ruling D4). It catches and logs every error and never throws.
Addresses ending in `@lumi.local` are skipped (A7-BR-16).

### 3.9 Notifications facade (`notification-events.service.ts`)

`NotificationsModule` becomes `@Global()`. Other modules inject
`NotificationEvents` and call one method. Each method loads what it needs,
builds Vietnamese text, and calls `NotificationsService.notify()`.

```ts
assignmentCreated(assignmentId)        // NEW_ASSIGNMENT -> targets, or all members; key assignment:<id>
attemptSubmitted(attemptId)            // SUBMISSION_RECEIVED -> exam owner; key submitted:<attemptId>
gradingCompleted(attemptId)            // GRADING_COMPLETE -> student; key graded:<attemptId>
resultsReleased(examId)                // RESULTS_RELEASED -> students with a SUBMITTED attempt; no key (guarded by caller, 5.9)
examRegraded(examId)                   // GRADING_COMPLETE -> students whose score changed; no key
announcementPosted(announcementId)     // ANNOUNCEMENT -> members; key announcement:<id>
deadlineReminder(tx, assignment, interval, studentIds)   // DEADLINE_REMINDER; key reminder:<assignmentId>:<interval>:<dueAt epoch>
```

`NotificationsService.notify(userIds, { type, title, body, link, dedupeKey? })`
does `createMany({ skipDuplicates: true })`. The unique
`(userId, dedupeKey)` constraint is the idempotency mechanism (finding M10),
so a retried request or a double click cannot produce two rows. Package 0
ships in-app delivery only; the notifications package adds the email fan-out
inside `notify` (J4). Notification bodies never contain a score.

### 3.10 Shared services with one owner

- `StudentAccountsService.createStudents(tx, teacherId, entries, classroomId?)`
  (`modules/users`): used by A7 and B10. Takes `lockUser(tx, teacherId)`,
  counts created students, enforces the 500 limit, generates
  `student_<hex>@lumi.local` and passwords, hashes with bcrypt cost 12,
  inserts users and memberships (`skipDuplicates`). Returns the created rows
  with plaintext passwords.
- `validateQuestionInput(dto)` (`question-validation.ts`): the option and
  `correctAnswer` rules extracted from `questions.service.ts:42-62`, plus
  "SHORT_ANSWER and FILL_BLANK need `correctAnswer`". Used by create, update,
  import (C6), inline create (D9) and publish validation (D4-R03, R04).
- `QuestionSelectionService` (`question-selection.service.ts`):
  `count(ownerId, criteria)` and
  `pickRandom(db, ownerId, criteria, count, excludeIds)` using
  `ORDER BY random()`. Used by C13 and D10.

### 3.11 Scheduler

`@nestjs/schedule`, `ScheduleModule.forRoot()` once. One job, in the
notifications package: `@Cron('*/5 * * * *')` calls
`RemindersService.checkAndSendReminders(new Date())`. The method takes the
clock as an argument so tests call it directly. `REMINDERS_ENABLED=false`
makes the cron handler return immediately; the test environment sets it.
Attempt expiry stays lazy.

### 3.12 Configuration

All new variables are optional in `app.config.ts`, so an existing `.env`
keeps booting.

| Variable | Default | Purpose |
|---|---|---|
| `MINIO_ENDPOINT`, `MINIO_PORT`, `MINIO_USE_SSL` | unset, `9000`, `false` | Storage host. Unset disables uploads (503). |
| `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET` | unset, unset, `lumi` | Credentials and bucket |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD` | unset, `587`, `false`, unset, unset | Unset host means mail is logged, not sent |
| `SMTP_FROM_ADDRESS`, `SMTP_FROM_NAME` | `SMTP_USER`, `Lumi Lite` | Sender |
| `APP_BASE_URL` | `http://localhost:3000` | Links in mail |
| `REMINDERS_ENABLED` | `true` | Turns the cron off |

`docker-compose.yml`: add a `minio` service (`minio/minio`,
`server /data --console-address ":9001"`, volume `miniodata`, ports 9000 and
9001 on localhost, healthcheck), and the `MINIO_*` variables on `api` with
`depends_on: minio`. `.env.example` gets the variables; its comments belong to
the technical writer.

### 3.13 New dependencies (API only; the web app adds none)

| Package | Why |
|---|---|
| `@fastify/multipart` | Fastify has no multipart parser; needed by every upload |
| `minio` | S3 client for MinIO; much smaller than the AWS SDK |
| `nodemailer`, `@types/nodemailer` | SMTP client (ruling D4) |
| `@nestjs/schedule` | In-process cron for reminders (ruling D2) |
| `csv-parse` | Correct parsing of quoted fields and embedded newlines for B10 and C6 imports; hand-rolled CSV parsing is a known source of bugs |
| `mammoth` | `.docx` to HTML for C6 (PD-07 CONFIRMED) |

CSV writing needs no package. Charts in the web app are drawn with plain SVG,
as the existing analytics page does with styled elements.

## 4. Endpoint map

All paths are under `/api`. Success bodies are the `data` of the envelope.
"Owner" means `exam.ownerId` or `classroom.ownerId` equals the caller.
"Member" means a `ClassroomMember` row exists. Every route also returns 401
without a valid token and 403 `FORBIDDEN` when the role does not match; those
two are not repeated. **New** = new route, **Chg** = behaviour or contract of
an existing route changes.

### 4.1 Auth, admin, teacher-created students (A)

| Route | Role | Check | Request | Response | Errors | Idempotency |
|---|---|---|---|---|---|---|
| Chg `POST /auth/register` | Public | none | `{email, password(8+), displayName(1-100), role: TEACHER\|STUDENT}`; email trimmed and lower-cased | 201 `{user, accessToken, refreshToken}` | 400 `VALIDATION_ERROR` (includes role ADMIN); 409 `EMAIL_ALREADY_EXISTS` | Unique index on email; a retry gets 409 |
| Chg `POST /auth/login` | Public | `isActive` | `{email, password}`; email matched case-insensitively | unchanged | 401 `INVALID_CREDENTIALS`; 403 `ACCOUNT_DISABLED` | n/a |
| Chg `POST /auth/refresh` | Public | `isActive` | `{refreshToken}` | unchanged | 401 `INVALID_REFRESH_TOKEN`; 403 `ACCOUNT_DISABLED` | Token consumed by `deleteMany` with count check; a second use gets 401, not 500 |
| Chg `POST /auth/forgot-password` | Public | none | `{email}` | 200 `{message}`; plus `resetToken` only when `NODE_ENV` is not `production` (D4) | 400 | Always 200. No token for unknown, disabled or `@lumi.local` users |
| Chg `POST /auth/reset-password` | Public | token | `{token, newPassword(8+)}` | 200 `{message}` | 400 `INVALID_RESET_TOKEN` | Token consumed by conditional delete in the same transaction as the password update and refresh-token revocation |
| Chg `GET /auth/me`, `PATCH /auth/profile` | Any | self | PATCH adds `emailNotificationsEnabled?: boolean`; new password min 8 | adds `emailNotificationsEnabled` | 400 | PATCH is idempotent |
| New `GET /admin/stats` | ADMIN | none | none | A6 shape | none | Read |
| New `GET /admin/users` | ADMIN | none | `page, limit, search, role, isActive` | `{users: [...]}` + `meta` | 400 | Read |
| New `GET /admin/users/:id` | ADMIN | none | none | A6 shape with counts | 404 `USER_NOT_FOUND` | Read |
| New `PATCH /admin/users/:id/disable`, `/enable` | ADMIN | target is not self | none | `{id, email, displayName, role, isActive}` | 403 `CANNOT_MODIFY_SELF`; 404 `USER_NOT_FOUND` | Idempotent. Disable also deletes refresh tokens |
| New `PATCH /admin/users/:id/role` | ADMIN | target is not self | `{role: TEACHER\|STUDENT}` | same | 400 `INVALID_ROLE`; 403 `CANNOT_MODIFY_SELF`; 404 | Idempotent. Deletes refresh tokens |
| New `GET /admin/recent-activity` | ADMIN | none | `limit` (1-50, default 10) | `{recentRegistrations, recentAttempts}` | 400 | Read |
| New `POST /teachers/students` | TEACHER | classroom owner if `classroomId` | `{displayName, email?, password?(6-72), classroomId?}` | 201 A7 shape with `temporaryPassword` | 400 `STUDENT_CREATION_LIMIT_REACHED`, `CLASSROOM_ARCHIVED`; 403 `CLASSROOM_NOT_OWNED`; 404 `CLASSROOM_NOT_FOUND`; 409 `EMAIL_ALREADY_EXISTS` | Not idempotent without an email; with one, a retry gets 409 |
| New `POST /teachers/students/batch` | TEACHER | same | `{students[1-50], classroomId?}` | 201 `{created[], count, classroomId}` | as above + 400 `DUPLICATE_EMAIL_IN_BATCH` | All-or-nothing transaction |
| New `GET /teachers/students` | TEACHER | `createdByTeacherId = me` | `page, limit, search, classroomId` | list + `meta` | none | Read |
| New `POST /teachers/students/:id/reset-password` | TEACHER | `createdByTeacherId = me` | none | `{id, temporaryPassword}` | 404 `STUDENT_NOT_FOUND` | Each call issues a new password and revokes refresh tokens (A7 OQ 2, option B) |

The first ADMIN is created with
`npm run create-admin --workspace=apps/api -- --email <e> --password <p>`
(ruling D1). There is no API for it.

### 4.2 Classrooms (B)

| Route | Role | Check | Request | Response | Errors | Idempotency |
|---|---|---|---|---|---|---|
| Chg `GET /classrooms/:id` | Any | owner or member | none | classroom; `joinCode` only for the owner | 403; 404 | Read. Fixes C20 |
| Chg `GET /classrooms/:id/members` | Any | owner or member | none | students see `id, displayName` only | 403; 404 | Read. Fixes C20 |
| New `POST /classrooms/:id/announcements` | TEACHER | owner | `{content(1-5000)}` | 201 `{id, classroomId, content, createdAt}` | 404 | Not idempotent; the notification is keyed by announcement id |
| New `GET /classrooms/:id/announcements` | Any | owner or member | `page, limit` | list + `meta`, newest first | 403; 404 | Read |
| New `DELETE /classrooms/:id/announcements/:announcementId` | TEACHER | owner | none | 204 | 404 | Second call 404 (B5-Q2) |
| New `GET /classrooms/:id/dashboard` | Any | owner or member; not archived | none | B7 teacher or student shape. Student `myScore` passes through `canStudentSeeResults` | 403; 404 | Read. Calls `sweepExpired({classroomId})` for the owner |
| New `GET /classrooms/:id/progress` | TEACHER | owner; not archived | `page, limit, sortBy, sortOrder, search` | `{summary, students[]}` + `meta` | 400; 403; 404 | Read |
| New `GET /classrooms/:id/progress/:studentId` | TEACHER | owner; student is a member | none | B8 detail shape | 404 | Read |
| New `POST /classrooms/:id/members/import/preview` | TEACHER | owner; not archived | multipart `file` (.csv, 1 MB) | `{rows: [{line, displayName, email, action, error?}], summary, truncated}`; no token, no passwords | 400 `INVALID_FILE_TYPE`, `FILE_TOO_LARGE`, `MISSING_HEADER`, `EMPTY_FILE`, `CLASSROOM_ARCHIVED` | Read-only |
| New `POST /classrooms/:id/members/import/confirm` | TEACHER | owner; not archived | `{rows: [{displayName, email?, password?}]}` (max 200) | `{created, added, skipped, errors[], credentials[]}` | 400 `CLASSROOM_ARCHIVED`, `VALIDATION_ERROR` | Rows are re-classified in the transaction. A repeat with emails is a no-op (all `skip`); rows without email create new accounts again. See finding M7 |
| New `GET /classrooms/:id/members/export` | TEACHER | owner (archived allowed) | none | CSV file | 404 | Read |
| New `GET /classrooms/:id/members/import/template` | TEACHER | owner | none | CSV file | 404 | Read |

### 4.3 Question bank (C) and uploads

| Route | Role | Check | Request | Response | Errors | Idempotency |
|---|---|---|---|---|---|---|
| New `POST /uploads/images` | TEACHER | none | multipart `file` (png, jpg, gif; 5 MB) | 201 `{url: "/uploads/images/<key>"}` | 400 `INVALID_FILE_TYPE`, `FILE_TOO_LARGE`; 503 `STORAGE_UNAVAILABLE` | Each call stores a new object |
| New `GET /uploads/images/:key` | Public | key format | none | image stream, `Cache-Control: public, max-age=31536000, immutable` | 404 | Read |
| New `POST /questions/import` | TEACHER | none | multipart `file` (.docx, .json, .csv; 10 MB) | `{questions: ParsedQuestion[], total, warnings}`; nothing saved | 400 `INVALID_FILE_TYPE`, `EMPTY_FILE`; 413 `FILE_TOO_LARGE` | Read-only |
| New `POST /questions/import/confirm` | TEACHER | categories owned | `{questions: CreateQuestionDto[]}` (max 500) | 201 `{created, failed: [{index, reason}]}` | 400 | Valid rows are created in one transaction; invalid rows are reported (CI-03). Not idempotent (CI-05) |
| New `GET /questions/export` | TEACHER | own questions | `format=json\|csv`, list filters | file | 400 `INVALID_FORMAT` | Read |
| New `POST /questions/random` | TEACHER | group and category owned | C13 body | `{questions, requested, availableCount, returned}` | 400 `EXCLUDE_LIST_TOO_LARGE`; 403 `GROUP_NOT_OWNED`; 404 `CATEGORY_NOT_FOUND`, `GROUP_NOT_FOUND` | Random by design |
| New `POST /questions/groups` | TEACHER | none | `{name(1-200), description?(0-1000)}` | 201 group | 400 `GROUP_LIMIT_REACHED` | Not idempotent |
| New `GET /questions/groups` | TEACHER | own | `page, limit, search, sort, order` | list with `itemCount` + `meta` | none | Read |
| New `GET /questions/groups/:id` | TEACHER | owner | `page, limit` | group + paginated questions | 403; 404 | Read |
| New `PATCH /questions/groups/:id` | TEACHER | owner | `{name?, description?}` | group | 400; 403; 404 | Idempotent |
| New `DELETE /questions/groups/:id` | TEACHER | owner | none | 204 | 403; 404 | Second call 404 |
| New `POST /questions/groups/:id/items` | TEACHER | owner; every question owned | `{questionIds[1-50]}` | 201 `{added, skipped}` | 400 `QUESTION_NOT_OWNED`, `GROUP_ITEM_LIMIT_REACHED`; 403; 404 | `createMany({skipDuplicates})` on the unique `(groupId, questionId)` |
| New `DELETE /questions/groups/:groupId/items/:questionId` | TEACHER | owner | none | 204 | 403; 404 | Second call 404 |
| New `DELETE /questions/groups/:groupId/items` | TEACHER | owner | `{questionIds[]}` | `{removed}` | 403; 404 | Idempotent |

Route order matters in `QuestionsController`: `groups`, `import`, `export`
and `random` must be declared before `:id` (`questions.controller.ts:73`),
or put in their own controllers. This design uses separate controllers (7.3).

### 4.4 Exams (D) and assignments (F, D11, J5)

| Route | Role | Check | Request | Response | Errors | Idempotency |
|---|---|---|---|---|---|---|
| Chg `POST /exams`, `PATCH /exams/:id` | TEACHER | owner; DRAFT for PATCH | adds `gradingMode?`, `allowFileSubmission?`; window validated | exam | 400 `INVALID_AVAILABILITY_WINDOW` (from >= until, checked against stored values on PATCH), `AVAILABILITY_IN_PAST` (POST only), `EXAM_NOT_DRAFT` | PATCH idempotent |
| Chg `POST /exams/:id/questions`, `DELETE /exams/:id/questions/:eqId` | TEACHER | owner; DRAFT | unchanged | unchanged | 400 `EXAM_NOT_DRAFT`, `MAX_QUESTIONS_REACHED` (200); 409 on duplicate position | Now under `lockExam` |
| Chg `POST /exams/:id/publish` | TEACHER | owner | none | exam | 400 `EXAM_NOT_DRAFT`, `EXAM_HAS_NO_QUESTIONS`, `INVALID_QUESTIONS` (message lists positions) | Second call 400 |
| New `POST /exams/:id/archive` | TEACHER | owner | none | exam | 400 `EXAM_NOT_PUBLISHED` | Second call 400 |
| New `GET /exams/:id/preview` | TEACHER | owner | none | D6 shape: snapshot when present, else live source; always ordered by position; includes `isCorrect`, `correctAnswer`, `explanation` | 404 | Read; writes nothing |
| New `POST /exams/:id/inline-questions` | TEACHER | owner; DRAFT; category owned | D9 body | 201 `{question, examQuestion}` | 400 `EXAM_NOT_DRAFT`, `INVALID_OPTIONS`, `CORRECT_ANSWER_REQUIRED`, `INVALID_CATEGORY`, `MAX_QUESTIONS_REACHED` | Not idempotent |
| New `POST /exams/:id/generate-questions` | TEACHER | owner; DRAFT; categories owned | `{criteria[1-10], dryRun?}` | dry run 200 `{criteria: [{requested, available}]}`; execute 201 `{added, warnings[]}` | 400 `EXAM_NOT_DRAFT`, `CRITERIA_REQUIRED`, `INVALID_CATEGORY`, `MAX_QUESTIONS_REACHED` | Dry run is read-only. Execute is not idempotent, but D10-R04 excludes questions already in the exam |
| Chg `PATCH /exams/:id/release-results` | TEACHER | owner | `{release: boolean}` (now a DTO) | `{id, resultsReleased}` | 400 | Idempotent; notifies only on a false-to-true change |
| Chg `POST /exams/:id/regrade` | TEACHER | owner; PUBLISHED | none | `{regraded, skipped}` | 400 `EXAM_NOT_PUBLISHED` | Idempotent |
| New `GET /exams/:id/results/export` | TEACHER | owner; PUBLISHED or ARCHIVED | `assignmentId?`, `includeQuestions?`, `onlyLatest?`, `format=csv` | CSV file | 400 `INVALID_FORMAT` (anything but `csv`); 404 `EXAM_NOT_FOUND`, `ASSIGNMENT_NOT_FOUND` | Read. Calls `sweepExpired({examId})` first |
| Chg `POST /assignments` | TEACHER | exam owner and classroom owner; exam PUBLISHED; classroom not archived | adds `hideResults?`, `reminderIntervals?`, `studentIds?` | 201 assignment with `targetType`, `targets` | 400 `EXAM_NOT_PUBLISHED`, `CLASSROOM_ARCHIVED`, `INVALID_STUDENTS`, `VALIDATION_ERROR`; 409 `ASSIGNMENT_EXISTS` | Unique `(examId, classroomId)`; a retry gets 409 |
| Chg `GET /assignments?classroomId=` | Any | owner or member | unchanged | adds `dueAt`, `hideResults`, exam window, `requiresAccessCode`, `serverTime`; students see only assignments with no targets or that target them, and their own `myStatus`, `attemptCount` | 403 | Read |
| Chg `GET /assignments/:id` | Any | exam owner, or member who is targeted | none | assignment; teacher also gets `targets`; never `accessCode` | 403; 404 `ASSIGNMENT_NOT_FOUND` | Read. Fixes C18 |
| New `PATCH /assignments/:id` | TEACHER | exam owner | `{dueAt?: string\|null, hideResults?, reminderIntervals?}` | assignment | 404 `ASSIGNMENT_NOT_FOUND` | Idempotent |
| New `PATCH /assignments/:id/targets` | TEACHER | exam owner; ACTIVE | `{studentIds: string[]\|null}` | `{targetType, targets}` | 400 `INVALID_STUDENTS`, `ASSIGNMENT_CLOSED` | Full replacement; idempotent |
| New `GET /assignments/:id/submissions` | TEACHER | exam owner | none | F3 shape | 404 | Read. Calls `sweepExpired({assignmentId})` first |
| New `POST /assignments/:id/attachments` | TEACHER | exam owner; ACTIVE | multipart `file` (10 MB) | 201 attachment | 400 `INVALID_FILE_TYPE`, `FILE_TOO_LARGE`, `ATTACHMENT_LIMIT_REACHED`, `STORAGE_LIMIT_REACHED`, `ASSIGNMENT_CLOSED`; 503 | Not idempotent |
| New `GET /assignments/:id/attachments` | Any | exam owner, or member who is targeted | none | list | 403; 404 | Read |
| New `GET /assignments/:id/attachments/:attachmentId/download` | Any | same | none | file stream | 404 `ATTACHMENT_NOT_FOUND`; 503 | Read |
| New `DELETE /assignments/:id/attachments/:attachmentId` | TEACHER | exam owner | none | `{id, deleted: true}` | 404 `ATTACHMENT_NOT_FOUND` | Second call 404 |

### 4.5 Attempts, grading, results (E, F7, F8, G)

| Route | Role | Check | Request | Response | Errors | Idempotency |
|---|---|---|---|---|---|---|
| Chg `POST /attempts/start` | STUDENT | 5.1 | `{examId, assignmentId?, accessCode?}` | 201 new, 200 resumed: `{id, status, startedAt, expiresAt, serverTime, exam: {title, instructions, durationSeconds, allowFileSubmission}, assignmentId, questions: StudentQuestion[], answers: [{examQuestionId, answerPayload}]}`. `questions` are already in display order | 400 `EXAM_NOT_PUBLISHED`; 403 `NOT_ASSIGNED`, `NOT_TARGETED`, `ASSIGNMENT_CLOSED`, `DEADLINE_PASSED`, `EXAM_NOT_YET_AVAILABLE`, `EXAM_EXPIRED`, `INVALID_ACCESS_CODE`, `MAX_ATTEMPTS_REACHED`; 404 `EXAM_NOT_FOUND` | Returns the existing IN_PROGRESS attempt. See 5.1 |
| Chg `GET /attempts/:id` | STUDENT | attempt owner | none | same shape as start; when SUBMITTED, `questions` is omitted and the body is the masked result | 403 `NOT_ATTEMPT_OWNER`; 404 `ATTEMPT_NOT_FOUND` | Read; submits if expired |
| Chg `POST /attempts/:id/answer` | STUDENT | attempt owner | `{examQuestionId, selectedOptionId? \| selectedOptionIds? \| text?}`, exactly one | `{examQuestionId, savedAt}` | 400 `ATTEMPT_EXPIRED`, `ATTEMPT_ALREADY_SUBMITTED`, `INVALID_QUESTION`, `INVALID_OPTION`, `VALIDATION_ERROR` (wrong shape for the type; text over 1,000 chars for short answers, 20,000 for essays); 403; 404 | Upsert on `(attemptId, examQuestionId)` |
| Chg `POST /attempts/:id/submit` | STUDENT | attempt owner | none | 200 `{id, status, submittedAt, score, resultsHidden, exam: {showResultImmediately}}`; `score` is null when not visible | 403 `NOT_ATTEMPT_OWNER`; 404 `ATTEMPT_NOT_FOUND` | Second call returns the stored result |
| Chg `GET /attempts/my` | STUDENT | self | none | list through `maskAttemptForStudent`: adds `resultsHidden`, `assignmentId` | none | Read |
| Chg `GET /attempts/:id/result` | Any | attempt owner (masked) or exam owner | none | attempt summary; no `optionsSnapshot` | 403; 404 | Read. Fixes C8 |
| Chg `GET /attempts/:id/review` | Any | exam owner, or attempt owner when results are visible; SUBMITTED for both | none | `{gradingMode, gradingProgress: {graded, total}, questions: [{examQuestionId, position, questionType, content, imageUrl, options, correctOptionId, correctOptionIds, correctAnswer, selectedOptionId, selectedOptionIds, text, isCorrect, points, earnedPoints, manuallyGraded, explanation, feedback}]}` | 400 `ATTEMPT_NOT_SUBMITTED`; 403 `RESULTS_NOT_AVAILABLE`, `FORBIDDEN`; 404 | Read. Fixes C10 |
| Chg `GET /attempts?examId=` | TEACHER | exam owner | none | adds `assignmentId`, `gradingProgress`, `attemptNumber` | 403 | Read. Calls `sweepExpired({examId})` first |
| Chg `PATCH /attempts/:id/score` | TEACHER | exam owner; SUBMITTED | `{score(0-10), reason?(0-500)}` | `{id, score, manualScoreOverride: true}` | 400 `ATTEMPT_NOT_SUBMITTED` | Overwrites |
| Chg `PATCH /attempts/:id/feedback` | TEACHER | exam owner; SUBMITTED | `{feedback(0-5000)}` | `{id, feedback}` | 400 `ATTEMPT_NOT_SUBMITTED` | Idempotent |
| New `PATCH /attempts/:attemptId/answers/:examQuestionId/grade` | TEACHER | exam owner; SUBMITTED | `{earnedPoints?(0..points), feedback?(0-2000)}`, at least one | `{answerId, examQuestionId, earnedPoints, feedback, attemptScore, manualScoreOverride, gradingProgress}` | 400 `VALIDATION_ERROR`, `ATTEMPT_NOT_SUBMITTED`; 404 `ATTEMPT_NOT_FOUND`, `QUESTION_NOT_FOUND` | Idempotent for equal input |
| New `POST /attempts/:attemptId/files` | STUDENT | attempt owner; IN_PROGRESS; `exam.allowFileSubmission` | multipart `file` (pdf, docx, png, jpg; 10 MB) | 201 file | 400 `ATTEMPT_NOT_IN_PROGRESS`, `FILE_SUBMISSION_NOT_ALLOWED`, `INVALID_FILE_TYPE`, `FILE_TOO_LARGE`, `MAX_FILES_REACHED`; 503 | Same name replaces (F7-BR-11) |
| New `GET /attempts/:attemptId/files` | Any | attempt owner or exam owner | none | list | 403; 404 | Read |
| New `GET /attempts/:attemptId/files/:fileId/download` | Any | same | none | file stream | 404 `FILE_NOT_FOUND`; 503 | Read |
| New `DELETE /attempts/:attemptId/files/:fileId` | STUDENT | attempt owner; IN_PROGRESS | none | `null` | 400 `ATTEMPT_NOT_IN_PROGRESS`; 404 `FILE_NOT_FOUND` | Second call 404 |

Endpoints that must apply `canStudentSeeResults` when the caller is a
STUDENT: `POST /attempts/:id/submit`, `GET /attempts/:id` (after submit),
`GET /attempts/my`, `GET /attempts/:id/result`, `GET /attempts/:id/review`,
`GET /classrooms/:id/dashboard`, `GET /analytics/students/me/performance`.
When results are hidden, `score`, `feedback` and earned points are null and
`resultsHidden` is true; review returns 403 `RESULTS_NOT_AVAILABLE`.

### 4.6 Analytics (H) and notifications (J)

| Route | Role | Check | Request | Response | Errors | Idempotency |
|---|---|---|---|---|---|---|
| Chg `GET /analytics/exams/:id/questions` | TEACHER | exam owner | none | `correctCount` now means `earnedPoints = points`; `totalAnswered` unchanged; `mostSelectedOption` only for option types | 403 | Read |
| Chg `GET /analytics/exams/:id/ranking`, `/distribution`, `GET /analytics/classrooms/:id` | TEACHER | owner | none | unchanged | 403; 404 | Read; each calls `sweepExpired` first |
| Chg `GET /analytics/students/me/performance` | STUDENT | self | none | `score` null and `resultsHidden` true when not visible | none | Read. Fixes C21 |
| Chg `GET /analytics/students/:id/performance` | TEACHER | student is a member of a classroom the teacher owns; only attempts on the teacher's exams | none | unchanged shape | 403 | Read. Fixes C21 |
| New `GET /analytics/export` | TEACHER | owner of the entity; exam not DRAFT | `type`, `entityId`, `format=csv` | CSV file, `Cache-Control: no-store` | 400 `INVALID_REPORT_TYPE`, `INVALID_FORMAT`, `INVALID_ENTITY_ID`, `EXAM_NOT_PUBLISHED`; 403; 404 | Read |
| Chg `GET /notifications` | Any | self | adds `page`; `limit` capped at 100 | list + `meta` | none | Read |
| Chg `POST /notifications/read-all` | Any | self | none | `{count}` | none | Idempotent |

### 4.7 Overlapping endpoints: which spec loses

| Overlap | Decision | Loses |
|---|---|---|
| F10 `GET /exams/:examId/export-results` vs G9 `GET /exams/:id/results/export` | One route, G9's path, with F10's `assignmentId` filter added. Columns: STT, Họ tên, Email, Điểm, Thời gian nộp, Trạng thái, Lần làm bài, Chấm tay, Nhận xét, then `Câu N` when `includeQuestions`. IN_PROGRESS attempts are excluded after the sweep. CSV only. | F10's path; F10-BR-03 and BR-06 for IN_PROGRESS rows; F10 OQ-01 (no override column); F10 OQ-04 (UTC). Finding B5 |
| F8 per-question grade vs G3 `PATCH /answers/:id/feedback` vs G3 score override vs G4 regrade | F8's route is the only per-answer write and also carries feedback-only updates. G3's bulk override stays. Regrade skips overridden attempts and keeps manually graded answers. | G3's proposed `/answers/:id/feedback` (it cannot address an unanswered question, which has no answer id). Findings B3, M5 |
| `PATCH /assignments/:id` in F4 (`dueAt`), F9 (`hideResults`), J5 (`dueAt`, `reminderIntervals`) | One route, one DTO with all three optional fields. Check is "owns the exam". | J5's wording "owns the classroom"; equivalent in practice because create requires the same teacher to own both. Finding M4 |
| D11 `POST /exams/:id/attempts` vs existing `POST /attempts/start` | Existing route. | D11's path. Finding B4 |
| Start-attempt error codes in E1, F4, D6, D11 | E1's codes and statuses, plus `DEADLINE_PASSED`, `ASSIGNMENT_CLOSED`, `NOT_TARGETED` as 403. | F4's 400s and `EXAM_NOT_AVAILABLE_YET`; D6's English-to-Vietnamese message note is kept. Finding B4 |
| F6, F7 presigned download URL vs ruling D3 | The download route streams the file. | F6-BR-06, F7-BR-06, and both response shapes `{url}` / `{downloadUrl, expiresIn}`. Finding M3 |
| G1 and G2 review error 403 `RESULTS_NOT_AVAILABLE` vs F9 400 vs code 400 | 403 `RESULTS_NOT_AVAILABLE` for both causes. | F9's 400. Finding M6 |
| J4 `PATCH /users/me`, `GET /users/me` | Existing `PATCH /auth/profile`, `GET /auth/me`; `/users/me` does not exist. | J4's paths |
| AD-07 `PUT /attempts/:id/answers/:examQuestionId` vs code and E2 `POST /attempts/:id/answer` | Keep the code's route; AD-07 is PROPOSED and the web client depends on the current one. | AD-07's path. Finding M17 |

## 5. Authorization, transactions, concurrency

Isolation is PostgreSQL's default, READ COMMITTED, everywhere. Correctness
comes from the named lock or constraint, not from the isolation level.
Interactive transactions set `{ maxWait: 5000, timeout: 10000 }`, except
regrade (`timeout: 60000`).

### 5.1 Attempt start

One transaction:

1. `lockStart(tx, studentId, examId)`. Every later step for this student and
   exam is now serialised.
2. Load the exam. Missing: 404 `EXAM_NOT_FOUND`.
3. Look for an IN_PROGRESS attempt for this student and exam.
   - Found and `now <= expiresAt`: return it with 200. No other check runs,
     so a closed assignment, a passed deadline or a changed access code never
     locks a student out of an attempt they already started (F4-BR-03). This
     also fixes C2.
   - Found and expired: `lockAttempt`, `finalize` in this transaction, then
     continue as a new start.
4. Exam is PUBLISHED, else 400 `EXAM_NOT_PUBLISHED` (ARCHIVED lands here, D4-R13).
5. Resolve the assignment. Candidates are assignments of this exam in
   non-archived classrooms where the student is a member.
   - `assignmentId` given: it must be a candidate, else 403 `NOT_ASSIGNED`.
   - Omitted: candidates ordered by `dueAt` ascending, nulls last. The first
     one that passes the three checks below is used. If none passes, the
     error of the first candidate is returned. No candidates: 403 `NOT_ASSIGNED`.
   - Checks per candidate: targets exist and do not include the student, 403
     `NOT_TARGETED`; status is not ACTIVE, 403 `ASSIGNMENT_CLOSED`;
     `dueAt` set and `now >= dueAt`, 403 `DEADLINE_PASSED`.
6. Window: `now < availableFrom`, 403 `EXAM_NOT_YET_AVAILABLE`;
   `now > availableUntil`, 403 `EXAM_EXPIRED`.
7. `exam.accessCode` set and `dto.accessCode` differs (exact, case-sensitive):
   403 `INVALID_ACCESS_CODE`.
8. Count this student's attempts for the exam. `>= maxAttempts`: 403
   `MAX_ATTEMPTS_REACHED`.
9. Insert the attempt with `assignmentId` set, `expiresAt = now + durationSeconds`
   (not shortened by `dueAt`, ruling D6), and `questionOrder` if
   `shuffleQuestions`.

| Scenario | Outcome | Mechanism |
|---|---|---|
| Double click, two tabs, retry after timeout | The second request waits at step 1, then finds the attempt at step 3 and returns it | Advisory lock |
| Two requests race past the count | Cannot happen; the count runs under the lock | Advisory lock |
| A code path that forgets the lock | The second insert fails with P2002 | Partial unique index `exam_attempts_one_in_progress` (backstop) |
| Start races submit of the previous attempt | Start takes the advisory lock, submit takes the row lock; the count is read after the lock, so it sees every committed attempt | Both |

Every new attempt has an `assignmentId`. Attempts created before this change
keep NULL, and for them `hideResults` does not apply (F9-BR-09).

### 5.2 Save answer

One transaction: `shareAttempt(tx, id)`; owner check; status SUBMITTED gives
400 `ATTEMPT_ALREADY_SUBMITTED`; `now > expiresAt` ends the transaction,
calls `submitIfExpired`, and returns 400 `ATTEMPT_EXPIRED`; the exam question
must belong to the attempt's exam (`INVALID_QUESTION`); the payload must fit
`typeSnapshot` and every option id must be in `optionsSnapshot`
(`INVALID_OPTION`); then upsert on the unique `(attemptId, examQuestionId)`
with `savedAt = now`.

`FOR SHARE` lets saves for different questions run together and makes each
of them wait for, or be waited on by, the `FOR UPDATE` in submit. A save
therefore either commits before grading reads the answers or sees SUBMITTED
and is rejected. That closes C6. Two saves for the same question: last
commit wins, by the upsert (AD-07).

### 5.3 Submit and auto-submit

One transaction: `lockAttempt`; owner check; if SUBMITTED, return the stored
row without grading; otherwise `finalize`. An expired attempt takes the same
path (AD-11). After commit: `events.attemptSubmitted`.

Lazy expiry enters through `submitIfExpired` from: save answer, `GET
/attempts/:id`, start (step 3), and `sweepExpired`. Each takes
`lockAttempt` and re-checks the status under the lock, so a manual submit
racing an auto-submit grades once. `submittedAt` is `min(now, expiresAt)`
(finding M14).

### 5.4 Manual grading, score override, regrade

- **Grade one answer** (F8). One transaction: `lockAttempt`; exam owner;
  SUBMITTED; the question belongs to the exam; upsert the answer (an
  unanswered question gets a row with payload `{}`, F8-BR-12). If
  `earnedPoints` is given: set it, set `manuallyGraded = true`,
  `recalculateScore`, write the score and `manualScoreOverride = false`
  (F8-BR-04). If only `feedback` is given, nothing else changes. After
  commit, if `graded` went from below `total` to `total`:
  `events.gradingCompleted` (keyed, so it fires once per attempt).
- **Score override** (G3). One transaction: `lockAttempt`; SUBMITTED; set
  `score` and `manualScoreOverride = true`. Per-answer `earnedPoints` are
  left as they are (F8-BR-10).
- **Regrade** (G4). One transaction: `lockExam`; `SELECT ... FROM
  exam_attempts WHERE exam_id = $1 AND status = 'SUBMITTED' FOR UPDATE`;
  for each attempt with `manualScoreOverride = false`,
  `gradeAttempt(tx, id, { preserveManual: true })` and write the score.
  Returns `{regraded, skipped}`. All or nothing (G4 atomicity). After
  commit: `events.examRegraded` for attempts whose score changed.

The row lock on the attempt serialises all three with each other and with
submit, so the invariant in 3.4 holds after any interleaving.

### 5.5 Exam mutations in DRAFT, publish, archive

Add question, remove question, inline create (D9), generate (D10) and
publish each run in one transaction that starts with `lockExam` and
re-checks `status = DRAFT` under the lock. This closes C15: publish cannot
snapshot while a question is being added.

- Positions: `MAX(position) + 1` is read under the lock; the unique
  `(examId, position)` is the backstop.
- Publish validates every question with `validateQuestionInput` against its
  live source (D4-R03, R04), writes the six snapshot fields, then sets
  PUBLISHED. A question whose source was deleted fails validation.
- Archive: `updateMany({ where: { id, status: 'PUBLISHED' } })`; count 0 is
  400 `EXAM_NOT_PUBLISHED`. A conditional update needs no lock.
- **Snapshot immutability**: no code path writes `*Snapshot` columns or
  `points` unless it holds `lockExam` and has seen DRAFT.

### 5.6 Imports

- **Questions (C6).** Preview parses and returns; it writes nothing and
  keeps nothing on the server. Confirm validates each item, then creates the
  valid ones in one transaction and returns the invalid ones with reasons.
  A failure inside the transaction rolls back all of them and returns 500.
  A double click creates the questions twice; the dialog disables the button
  while the request is in flight, and CI-05 accepts duplicates.
- **Students (B10).** Confirm runs one transaction:
  `lockUser(tx, teacherId)`, re-classify every row against current data,
  call `StudentAccountsService.createStudents` for `create` rows, insert
  memberships for `add` rows with `skipDuplicates`. The email unique index
  and the `(classroomId, userId)` unique index are the backstops; a P2002 on
  email aborts the transaction and returns 409 naming the row.
- **Teacher-created students (A7).** Same service, same lock. The 500 limit
  is counted under `lockUser`, so two parallel batches cannot both pass.

### 5.7 Random generation (D10) and random selection (C13)

C13 is a stateless read. D10 execute: one transaction, `lockExam`, DRAFT
check, read the `sourceQuestionId`s already in the exam, then for each
criterion in order call `pickRandom` with the growing exclusion set
(D10-R04, R05), check the 200 cap, and `createMany` with sequential
positions. Two concurrent executes are serialised by the exam lock; the
second sees the first one's questions and excludes them.

### 5.8 Assignment update and targets

- `PATCH /assignments/:id`: one transaction, `lockAssignment`, update. If
  `dueAt` or `reminderIntervals` changed, delete `DeadlineReminder` rows
  whose `newDueAt - interval` is still in the future (J5-BR-09).
- `PATCH /assignments/:id/targets`: one transaction, `lockAssignment`,
  ACTIVE check, verify every id is a member (`INVALID_STUDENTS` lists
  names), `deleteMany` targets not in the new list, `createMany` with
  `skipDuplicates`. Two concurrent updates apply one after the other; the
  result is the later list, complete.
- Create with `studentIds`: assignment and targets in one transaction.
- Removing a student from the targets does not touch their attempts
  (D11-R07). A running attempt continues (D11-Q01 a), because resume does
  not re-check targets (5.1 step 3).

### 5.9 Release results and notification triggers

`release-results` runs `updateMany({ where: { id, ownerId, resultsReleased: !release }, data })`.
The notification is sent only when `release` is true and the count is 1, so
a repeated or concurrent request notifies once. Other triggers are keyed
(3.9). All are sent after commit.

### 5.10 Reminder dispatch (at most once)

`checkAndSendReminders(now)`:

1. Select ACTIVE assignments with `now < dueAt <= now + 48h`.
2. For each, compute the configured intervals whose reminder time
   `dueAt - interval` is `<= now`. If none, skip.
3. One transaction per assignment: `lockAssignment`; re-read and re-check
   step 1 and 2 under the lock; `createMany` the `DeadlineReminder` rows for
   all due intervals with `skipDuplicates`. If no row was inserted, stop.
   Otherwise find the recipients (members, restricted to targets when the
   assignment has them, without a SUBMITTED attempt on this assignment's
   exam) and insert their notifications in the same transaction, once, for
   the smallest newly inserted interval.
4. After commit, send email to recipients who opted in. Not awaited.

| Scenario | Outcome | Mechanism |
|---|---|---|
| Two cron runs overlap, or two API instances run | One inserts the tracking row, the other inserts nothing and stops | Unique `(assignmentId, interval)` |
| Crash after commit, before email | In-app reminder exists; email is lost | Accepted (J4 OQ-03) |
| Crash before commit | Nothing was written; the next run sends it, if `dueAt` is still ahead (J5-BR-14) | Transaction |
| Teacher changes `dueAt` during a run | The run holds the assignment lock; the update waits, then deletes the tracking rows that are in the future again | `lockAssignment` on both sides |
| Server was down across several intervals, or an assignment is created 30 minutes before its deadline | All due intervals are marked, one reminder is sent | Step 3 |

### 5.11 File uploads

- Attachment (F6): read and validate the upload, put the object, then one
  transaction: `lockAssignment`, ACTIVE check, count and sum existing rows,
  check 5 files and 50 MB, insert. On any failure remove the object.
- Submission file (F7): put the object, then one transaction:
  `lockAttempt`, owner, IN_PROGRESS and not expired, count `< 5` unless the
  name already exists, upsert on `(attemptId, originalName)`. After commit
  remove the replaced object. `lockAttempt` is the same lock submit takes,
  so no file is added to a submitted attempt (F7-BR-01).
- Delete: row first, then the object.

### 5.12 Accounts

| Operation | Race | Mechanism |
|---|---|---|
| Register twice with one email | One 201, one 409 | Unique index on `email`; P2002 mapped to `EMAIL_ALREADY_EXISTS`. The pre-check stays only for the message |
| Refresh twice with one token | One succeeds, one 401 | `deleteMany({ id })` and require count 1 before issuing |
| Reset twice with one token | One succeeds, one 400 | Same, inside the transaction that updates the password and deletes refresh tokens |
| Disable racing a refresh | No token survives | Disable: `lockUser`, set `isActive = false`, delete tokens. Refresh and login: read the user `FOR SHARE` in the transaction that inserts the new token |
| Admin changes own role or disables self | 403 `CANNOT_MODIFY_SELF` | Service check; no race |

A disabled user's access token stays valid until it expires, at most 15
minutes (ASM-A6-03). Accepted.

### 5.13 Invariants and what protects each

| Invariant | Protection |
|---|---|
| At most one IN_PROGRESS attempt per student and exam | Partial unique index; advisory lock |
| Attempt count never exceeds `maxAttempts` | Count under the advisory lock |
| No answer changes after SUBMITTED | `FOR SHARE` in save against `FOR UPDATE` in submit |
| An attempt is graded exactly once on submit | `FOR UPDATE` and status re-check |
| Score equals `computeScore(stored earnedPoints)` unless overridden | Single engine; attempt row lock on every writer |
| Snapshots are immutable after publish | Exam row lock and DRAFT re-check on every writer |
| A student never receives an answer key before results are visible | `toStudentQuestion` is the only student serializer; review requires SUBMITTED and visibility |
| One assignment per exam and classroom | Existing unique index, now mapped to 409 |
| One reminder per assignment and interval | Unique index, same transaction as the notifications |
| One notification per event and user | Unique `(userId, dedupeKey)` |
| At most 5 attachments and 50 MB per assignment; 5 files per attempt | Count under the parent row lock |
| At most 500 students per teacher | Count under `lockUser` |

### 5.14 Failure handling

| Failure | Client receives | Rolled back | Logged |
|---|---|---|---|
| Any error inside a transaction | The mapped error envelope | The whole transaction | Unhandled errors, by Fastify's logger |
| Lock wait exceeds `maxWait` | 500 `INTERNAL_ERROR`; the client retries; every write above is safe to retry | Yes | Yes |
| MinIO down | 503 `STORAGE_UNAVAILABLE` | No row is written | Warning |
| Object removal fails after a row delete | Success | n/a | Warning with the key |
| SMTP down or unset | Nothing; the request succeeds | n/a | Warning, or the message at `log` level when unset |
| Notification insert fails | Nothing; the request succeeds | n/a | Error with the event name and id |
| Admin action | n/a | n/a | `Logger.log` with action, admin id, target id (A6-BR-10) |

### 5.15 Performance at target volume

100 students, up to 200 questions per exam, up to 1,000 attempts per exam.

| Operation | Queries | Note |
|---|---|---|
| Start | 6 to 8 | Exam with questions is one query |
| Save answer | 4 | Lock, exam question, upsert, commit |
| Submit | 5 | One bulk `UPDATE` for earned points |
| Review | 3 | No recomputation; reads stored `earnedPoints` |
| Regrade, 1,000 attempts | about 3,000 | Under 10 s expected; not measured |
| Export with `includeQuestions`, 1,000 attempts | 3 | Attempts with students, answers by `attemptId IN (...)`, exam questions. Up to 200,000 answer rows in memory, roughly 30 MB; acceptable, buffer and send |
| Classroom dashboard, progress | 4 to 5 | Members, assignments, attempts for those exams and members, last activity by one grouped raw query. Aggregated and sorted in memory; pagination slices the result. No per-student query |
| Submission tracking | 4 | Same pattern |
| Reminder run | 1 + 3 per due assignment | |

No endpoint may load attempts or answers inside a loop over students or
questions. That is the N+1 the reviewer should look for in B7, B8, F3 and G9.

## 6. Cross-spec conflicts and spec defects

For the business analyst. Sections 2 to 5 are written as if each
recommendation here is accepted. A different ruling on a BLOCKING item
changes the schema or a contract, so those must be ruled on before Package 0
starts.

```text
[B1] BLOCKING
Where: assignments/manual-grading-workflow.md F8-BR-01, F8-BR-03 (earnedPoints Decimal(10,2));
       grading/partial-scoring.md G7-BR-05 (full precision until the final score)
Finding: The two rules give different scores for the same answers. With PARTIAL grading, three
         questions worth 1 point each earning 1/3 are stored as 0.33 each. Submit computes
         (1.0 / 3) * 10 = 3.33; the first manual grade on any other question recalculates from
         stored values and gets (0.99 / 3) * 10 = 3.30. The score changes without the teacher
         changing anything related.
Evidence: F8-BR-03 "score = SUM(earnedPoints for all questions) / SUM(points) * 10";
          G7-BR-05 "kept at full floating-point precision during accumulation".
Suggested fix: Store earnedPoints as Decimal(10,4) and define the score, in every spec, as
         computed from the stored per-answer values. G7-BR-05 is reworded to "4 decimal places".
         The API returns earnedPoints with up to 4 decimals; the UI shows 2.

[B2] BLOCKING
Where: grading/regrade.md OQ 5 (recommended: allow changing gradingMode on PUBLISHED exams);
       grading/partial-scoring.md G7-BR-02 (read-only after publish); G7-BR-08
Finding: The recommended defaults contradict each other, and ruling D8 tells developers to follow
         both. One makes PATCH /exams/:id accept gradingMode after publish, the other rejects it.
Evidence: regrade.md OQ 5 "(a) Allow changing gradingMode on PUBLISHED exams";
          G7-BR-02 "After publish, the field is read-only".
Suggested fix: Keep G7-BR-02. A business rule outranks an open-question default, and changing
         the scoring rule after students have sat the exam changes published results. Regrade
         then serves two cases: a grading-code fix, and exams published before this release.

[B3] BLOCKING
Where: grading/manual-grading.md A2 (manualScoreOverride is one-way) and "Override persistence";
       manual-grading-workflow.md F8-BR-04, F8-BR-10, OQ-04; grading/regrade.md "Skip manual overrides"
Finding: (a) G3 says the flag never returns to false; F8-BR-04 sets it to false on every
         per-question grade. (b) F8 OQ-04 (b) wants regrade to keep manually graded answers and
         proposes to detect them "by comparing earnedPoints to what auto-grading would produce".
         That cannot work: a teacher who confirms the auto-graded value is indistinguishable
         from no action, and after a grading-code fix every changed answer looks manual.
         (c) Nothing says what regrade does to an attempt that has per-question manual grades but
         no bulk override.
Evidence: quoted rule IDs; code has only the attempt-level flag (schema.prisma:280).
Suggested fix: Add Answer.manuallyGraded. Rules: a per-question grade sets it and clears the
         attempt's manualScoreOverride; a bulk override sets manualScoreOverride and leaves
         answers alone; regrade skips attempts with manualScoreOverride, and in the others
         re-grades only answers with manuallyGraded = false, then recomputes the score.
         Delete G3 A2.

[B4] BLOCKING
Where: examination/start-exam.md 5.9 and E1-OQ-04; assignments/deadline-management.md 5.3 and 5.9;
       exams/assign-to-students.md D11-R05 and 5.9; exams/availability-window.md 5.9;
       assignments/hide-results.md F9-BR-09
Finding: Four specs define the same endpoint differently. E1 uses 403 for NOT_ASSIGNED,
         EXAM_NOT_YET_AVAILABLE, EXAM_EXPIRED, MAX_ATTEMPTS_REACHED; F4 uses 400 for the same
         conditions and names one EXAM_NOT_AVAILABLE_YET; D11 puts the check on a route that does
         not exist (POST /api/exams/:id/attempts); the check order differs between E1 and F4, so
         a request that fails two checks has two "correct" answers. E1-OQ-04 recommends making
         assignmentId required while F9-BR-09 specifies behaviour for attempts without one.
         No spec says whether resume re-runs the checks.
Evidence: E1 5.9 error table; F4 "Time check order"; attempts.controller.ts:28 is the only route.
Suggested fix: Section 5.1 of this design: E1's route, codes and statuses; DEADLINE_PASSED,
         ASSIGNMENT_CLOSED and NOT_TARGETED as 403; one fixed check order; resume runs no
         checks; assignmentId optional in the request and resolved by the server, so every new
         attempt has one. F9-BR-09 then covers only attempts created before this release.

[B5] BLOCKING
Where: assignments/export-results.md (F10) and grading/export-results.md (G9)
Finding: Two specs for one feature that disagree on path, on rows (F10-BR-03 and BR-06 export
         IN_PROGRESS attempts as "Đang làm"; G9-BR-04 excludes them), on the manual-override
         column (F10 OQ-01 omit; G9-BR-05 include), on time zone (F10 OQ-04 UTC; G9 OQ 5 UTC+7),
         on the file name (F10-BR-09 ASCII; G9-BR-09 UTF-8 preserved) and on header spelling
         (G9 writes "Ho ten", "Co" without diacritics; F10 writes "Họ tên").
Evidence: quoted rule IDs.
Suggested fix: One endpoint as in 4.7. Merge the two specs into grading/export-results.md and
         make F10 a pointer to it. Headers with diacritics.

[B6] BLOCKING
Where: decisions.md D8; exams/publish-exam.md D4-Q03, D4-Q04; grading/regrade.md OQ 1
Finding: Applied literally, D8 adds features that are not in the TASKS.md scope table: cloning a
         published exam (D4-Q03 a) and editing the answer key of a published exam followed by a
         regrade (D4-Q04 a, G4 OQ 1 c). The second breaks snapshot immutability, which CLAUDE.md
         lists as not to be changed without a decision, and it changes grades after the fact.
Evidence: D4-Q04 "(a) Allow editing optionsSnapshot.isCorrect + regrade"; CLAUDE.md "exam content
         is snapshotted at publish. See docs/TECHNICAL_DECISIONS.md before changing any of these".
Suggested fix: Rule that D8 covers only open questions inside an in-scope item. Both features are
         left out of this design. Answer-key correction needs the user's decision (protocol 7.6).

[M1] MAJOR
Where: exams/publish-exam.md D4-R06, D4-R07; grading/auto-grading.md 5.8; examination/*.md 5.8
Finding: These specs say no schema change is needed, but SHORT_ANSWER, FILL_BLANK and MCQ_MULTI
         cannot be graded from the snapshot: it has neither the type nor correctAnswer. G1 5.8
         says correctAnswer is "snapshotted here or in optionsSnapshot"; it is in neither.
Evidence: schema.prisma:225-240; exams.service.ts:142-153.
Suggested fix: Document typeSnapshot, correctAnswerSnapshot, imageUrlSnapshot,
         explanationSnapshot in D4-R06 and in G1 5.8. Add the publish validation rule (D4-Q01 a).

[M2] MAJOR
Where: grading/auto-grading.md and grading/exam-results.md, GET /attempts/:id/review authorization
Finding: The authorization rule omits the attempt status. With showResultImmediately = true a
         student can read the answer key while the attempt is IN_PROGRESS.
Evidence: attempts.service.ts:171-216 has no status check; specs state only owner + visibility.
Suggested fix: Add "attempt is SUBMITTED" to the rule for both roles (G2 OQ 3 b already says
         this for teachers). 400 ATTEMPT_NOT_SUBMITTED.

[M3] MAJOR
Where: assignments/file-attachments.md F6-BR-06; student-file-submission.md F7-BR-06, AS-04
Finding: Both specify presigned MinIO URLs. Ruling D3 says files are served through the API.
Evidence: decisions.md D3.
Suggested fix: Replace with "the download endpoint streams the file after the authorization
         check". Response is the file, not {url} or {downloadUrl, expiresIn}.

[M4] MAJOR
Where: deadline-management.md, hide-results.md, deadline-reminders.md: PATCH /api/assignments/:id
Finding: Three specs each define this route with a different body and a different ownership
         phrase. None says what applies to a CLOSED assignment.
Suggested fix: One definition (4.4). Allowed on CLOSED (F9-BR-06 needs it). F1 owns the route;
         the other specs reference it.

[M5] MAJOR
Where: manual-grading-workflow.md 5.9 (earnedPoints "Required") vs F8-BR-08; manual-grading.md
       "Per-Answer Feedback (Proposed Enhancement)"
Finding: F8-BR-08 says feedback can be saved without a score, but the endpoint requires
         earnedPoints. G3 proposes a second route keyed by answer id, which cannot address a
         question the student left blank.
Suggested fix: earnedPoints optional, at least one of the two fields required. Drop G3's route.

[M6] MAJOR
Where: result-visibility.md OQ 1; hide-results.md 5.9; exam-results.md; classroom-dashboard.md B7-Q2;
       analytics/student-performance.md
Finding: Visibility is specified per endpoint and inconsistently: 403 RESULTS_NOT_AVAILABLE (G1,
         G2) vs 400 (F9); G5 leaves hiding the score in GET /attempts/my as an open question while
         F9-BR-05 requires it; nothing covers POST /attempts/:id/submit when the exam hides
         results, GET /attempts/:id/result, or GET /analytics/students/me/performance.
Evidence: attempts.service.ts:108-116; analytics.service.ts:147-159.
Suggested fix: One rule in G5, referenced by the others: the function in 3.6 and the endpoint
         list in 4.5. 403 RESULTS_NOT_AVAILABLE everywhere.

[M7] MAJOR
Where: classrooms/import-export-students.md "Preview Token Storage", OQ 2; question-bank/import-export.md OQ 1
Finding: Two imports with the same preview-then-confirm flow choose opposite designs. B10 keeps
         the preview, including plaintext passwords, in an in-memory map for 5 minutes; C6 is
         client-stateful. The in-memory map loses previews on restart and breaks with a second
         API instance. Its stated purpose, preventing tampering, does not hold: the teacher is
         the only party, and confirm must re-validate every row anyway.
Suggested fix: Make B10 stateless like C6: confirm receives the rows and re-classifies them in
         the transaction. Remove INVALID_PREVIEW_TOKEN. Designed this way in 4.2. If the token
         is kept instead, the change is local to the classrooms package.

[M8] MAJOR
Where: G9 OQ 5 (UTC+7), F10 OQ-04 (UTC), H8-A-03 (UTC with label), B10 assumption 5 (DD/MM/YYYY)
Finding: Four defaults for time zone and date format in exported files.
Suggested fix: Asia/Ho_Chi_Minh, DD/MM/YYYY HH:mm, in every export.

[M9] MAJOR
Where: classroom-dashboard.md B7-R4, R5, R7; student-progress-tracking.md B8-R3 to R5;
       submission-tracking.md 5.8; start-exam.md E1-BR-04
Finding: These specs match attempts to an assignment by exam and student. When one exam is
         assigned to two classrooms that share a student, the attempt is counted in both, and
         F3 lists every member even when the assignment targets specific students (D11).
         Separately, maxAttempts is counted per exam, so that student gets one set of attempts
         across both classrooms; no spec says this.
Suggested fix: Match on attempt.assignmentId, falling back to the exam for attempts where it is
         NULL. F3's student list is the targets when the assignment has them. State in E1 that
         maxAttempts is per exam, across assignments.

[M10] MAJOR
Where: notifications/notification-management.md 5.3 rule 2
Finding: "Idempotency by checking recent notifications" is a check followed by a write; two
         concurrent requests both pass the check.
Suggested fix: Unique (userId, dedupeKey) and createMany with skipDuplicates (3.9).

[M11] MAJOR
Where: notifications/deadline-reminders.md J5-BR-13, J5-BR-14, 5.9 "Concurrency"
Finding: BR-13 selects reminders whose time falls in [NOW - checkInterval, NOW]; BR-14 requires a
         missed reminder to be sent on the next run. A reminder missed by more than one interval
         is outside BR-13's window. The "in-memory flag" is not a concurrency mechanism. Nothing
         says what happens when two intervals are due at once, for example an assignment created
         30 minutes before its deadline, which would send two reminders in the same minute.
Suggested fix: Select by "reminder time <= now < dueAt and no tracking row". Rely on the unique
         constraint. When several intervals are due together, mark all and send one.

[M12] MAJOR
Where: grading/export-results.md G9-BR-12, G9-EC-07, OQ 3
Finding: Recalculating per-question points at export ignores manual grades (F8) and can disagree
         with the stored score.
Suggested fix: Read Answer.earnedPoints.

[M13] MAJOR
Where: student-file-submission.md F7-BR-08 ("soft-deletes"), 5.8 model, F7-BR-11
Finding: The model has no deletedAt and has a unique (attemptId, originalName); a soft-deleted
         row would block re-uploading the same name.
Suggested fix: Hard delete.

[M14] MAJOR
Where: examination/submit-exam.md E3-BR-08; AD-11
Finding: submittedAt = NOW for an auto-submit. Under lazy expiry "now" can be days after the
         deadline, which corrupts "last activity" (B8-R6), ranking order and exported times.
Suggested fix: submittedAt = min(now, expiresAt).

[M15] MAJOR
Where: authentication/register.md OQ-A1-03; password-reset.md OQ-A3-04; admin-dashboard.md A6-BR-04
Finding: (a) Lower-casing email at login without touching stored rows locks out anyone who
         registered with capitals. (b) Password minimum is 8 at registration and 6 at reset and
         profile. (c) A6-BR-04 covers login but not POST /auth/refresh.
Suggested fix: (a) store new emails lower-cased, match case-insensitively at login; no data
         change. (b) 8 everywhere except teacher-set passwords (A7-BR-06). (c) refresh returns
         403 ACCOUNT_DISABLED.

[M16] MAJOR
Where: manual-grading-workflow.md F8-BR-06, F8-BR-07, AS-04
Finding: "Fully graded when all answers have a non-null earnedPoints" is undefined for questions
         with no answer row, and BR-06 leaves every ESSAY null, including blank ones the teacher
         has nothing to read.
Suggested fix: total = number of exam questions; graded = total minus answers with NULL
         earnedPoints. A blank or missing ESSAY answer is graded 0 automatically.

[M17] MAJOR
Where: docs/TECHNICAL_DECISIONS.md PD-02, PD-04, AD-06, AD-07
Finding: PD-02 (no admin) and PD-04 (MCQ only) contradict the specs and rulings D1 and D2; AD-07
         names a route and field casing the code never had.
Suggested fix: Technical writer updates them when D1 to D8 are copied over.

[m1] MINOR
Where: section 5.11 of most specs
Finding: Acceptance criteria are Gherkin blocks without IDs (only A1 to A6 have AC-xx-nn). The
         orchestrator asked for AC IDs per package; they do not exist. Section 7 cites spec
         sections and business-rule IDs instead.
Suggested fix: Number the scenarios, or QA numbers them in test-plan.md.

[m2] MINOR
Where: exams/exam-preview.md (feature D6, rules D5-Rnn); availability-window.md (feature D7, rules D6-Rnn)
Finding: Rule prefixes are one behind the feature IDs in the index.
Suggested fix: Renumber, or note the offset in the index.

[m3] MINOR
Where: exams/assign-to-students.md D11-R01, D11-A03, D11-Q04
Finding: "No target rows" means "whole class". If the last targeted student's account is ever
         deleted, the cascade silently turns a targeted assignment into a whole-class one.
         No feature deletes accounts today.
Suggested fix: Record as a known limitation; add a stored targetType if account deletion is built.

[m4] MINOR
Where: analytics/export-reports.md step 6; grading/regrade.md preconditions
Finding: Both require status = PUBLISHED, which excludes ARCHIVED exams that have results.
Suggested fix: Exports accept PUBLISHED and ARCHIVED (as G9 does). Regrade stays PUBLISHED-only
         unless the BA says otherwise.

[Q1] QUESTION
Where: grading/auto-grading.md SHORT_ANSWER rule
Finding: Accepted answers are comma-separated, so an answer that contains a comma ("3,5") cannot
         be expressed. Is that acceptable?

[Q2] QUESTION
Where: examination/answer-questions.md E2-BR-02
Finding: A save that reaches the server one second after expiresAt is rejected and lost. The
         client flushes before its own timer ends, but clocks and networks differ. Is a short
         server-side grace wanted? The design has none.

[Q3] QUESTION
Where: start-exam.md E1-BR-02; create-classroom / edit-delete-classroom
Finding: Can a student start an exam through an assignment in an archived classroom? The design
         says no (NOT_ASSIGNED).

[Q4] QUESTION
Where: analytics/student-performance.md ranking; FEATURE_OPEN_QUESTIONS OQ-05
Finding: With maxAttempts > 1 the ranking lists a student once per attempt. OQ-05 says the last
         attempt counts. The design leaves the ranking as it is; confirm or change.
```
