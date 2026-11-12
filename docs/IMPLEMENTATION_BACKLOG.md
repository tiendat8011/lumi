# Lumi Lite — Implementation Backlog

Ordered, checkable tasks grouped by milestone. Each task is small enough to implement and verify independently. Dependencies noted where relevant.

---

## Milestone 0: Project Scaffolding

**Goal**: Working project structure with tooling, Docker Compose, and hello-world endpoints.
**Dependencies**: None
**Estimated effort**: 2–3 dev-days

- [ ] **M0-01: Initialize monorepo structure**
  Create `apps/api/` and `apps/web/` directories. Initialize root `package.json` (if using workspaces) or keep apps independent.
  _Acceptance_: Both directories exist with their own `package.json`.

- [ ] **M0-02: Scaffold NestJS backend**
  `nest new` or manual setup in `apps/api/`. Configure Fastify adapter. Add `@nestjs/config` for environment variables with validation (Joi or zod). Add `@nestjs/platform-fastify`.
  _Acceptance_: `npm run start:dev` starts the app, `GET /health` returns `{ success: true, data: { status: "ok" } }`.

- [ ] **M0-03: Scaffold Next.js frontend**
  `create-next-app` in `apps/web/`. Configure TypeScript strict mode. Add Tailwind CSS.
  _Acceptance_: `npm run dev` shows the default page.

- [ ] **M0-04: Configure Prisma**
  Install Prisma in `apps/api/`. Initialize with PostgreSQL provider. Create `prisma/schema.prisma` with datasource config. Add npm scripts for `prisma generate`, `prisma migrate dev`, `prisma migrate deploy`.
  _Acceptance_: `npx prisma db push` connects to PostgreSQL and creates empty schema.

- [ ] **M0-05: Docker Compose setup**
  Create `docker-compose.yml` with services: `postgres` (volume-mounted), `api` (Dockerfile), `web` (Dockerfile), `nginx` (reverse proxy config). Create `Dockerfile` for each app. Create `.env.example`.
  _Acceptance_: `docker-compose up` starts all services. Frontend reachable at `localhost`, API at `localhost/api`.

- [ ] **M0-06: Configure tooling**
  ESLint + Prettier for both apps. TypeScript strict mode. `.editorconfig`. Git hooks (husky + lint-staged) optional but recommended.
  _Acceptance_: `npm run lint` passes. `npm run format` works.

- [ ] **M0-07: Setup Jest for backend**
  Configure Jest with TypeScript in `apps/api/`. Add Supertest for e2e tests. Create test database configuration. Add npm scripts: `test`, `test:e2e`, `test:cov`.
  _Acceptance_: `npm run test` runs (even with 0 tests).

- [ ] **M0-08: Create common infrastructure**
  - `src/common/filters/http-exception.filter.ts` — global exception filter with standardized error envelope.
  - `src/common/interceptors/transform.interceptor.ts` — wraps responses in `{ success, data, meta }`.
  - `src/common/pipes/` — global ValidationPipe configuration.
  - `src/common/dto/pagination.dto.ts` — shared pagination query DTO.
  _Acceptance_: A test endpoint returns the envelope format. Validation errors return structured errors.

---

## Milestone 1: Auth & Users

**Goal**: Registration, login, JWT-based auth, role guards.
**Dependencies**: M0 complete
**Estimated effort**: 4–5 dev-days

- [ ] **M1-01: Create users table migration**
  Prisma schema: `users` table with `id` (UUID), `email` (unique), `password_hash`, `display_name`, `role` (enum: TEACHER, STUDENT), `created_at`, `updated_at`.
  _Acceptance_: Migration runs successfully. Table exists in PostgreSQL.

- [ ] **M1-02: Implement UsersModule and UsersService**
  `src/modules/users/` — UsersModule, UsersService with `findByEmail`, `findById`, `create` methods. No controller yet (access via AuthService).
  _Acceptance_: Unit tests pass for user creation and lookup.

- [ ] **M1-03: Implement AuthModule — register**
  `POST /auth/register` — validates email format, password strength (min 8 chars), display_name required, role must be TEACHER or STUDENT. Hash password with bcrypt. Return user (without password_hash).
  _Acceptance_: Can register a new user. Duplicate email returns 409. Weak password returns 400.

- [ ] **M1-04: Implement AuthModule — login**
  `POST /auth/login` — validates credentials, returns `{ access_token, refresh_token }`. Access token: 15min, contains `{ sub: userId, role }`. Refresh token: 7 days, stored hashed in DB.
  _Acceptance_: Valid credentials return tokens. Invalid credentials return 401.

- [ ] **M1-05: Implement JWT strategy and guards**
  - `JwtStrategy` (Passport) — validates access token, attaches user to request.
  - `JwtAuthGuard` — applied globally or per-route.
  - `RolesGuard` — checks `@Roles()` decorator against `request.user.role`.
  - `@CurrentUser()` decorator — extracts user from request.
  - `@Roles()` decorator — sets metadata for RolesGuard.
  _Acceptance_: Protected routes reject unauthenticated requests (401). Role-restricted routes reject wrong roles (403).

- [ ] **M1-06: Implement token refresh**
  `POST /auth/refresh` — accepts refresh token in body, validates against stored hash, returns new access token (and optionally rotates refresh token).
  _Acceptance_: Valid refresh token returns new access token. Expired/invalid refresh returns 401.

- [ ] **M1-07: Implement logout**
  `POST /auth/logout` — invalidates refresh token (delete from DB).
  _Acceptance_: After logout, refresh token no longer works.

- [ ] **M1-08: Implement GET /users/me**
  Returns current user profile (id, email, display_name, role, created_at). Requires authentication.
  _Acceptance_: Returns correct user data. Unauthenticated returns 401.

- [ ] **M1-09: Auth e2e tests**
  Full flow: register → login → access protected route → refresh → logout → refresh fails.
  Test role guard: STUDENT cannot access TEACHER-only endpoint (use a stub endpoint if needed).
  _Acceptance_: All e2e tests pass.

---

## Milestone 2: Classrooms & Membership

**Goal**: Teachers create classrooms, students join by code.
**Dependencies**: M1 complete
**Estimated effort**: 3–4 dev-days

- [ ] **M2-01: Create classrooms and classroom_members migrations**
  `classrooms`: id, name, join_code (unique, 6-8 char alphanumeric), owner_id (FK users), timestamps.
  `classroom_members`: id, classroom_id (FK), user_id (FK), joined_at. Unique (classroom_id, user_id).
  _Acceptance_: Migrations run. Tables exist with correct constraints.

- [ ] **M2-02: Implement ClassroomsModule — create classroom**
  `POST /classrooms` — TEACHER only. Generate unique join_code. Validate name.
  _Acceptance_: Teacher creates classroom. Student gets 403.

- [ ] **M2-03: Implement list and get classrooms**
  `GET /classrooms` — TEACHER: list owned classrooms. STUDENT: list classrooms they're a member of.
  `GET /classrooms/:id` — Returns classroom detail. TEACHER must be owner, STUDENT must be member.
  _Acceptance_: Correct filtering by role and ownership/membership.

- [ ] **M2-04: Implement join classroom**
  `POST /classrooms/:id/join` — STUDENT only. Body: `{ join_code }`. Validates code matches classroom. Creates membership. Duplicate join returns 200 (idempotent).
  _Acceptance_: Student joins with correct code. Wrong code returns 400. Duplicate join succeeds silently.

- [ ] **M2-05: Implement list members**
  `GET /classrooms/:id/members` — TEACHER (owner) only. Returns list of members with user info.
  _Acceptance_: Owner sees members. Non-owner teacher gets 403. Student gets 403.

- [ ] **M2-06: Classroom e2e tests**
  Teacher creates classroom → student joins → teacher lists members → student lists classrooms.
  Edge cases: wrong code, duplicate join, unauthorized access.
  _Acceptance_: All e2e tests pass.

---

## Milestone 3: Question Bank

**Goal**: Teachers manage multiple-choice questions.
**Dependencies**: M1 complete (M2 not required)
**Estimated effort**: 3–4 dev-days

- [ ] **M3-01: Create questions and question_options migrations**
  `questions`: id, owner_id (FK users), type (enum: MCQ), content (text), explanation (text, nullable), timestamps.
  `question_options`: id, question_id (FK), content (text), is_correct (boolean), position (int).
  _Acceptance_: Migrations run. Constraints correct.

- [ ] **M3-02: Implement create question**
  `POST /questions` — TEACHER only. Body includes question content and array of options. Validate: at least 2 options, exactly 1 marked is_correct. Create question and options in transaction.
  _Acceptance_: Valid question created. Validation errors for missing options or no correct answer.

- [ ] **M3-03: Implement list and get questions**
  `GET /questions` — TEACHER only. List own questions with pagination. Include options in response.
  `GET /questions/:id` — TEACHER, own question only.
  _Acceptance_: Teacher sees own questions only. Pagination works.

- [ ] **M3-04: Implement update question**
  `PATCH /questions/:id` — TEACHER, own question. Can update content, explanation, and options (replace all options strategy).
  _Acceptance_: Updated question reflects changes. Cannot update another teacher's question.

- [ ] **M3-05: Implement delete question**
  `DELETE /questions/:id` — TEACHER, own question. Hard delete (or soft delete if referenced by exam_questions).
  Consider: if question is referenced by a published exam's snapshot, deletion is safe (snapshot is independent). If referenced by a draft exam's exam_questions, cascade or prevent.
  _Acceptance_: Deleted question no longer appears in listing.

- [ ] **M3-06: Question bank e2e tests**
  CRUD flow. Validation tests. Authorization tests (student cannot access, teacher cannot access other teacher's questions).
  _Acceptance_: All e2e tests pass.

---

## Milestone 3A: File Upload & Image Support

**Goal**: Teachers upload images into questions. Students see images in exams.
**Dependencies**: M0 (Docker Compose), M3 (Question Bank)
**Estimated effort**: 3–4 dev-days

- [ ] **M3A-01: Add MinIO to Docker Compose**
  Add MinIO service with `lumi-uploads` bucket. Configure public-read or presigned URL access. Add env vars: `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`.
  _Acceptance_: `docker-compose up` starts MinIO. Bucket accessible.

- [ ] **M3A-02: Implement UploadsModule + S3 client**
  `src/modules/uploads/` — UploadsModule, UploadsService. Configure `@aws-sdk/client-s3`. Methods: `uploadImage(file): { url, key }`, `deleteImage(key)`.
  _Acceptance_: Unit test uploads a buffer to MinIO and gets a URL.

- [ ] **M3A-03: `POST /uploads/images` endpoint**
  TEACHER only. Accept multipart (`@UseInterceptors(FileInterceptor)`). Validate: type whitelist (jpg, png, webp, gif), max 5MB. Generate UUID filename. Upload to S3. Return `{ url, key }`.
  _Acceptance_: Upload image → get URL → URL serves the image. Reject non-image, reject >5MB.

- [ ] **M3A-04: Update question content to support images**
  No schema change. Document convention: content supports Markdown image syntax `![alt](url)` or HTML `<img src="url">`. Update CreateQuestionDto docs/examples.
  _Acceptance_: Question with image URL in content created successfully.

- [ ] **M3A-05: Frontend: image upload component**
  Reusable upload button for question form. Shows upload progress, preview. On success, inserts `![](url)` into content textarea/editor.
  _Acceptance_: Teacher uploads image and sees it in question preview.

- [ ] **M3A-06: Frontend: render images in exam-taking view**
  Parse and render images in question and option display during exam.
  _Acceptance_: Student sees images inline when taking exam.

- [ ] **M3A-07: E2e tests: upload flow**
  Upload → create question with image → publish exam with snapshot → student sees image.
  _Acceptance_: All e2e tests pass.

---

## Milestone 3B: Google Docs Import

**Goal**: Teachers import exam questions from `.docx` files exported from Google Docs.
**Dependencies**: M3 (Question Bank), M3A (Image Upload — for embedded images)
**Estimated effort**: 4–5 dev-days

- [ ] **M3B-01: Define template format + teacher guide**
  Document the convention for writing questions in Google Docs:
  ```
  Câu 1. Question text here?
  A. Option A
  B. Option B
  *C. Correct option (marked with *)
  D. Option D
  ```
  Create a sample Google Doc template. Write a short guide for teachers.
  _Acceptance_: Template exists. Guide is clear.

- [ ] **M3B-02: .docx → HTML parser service**
  `src/modules/question-bank/import/docx-parser.service.ts`. Use `mammoth` to convert `.docx` to HTML. Handle Vietnamese text encoding.
  _Acceptance_: Unit test: sample .docx → valid HTML output.

- [ ] **M3B-03: Question extractor logic**
  `src/modules/question-bank/import/question-extractor.service.ts`. Parse HTML to extract:
  - Questions (detect `Câu X.` or numbered patterns)
  - Options (`A.`/`B.`/`C.`/`D.` patterns)
  - Correct answer (`*` prefix or bold formatting)
  Return `{ questions: [{ content, options: [{ content, is_correct }] }], warnings: string[] }`.
  _Acceptance_: Unit tests with various formats: standard, missing correct answer, extra whitespace, Vietnamese diacritics.

- [ ] **M3B-04: Extract embedded images from .docx**
  When parsing, extract embedded images from the .docx → upload to S3 via UploadsService → replace image references in content with S3 URLs.
  _Acceptance_: .docx with embedded image → question content contains S3 image URL.

- [ ] **M3B-05: `POST /questions/import` — parse and preview**
  TEACHER only. Accept `.docx` multipart. Parse → extract → return preview with warnings. Do not save yet.
  _Acceptance_: Upload .docx → get structured preview. Warnings for unparseable sections.

- [ ] **M3B-06: `POST /questions/import/confirm` — batch create**
  TEACHER only. Accept the previewed questions (possibly edited by teacher). Batch-create questions + options in transaction.
  _Acceptance_: Confirmed questions appear in question bank.

- [ ] **M3B-07: Frontend: import flow UI**
  Import page: upload .docx → show parsed questions preview → allow edit/remove individual questions → confirm button → success with count.
  _Acceptance_: Full import flow works in UI. Warnings displayed.

- [ ] **M3B-08: E2e tests + edge cases**
  Empty file, bad format, no correct answers, embedded images, large file, mixed formatting.
  _Acceptance_: All e2e tests pass. Graceful handling of bad input.

---

## Milestone 4: Exam Creation & Publishing

**Goal**: Teachers create exams, add questions, publish (with snapshot).
**Dependencies**: M3 complete
**Estimated effort**: 4–5 dev-days

- [ ] **M4-01: Create exams and exam_questions migrations**
  `exams`: id, owner_id (FK), title, description (nullable), duration_seconds (int), available_from (nullable timestamp), available_until (nullable timestamp), status (enum: DRAFT, PUBLISHED, ARCHIVED), max_attempts (int, default 1), show_result_immediately (boolean, default true), timestamps.
  `exam_questions`: id, exam_id (FK), source_question_id (FK, nullable), points (int), position (int), content_snapshot (text, nullable — filled on publish), options_snapshot (JSONB, nullable — filled on publish). Unique (exam_id, position).
  _Acceptance_: Migrations run. Tables and constraints correct.

- [ ] **M4-02: Implement create and update exam**
  `POST /exams` — TEACHER only. Creates DRAFT exam. Validates title, duration_seconds > 0.
  `PATCH /exams/:id` — TEACHER, own DRAFT exam only. Cannot modify PUBLISHED/ARCHIVED.
  _Acceptance_: DRAFT exam created. Cannot patch published exam.

- [ ] **M4-03: Implement exam question management**
  `POST /exams/:id/questions` — Add question from own question bank. Body: `{ question_id, points, position }`. Creates exam_question row. Only for DRAFT exams.
  `DELETE /exams/:id/questions/:eqId` — Remove from DRAFT exam.
  `PATCH /exams/:id/questions/:eqId` — Update points/position in DRAFT exam.
  _Acceptance_: Questions added/removed/reordered. Cannot modify published exam's questions.

- [ ] **M4-04: Implement list and get exams**
  `GET /exams` — TEACHER only. List own exams with status and question count.
  `GET /exams/:id` — TEACHER (owner): full detail with questions. For PUBLISHED, show snapshots.
  _Acceptance_: Correct listing. Detail includes questions.

- [ ] **M4-05: Implement publish exam**
  `POST /exams/:id/publish` — TEACHER, own DRAFT exam. Validates: at least 1 question, all questions have points > 0, duration > 0. In transaction: for each exam_question, copy question content → content_snapshot, copy options → options_snapshot (JSONB). Set status = PUBLISHED.
  _Acceptance_: DRAFT transitions to PUBLISHED. Snapshots populated. Later edits to source question don't affect snapshot. Cannot publish with 0 questions.

- [ ] **M4-06: Exam e2e tests**
  Create → add questions → publish. Verify snapshot independence. Verify cannot modify published exam. Verify authorization.
  _Acceptance_: All e2e tests pass.

---

## Milestone 5: Assignment Flow

**Goal**: Teachers assign published exams to classrooms. Students see assignments.
**Dependencies**: M2 + M4 complete
**Estimated effort**: 2–3 dev-days

- [ ] **M5-01: Create assignments migration**
  `assignments`: id, exam_id (FK), classroom_id (FK), assigned_at (default now), due_at (nullable timestamp), status (enum: ACTIVE, CLOSED). Unique (exam_id, classroom_id).
  _Acceptance_: Migration runs. Unique constraint verified.

- [ ] **M5-02: Implement create assignment**
  `POST /exams/:id/assignments` — TEACHER. Validates: teacher owns exam, exam is PUBLISHED, teacher owns classroom, not already assigned to this classroom.
  _Acceptance_: Assignment created. Violations return correct error codes.

- [ ] **M5-03: Implement list assignments**
  `GET /assignments` — Role-based:
  - TEACHER: list assignments for own exams (filterable by exam_id).
  - STUDENT: list assignments for classrooms they're a member of, with exam summary.
  _Acceptance_: Student sees correct assignments. Teacher sees own exam assignments.

- [ ] **M5-04: Implement get assignment detail**
  `GET /assignments/:id` — Accessible to classroom members and exam owner. Returns exam summary (title, duration, available window), classroom name, status.
  _Acceptance_: Authorized users see detail. Others get 403.

- [ ] **M5-05: Assignment e2e tests**
  Assign published exam → student sees it. Cannot assign draft. Cannot assign to unowned classroom. Duplicate returns error. Student not in classroom cannot see.
  _Acceptance_: All e2e tests pass.

---

## Milestone 6: Attempt Engine, Autosave & Expiry

**Goal**: Students start attempts, autosave answers, server enforces timing.
**Dependencies**: M5 complete
**Estimated effort**: 6–8 dev-days

- [ ] **M6-01: Create exam_attempts and answers migrations**
  `exam_attempts`: id, exam_id (FK), student_id (FK), assignment_id (FK, nullable), started_at, expires_at, submitted_at (nullable), status (enum: IN_PROGRESS, SUBMITTED, EXPIRED), score (decimal, nullable), created_at.
  `answers`: id, attempt_id (FK), exam_question_id (FK), answer_payload (JSONB), saved_at. Unique (attempt_id, exam_question_id).
  Index on (exam_id, student_id) for attempt count queries.
  _Acceptance_: Migrations run. Constraints and indexes verified.

- [ ] **M6-02: Implement start attempt**
  `POST /exams/:examId/attempts` — STUDENT only. Validates (in transaction):
  1. Student is member of a classroom with active assignment for this exam
  2. Exam is PUBLISHED
  3. Current server time within available_from/available_until
  4. Count of student's attempts for this exam < max_attempts
  5. No existing IN_PROGRESS attempt (check with row-level lock or unique partial index)
  Creates attempt: started_at = NOW(), expires_at = NOW() + duration_seconds.
  Returns attempt id, started_at, expires_at.
  _Acceptance_: Valid start creates attempt. All validation cases rejected correctly. Concurrent start requests produce only one attempt.

- [ ] **M6-03: Implement get attempt (student view)**
  `GET /attempts/:id` — STUDENT (owner) only. First, check lazy expiry (if NOW() > expires_at and status IN_PROGRESS → transition to EXPIRED). Return: attempt status, started_at, expires_at, exam questions from content_snapshot + options_snapshot **with is_correct stripped**, and saved answers.
  _Acceptance_: Student sees questions without correct answers. Expired attempt transitions on access.

- [ ] **M6-04: Implement autosave answer**
  `PUT /attempts/:id/answers/:examQuestionId` — STUDENT (owner). Body: `{ selected_option_id: string }`. Validates:
  1. Attempt status is IN_PROGRESS
  2. Attempt not expired (lazy check)
  3. exam_question_id belongs to this attempt's exam
  4. selected_option_id is valid option in the snapshot
  Uses Prisma upsert on (attempt_id, exam_question_id). Returns `{ saved_at }`.
  _Acceptance_: Saves answer. Retry with same data returns same result. Cannot save to expired attempt. Cannot save to wrong question.

- [ ] **M6-05: Implement lazy expiration**
  Create a reusable service method `checkAndExpireAttempt(attempt)` that:
  1. If status is IN_PROGRESS and NOW() > expires_at → update status to EXPIRED
  2. If auto-grade on expiry (see PD-11): also trigger grading
  3. Return updated attempt
  Call this method at the start of get-attempt, autosave, and submit handlers.
  _Acceptance_: Expired attempt correctly transitions. Subsequent operations on expired attempt are rejected (or auto-graded).

- [ ] **M6-06: Concurrency tests for attempt start**
  Write integration test that simulates concurrent `POST /exams/:id/attempts` from same student. Only one attempt should be created.
  _Acceptance_: Under concurrent requests, exactly one attempt exists. Others receive 409 or the existing attempt.

- [ ] **M6-07: Attempt engine e2e tests**
  Full flow: start → autosave multiple answers → verify saved → verify expiry behavior.
  Edge cases: start outside window, start when max attempts reached, autosave after expiry, autosave with invalid question.
  _Acceptance_: All e2e tests pass.

---

## Milestone 7: Idempotent Submit & Grading

**Goal**: Submit with auto-grading, safe under concurrent requests.
**Dependencies**: M6 complete
**Estimated effort**: 4–5 dev-days

- [ ] **M7-01: Implement grading service**
  `src/modules/grading/grading.service.ts` — `gradeAttempt(attemptId)`:
  1. Load attempt with exam_questions (snapshots) and answers
  2. For each exam_question: check if answer's selected_option_id matches the is_correct option in options_snapshot
  3. Score = sum of points for correct answers
  4. Return { score, totalPoints, results: [{ questionId, correct, points }] }
  _Acceptance_: Unit tests: all correct, all wrong, partial, unanswered questions score correctly.

- [ ] **M7-02: Implement submit endpoint**
  `POST /attempts/:id/submit` — STUDENT (owner). In transaction with SELECT FOR UPDATE:
  1. Load attempt with lock
  2. If SUBMITTED → return existing result (idempotent)
  3. If EXPIRED → return error or auto-grade (per decision PD-11)
  4. Check lazy expiry
  5. Call grading service
  6. Update attempt: status = SUBMITTED, submitted_at = NOW(), score
  7. Return result
  _Acceptance_: Submit grades and returns score. Second submit returns same score. Cannot submit another student's attempt.

- [ ] **M7-03: Concurrent submit test**
  Integration test: fire 5 simultaneous POST /attempts/:id/submit. Assert exactly one grading occurs, all return the same score.
  _Acceptance_: No double-grading. All responses identical.

- [ ] **M7-04: Submit e2e tests**
  Full flow: start → autosave → submit → get result. Double submit. Submit after expiry. Submit with no answers saved.
  _Acceptance_: All e2e tests pass.

---

## Milestone 8: Results & Teacher Views

**Goal**: Students see results. Teachers see class-level analytics.
**Dependencies**: M7 complete
**Estimated effort**: 3–4 dev-days

- [ ] **M8-01: Implement student result endpoint**
  `GET /attempts/:id/result` — STUDENT (owner). Returns:
  - If attempt not SUBMITTED/EXPIRED → 400 "attempt not completed"
  - If exam.show_result_immediately = false and no teacher override → 403 "results not yet available"
  - Otherwise: score, totalPoints, per-question breakdown (question content, student answer, correct answer, is_correct, points awarded)
  _Acceptance_: Student sees full result when allowed. Blocked when visibility is off.

- [ ] **M8-02: Implement teacher exam results**
  `GET /exams/:id/results` — TEACHER (exam owner). Returns:
  - List of all attempts for this exam
  - Each: student name, started_at, submitted_at, status, score, total points
  - Summary: average score, completion rate, score distribution
  Supports pagination.
  _Acceptance_: Teacher sees all students' attempts. Non-owner teacher gets 403.

- [ ] **M8-03: Implement teacher classroom results**
  `GET /classrooms/:id/results` — TEACHER (classroom owner). Returns:
  - List of assignments for this classroom with exam title
  - Per assignment: number of attempts, average score, completion count
  _Acceptance_: Classroom-level summary correct.

- [ ] **M8-04: Results e2e tests**
  Student result visibility with toggle. Teacher views. Authorization. Empty states.
  _Acceptance_: All e2e tests pass.

---

## Milestone 9: Frontend

**Goal**: Website hoàn chỉnh, responsive mobile-first, light/dark theme.
**Design system**: `docs/LMS_BRAND_COLOR_SYSTEM.md` — Trustworthy Blue brand
**Stack**: Next.js + Tailwind CSS + shadcn/ui
**Dependencies**: M0-M8 backend (có thể bắt đầu từ M2 trở đi, làm xen kẽ)
**Estimated effort**: 10–12 dev-days

- [ ] **M9-01: Tailwind + shadcn/ui setup + brand tokens**
  Install shadcn/ui. Configure `globals.css` with CSS variables from brand system:
  - `:root` → light theme tokens (brand-primary `#2563EB`, neutrals, semantics)
  - `.dark` → dark theme tokens (brand-primary `#3B82F6`, dark neutrals)
  Map shadcn theme variables (`--primary`, `--background`, `--card`, etc.) to brand tokens.
  Setup `next-themes` for light/dark toggle.
  _Acceptance_: shadcn components render correctly in both themes. Brand colors applied. No hardcoded HEX in components.

- [ ] **M9-02: Auth pages + token management**
  Login and register pages — mobile-first forms, centered card layout.
  Token storage (httpOnly cookie hoặc secure localStorage).
  Axios/fetch interceptor for JWT refresh. Protected route middleware.
  _Acceptance_: Can register, login, access protected pages on cả phone và desktop. Token refresh works.

- [ ] **M9-03: Layout + responsive navigation**
  Desktop: sidebar navigation (collapse toggle). Mobile: bottom tab bar hoặc hamburger menu.
  Header: user info, role badge, theme switcher (light/dark).
  Active nav item = subtle blue-tinted background (per brand system).
  _Acceptance_: Navigation responsive trên 320px → 1440px. Theme toggle works.

- [ ] **M9-04: Dashboard page**
  Teacher: classrooms list + exams list với quick action buttons (Primary Blue).
  Student: classrooms + assigned exams với status badges (semantic colors).
  Card-based layout, responsive grid (1 col mobile, 2-3 col desktop).
  _Acceptance_: Correct content per role. Responsive. Both themes.

- [ ] **M9-05: Classroom management pages**
  Teacher: create classroom form, view classroom detail (join code với copy button), member list (responsive table → card list on mobile).
  Student: join classroom form, view classroom.
  _Acceptance_: Full classroom flow works on phone và desktop.

- [ ] **M9-06: Question bank pages + image upload + import**
  Danh sách câu hỏi (paginated, search). Tạo/sửa form with options + image upload button (preview inline).
  Import .docx flow: upload → preview parsed questions → edit → confirm.
  Delete với confirmation dialog.
  _Acceptance_: CRUD + image upload + import works in UI. Validation errors shown.

- [ ] **M9-07: Exam management pages**
  Create exam form, edit settings (duration, time window, max attempts, show results).
  Add/remove/reorder questions from bank — searchable question picker.
  Publish button with confirmation. Status badge (DRAFT/PUBLISHED/ARCHIVED).
  _Acceptance_: Full exam creation flow works. Cannot modify published.

- [ ] **M9-08: Assignment pages**
  Teacher: assign dialog (select classroom from owned classrooms).
  Student: assigned exams list with status, time remaining, availability info.
  Badges: Active (info blue), Completed (success green), Overdue (error red).
  _Acceptance_: Assignment flow works. Status badges semantic colors.

- [ ] **M9-09: Exam-taking view (ưu tiên cao nhất)**
  Neutral background workspace (per brand system — calm, distraction-free).
  Question display: content + options + image support. Render Markdown/HTML images.
  Selected answer: subtle blue tint + primary border + radio indicator. NOT saturated full card.
  Timer: countdown from server `expires_at`. Display: warning amber ≤5min, error red ≤1min.
  Autosave: debounce 3s, status indicator (saving/saved/error), retry on network failure.
  Question navigation: sidebar (desktop) / bottom scroll (mobile). Show answered/unanswered count.
  Submit: confirmation dialog. Auto-submit when timer hits 0.
  _Acceptance_: Full exam flow on phone and desktop. Autosave works. Timer accurate. Auto-submit works.

- [ ] **M9-10: Result pages**
  Student: score card + per-question breakdown. Correct = success green + checkmark. Incorrect = error red + x-mark. Always with text label, not color alone.
  Teacher: exam results table (sortable, paginated). Summary stats: average, median, completion rate. Cyan accent for progress charts.
  _Acceptance_: Results display correctly in both themes. Accessible.

- [ ] **M9-11: Error handling, loading states, polish**
  Global error boundary. Loading skeletons (shadcn Skeleton component). Toast notifications (autosave, errors, success).
  Disabled state styling (muted neutral, per brand system). Empty states with illustrations or messages.
  Verify all interaction states in both themes: hover, active, focus-visible, selected, disabled, loading, error, success.
  _Acceptance_: No unhandled errors. WCAG AA contrast. Both themes verified.

---

## Milestone 10: Deployment Hardening

**Goal**: Production-ready deployment with backups and monitoring.
**Dependencies**: M0-M9 complete
**Estimated effort**: 3–4 dev-days

- [ ] **M10-01: Production Docker Compose**
  `docker-compose.prod.yml` with resource limits, production env vars, restart policies. Multi-stage Dockerfiles for smaller images.
  _Acceptance_: `docker-compose -f docker-compose.prod.yml up -d` starts production stack.

- [ ] **M10-02: Nginx configuration**
  TLS (Let's Encrypt / certbot), gzip compression, rate limiting, security headers, reverse proxy to frontend and backend.
  _Acceptance_: HTTPS works. Rate limiting tested.

- [ ] **M10-03: Database backup and restore**
  Backup script: pg_dump → compressed file → (optional) offsite copy. Cron job for daily backups. Retention policy (keep last 7 daily + 4 weekly).
  Restore procedure: documented and tested.
  _Acceptance_: Backup runs. Restore to a test database succeeds. Documented in README.

- [ ] **M10-04: Logging and monitoring**
  Structured logging (pino via Fastify). Log rotation. Health check endpoint monitored externally (uptime robot or similar). Optional: Sentry for error tracking.
  _Acceptance_: Logs are structured JSON. Health check accessible.

- [ ] **M10-05: k6 load test**
  Script modeling 100-user exam scenario: login → list assignments → start attempt → autosave (5 answers, 3-sec interval) → submit. Run against staging.
  _Acceptance_: Script runs. Results documented. Bottlenecks identified and addressed.

- [ ] **M10-06: README and operations documentation**
  Setup instructions, deployment procedure, backup/restore steps, environment variables reference, common troubleshooting.
  _Acceptance_: A new developer can set up the project from the README alone.
