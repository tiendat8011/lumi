# Lumi Lite — Feature → Code Map

> Last updated: 2026-11-18
> Derived by reading the code listed in each row, not from any other document.

## What this document is for

`docs/FEATURE_DOCUMENTATION_INDEX.md` answers "what is this feature supposed to
do?" — it maps a Feature ID to its specification, priority and complexity. It
does not say where the feature lives in the source tree.

This document answers the other half of the question: **for a given feature,
which files hold its logic, which HTTP routes expose it, which web page shows
it, and which database tables it touches.** The Feature ID column is the join
key between the two documents: look a feature up here to find its code, and
there to find its spec, priority and complexity. Priority and complexity are
deliberately not repeated here.

### How to read a row

- **Every path is relative to the repository root**, so it can be checked with
  `test -e` from the root without any rewriting. Specification paths therefore
  begin `docs/features/`, while the index links to the same files without that
  prefix because the index itself lives inside `docs/`.
  There is exactly one path in this document that does not exist, and it is
  cited precisely because it does not:
  `apps/web/src/app/forgot-password/` in the A3 row. Any other unresolvable
  path is a defect in this document.
- **Feature ID** is the ID used by `docs/FEATURE_DOCUMENTATION_INDEX.md`. A
  dash (`—`) means the feature is not in that index at all; the index is dated
  2026-11-12 and three features have landed since.
- **HTTP route(s)** omit the global `/api` prefix, which is set in
  `apps/api/src/common/configure-app.ts`. A route written `POST /auth/login` is
  served at `/api/auth/login`. The role in brackets is the role that the
  `@Roles()` decorator on the handler (or on its controller class) requires;
  `[public]` means the handler carries `@Public()` and needs no token.
  `JwtAuthGuard` and `RolesGuard` are global, registered in
  `apps/api/src/app.module.ts`, so a route with no annotation requires a valid
  token and accepts either role.
- **Status in code** uses the vocabulary of the other feature documents, with
  one addition. The exact meaning here is:
  - **Existing** — API and web UI are both present and wired to each other.
  - **API only** — endpoints exist and work; no web UI reaches them.
  - **Partial** — some of the behaviour the spec describes is in the code and
    some is not; the row says which part.
  - **Unreachable** — the logic exists as a file but nothing calls it: no
    controller route and no other service injects it. Listed separately in
    [Code that exists but nothing reaches](#code-that-exists-but-nothing-reaches).
  - **Not implemented** — no code. A specification may still exist.
  - **Schema only** — the Prisma model or field exists and is migrated, but no
    service reads or writes it.

---

## Where the API modules live

There are twelve modules under `apps/api/src/modules/`. Nine own a controller;
three do not, and that asymmetry is worth stating plainly because it is the
first thing that confuses a reader looking for a route.

| Module directory | Controller | Route prefix | Entry service |
|---|---|---|---|
| `apps/api/src/modules/auth/` | `auth.controller.ts` | `/auth` | `auth.service.ts` |
| `apps/api/src/modules/classrooms/` | `classrooms.controller.ts` | `/classrooms` | `classrooms.service.ts` |
| `apps/api/src/modules/question-bank/` | `questions.controller.ts` | `/questions` | `questions.service.ts` |
| `apps/api/src/modules/exams/` | `exams.controller.ts` | `/exams` | `exams.service.ts` |
| `apps/api/src/modules/attempts/` | `attempts.controller.ts` | `/attempts` | `attempts.service.ts` |
| `apps/api/src/modules/assignments/` | `assignments.controller.ts` | `/assignments` | `assignments.service.ts` |
| `apps/api/src/modules/analytics/` | `analytics.controller.ts` | `/analytics` | `analytics.service.ts` |
| `apps/api/src/modules/notifications/` | `notifications.controller.ts` | `/notifications` | `notifications.service.ts` |
| `apps/api/src/modules/storage/` | `uploads.controller.ts` | `/uploads` | `storage.service.ts` |
| `apps/api/src/modules/grading/` | none | — | `grading.service.ts` |
| `apps/api/src/modules/users/` | none | — | `users.service.ts` |
| `apps/api/src/modules/mail/` | none | — | `mail.service.ts` |

Two names do not line up, and both are easy to trip over:

- **`storage` is served at `/uploads`.** The module directory is
  `apps/api/src/modules/storage/`, but its controller is
  `apps/api/src/modules/storage/uploads.controller.ts` and declares
  `@Controller('uploads')`. Searching the source for `storage.controller.ts`
  finds nothing.
- **`grading` has no routes of its own.** Nothing is served under `/grading`.

### The three modules without a controller

| Module | Reached through | Call sites |
|---|---|---|
| `grading` | `/attempts` and `/exams` | `apps/api/src/modules/attempts/attempts.service.ts` imports `GradingService`, `AttemptLifecycleService`, and the pure functions in `grading-engine.ts`, `question-view.ts` and `result-visibility.ts`. `apps/api/src/modules/exams/exams.service.ts` imports `GradingService` for publish and regrade. Both modules import `GradingModule` in `apps/api/src/modules/attempts/attempts.module.ts` and `apps/api/src/modules/exams/exams.module.ts`. |
| `users` | `/auth` | `apps/api/src/modules/auth/auth.service.ts` and `apps/api/src/modules/auth/auth.controller.ts` both inject `UsersService`; `apps/api/src/modules/auth/auth.module.ts` imports `UsersModule`. The module's second provider, `StudentAccountsService`, has no caller at all — see the unreachable-code section. |
| `mail` | nothing | `MailModule` is listed in `apps/api/src/app.module.ts`, but no service in `apps/api/src/` injects `MailService`. It is wired into the application and then never used. |

### Non-obvious logic files

A reader looking for the rule that decides a score or masks a result will not
find it in a `*.service.ts` file. These are the files that carry the real
decisions:

| File | What it decides |
|---|---|
| `apps/api/src/modules/grading/grading-engine.ts` | The list of valid question types (`QUESTION_TYPES`), how one answer is graded per type (`gradeAnswer`), and how the per-question points become the final score (`computeScore`). `ALL_OR_NOTHING` versus `PARTIAL` is decided here. |
| `apps/api/src/modules/grading/question-view.ts` | What a student is allowed to see of a question (`toStudentQuestion` strips the correct answer), and the deterministic per-attempt shuffle of questions and options. |
| `apps/api/src/modules/grading/result-visibility.ts` | Whether a student may see their own result yet (`canStudentSeeResults`) and how an attempt is masked when they may not (`maskAttemptForStudent`). |
| `apps/api/src/modules/grading/attempt-lifecycle.service.ts` | Finalising an attempt: submit by student, lazy expiry on access (`submitIfExpired`), and the sweep of expired attempts (`sweepExpired`). |
| `apps/api/src/modules/question-bank/docx-parser.ts` | Turning an uploaded `.docx` into draft questions. |
| `apps/api/src/modules/question-bank/question-validation.ts` | Which question types need options, which need exactly one correct option, and which need a `correctAnswer` key. |
| `apps/api/src/modules/question-bank/question-selection.service.ts` | Random question selection by criteria. Unreachable — nothing injects it. |
| `apps/api/src/modules/notifications/notification-events.service.ts` | One method per domain event that should produce notifications. Four of its seven methods have no caller. |
| `apps/api/src/modules/notifications/reminders.service.ts` | A `@Cron('*/5 * * * *')` job that sends deadline reminders. |
| `apps/api/src/modules/users/student-accounts.service.ts` | Bulk creation of student accounts by a teacher. Unreachable — no endpoint. |
| `apps/api/src/modules/storage/upload.util.ts` | Reading and size-checking a multipart upload (`readUpload`). |
| `apps/api/src/common/csv/csv.util.ts` | CSV serialisation and download helpers. Unreachable — no caller. |

### Where the web UI lives

Eighteen routes exist under `apps/web/src/app/`. Each is a `page.tsx` in the
directory named by its route:

| Route | File |
|---|---|
| `/` | `apps/web/src/app/page.tsx` |
| `/login` | `apps/web/src/app/login/page.tsx` |
| `/register` | `apps/web/src/app/register/page.tsx` |
| `/dashboard` | `apps/web/src/app/dashboard/page.tsx` |
| `/dashboard/analytics` | `apps/web/src/app/dashboard/analytics/page.tsx` |
| `/dashboard/assignments` | `apps/web/src/app/dashboard/assignments/page.tsx` |
| `/dashboard/classrooms` | `apps/web/src/app/dashboard/classrooms/page.tsx` |
| `/dashboard/classrooms/[id]` | `apps/web/src/app/dashboard/classrooms/[id]/page.tsx` |
| `/dashboard/exams` | `apps/web/src/app/dashboard/exams/page.tsx` |
| `/dashboard/exams/[id]` | `apps/web/src/app/dashboard/exams/[id]/page.tsx` |
| `/dashboard/grading` | `apps/web/src/app/dashboard/grading/page.tsx` |
| `/dashboard/import-questions` | `apps/web/src/app/dashboard/import-questions/page.tsx` |
| `/dashboard/my-results` | `apps/web/src/app/dashboard/my-results/page.tsx` |
| `/dashboard/notifications` | `apps/web/src/app/dashboard/notifications/page.tsx` |
| `/dashboard/profile` | `apps/web/src/app/dashboard/profile/page.tsx` |
| `/dashboard/questions` | `apps/web/src/app/dashboard/questions/page.tsx` |
| `/dashboard/results` | `apps/web/src/app/dashboard/results/page.tsx` |
| `/dashboard/take-exam/[examId]` | `apps/web/src/app/dashboard/take-exam/[examId]/page.tsx` |

`apps/web/src/app/page.tsx` holds no feature of its own: it redirects to
`/dashboard` when a user is loaded and to `/login` otherwise.
`apps/web/src/app/dashboard/layout.tsx` is the shell for every `/dashboard/*`
route and carries the notification bell and the profile link.

One route is not reachable by clicking: **`/dashboard/results` has no link
anywhere in the app.** No `href` or `router.push` in `apps/web/src/app/` or
`apps/web/src/components/` targets it, and it is absent from the teacher link
list in `apps/web/src/components/sidebar-nav.tsx`. The page works if the URL is
typed, and it is a superset of `/dashboard/grading` — it adds the "release
results" control. See the discrepancies section.

---

## Module A: Authentication & User Management

| ID | Feature | Spec file | API logic file(s) | HTTP route(s) | Web UI file(s) + route | Prisma model(s) | Status in code |
|---|---|---|---|---|---|---|---|
| A1 | User Registration | `docs/features/authentication/register.md` | `apps/api/src/modules/auth/auth.service.ts` (`register`), `apps/api/src/modules/auth/dto/register.dto.ts`, `apps/api/src/modules/users/users.service.ts` (`create`) | `POST /auth/register` [public] | `apps/web/src/app/register/page.tsx` → `/register` | `User`, `RefreshToken` | Existing |
| A2 | Login / Logout / Token Refresh | `docs/features/authentication/login-logout.md` | `apps/api/src/modules/auth/auth.service.ts` (`login`, `refresh`, `logout`, `generateTokens`), `apps/api/src/modules/auth/strategies/jwt.strategy.ts`, `apps/api/src/modules/auth/dto/login.dto.ts`, `apps/api/src/modules/auth/dto/refresh.dto.ts` | `POST /auth/login` [public], `POST /auth/refresh` [public], `POST /auth/logout`, `GET /auth/me` | `apps/web/src/app/login/page.tsx` → `/login`; `apps/web/src/lib/auth-context.tsx` holds the session; `apps/web/src/lib/api.ts` retries once through `/auth/refresh` on a 401 | `User`, `RefreshToken` | Existing |
| A3 | Forgot / Reset Password | `docs/features/authentication/password-reset.md` | `apps/api/src/modules/auth/auth.service.ts` (`forgotPassword`, `resetPassword`), `apps/api/src/modules/auth/dto/forgot-password.dto.ts`, `apps/api/src/modules/auth/dto/reset-password.dto.ts` | `POST /auth/forgot-password` [public], `POST /auth/reset-password` [public] | **None.** No page calls either route; `apps/web/src/app/forgot-password/` does not exist and neither `/login` nor `/register` links to one | `PasswordResetToken`, `User` | API only. The reset token is returned in the response body rather than emailed — see the open items section |
| A4 | User Profile & Edit Profile | `docs/features/authentication/user-profile.md` | `apps/api/src/modules/auth/auth.service.ts` (`updateProfile`), `apps/api/src/modules/users/users.service.ts` (`updateProfile`), `apps/api/src/modules/auth/dto/update-profile.dto.ts` | `GET /auth/me`, `PATCH /auth/profile` | `apps/web/src/app/dashboard/profile/page.tsx` → `/dashboard/profile`; the header avatar and its link live in `apps/web/src/app/dashboard/layout.tsx` | `User` | Existing |
| A5 | Role-Based Access Control | `docs/features/authentication/role-management.md` | `apps/api/src/common/guards/jwt-auth.guard.ts`, `apps/api/src/common/guards/roles.guard.ts`, `apps/api/src/common/decorators/roles.decorator.ts`, `apps/api/src/common/decorators/public.decorator.ts`, `apps/api/src/common/decorators/current-user.decorator.ts`; both guards registered as `APP_GUARD` in `apps/api/src/app.module.ts` | Cross-cutting; applies to every route | `apps/web/src/components/protected-route.tsx` redirects by role; `apps/web/src/components/sidebar-nav.tsx` serves a different link list to each role | `Role` enum, `User.role` | Existing |
| A6 | Admin Dashboard | `docs/features/authentication/admin-dashboard.md` | No code | — | None | `Role.ADMIN` exists in the enum and is never assigned | Not implemented |
| A7 | Teacher Creates Student Accounts | `docs/features/authentication/teacher-create-students.md` | `apps/api/src/modules/users/student-accounts.service.ts` (`createStudents`), provided and exported by `apps/api/src/modules/users/users.module.ts` | **None.** No controller exposes it | None | `User.createdByTeacherId` (self-relation `CreatedStudents`) | Unreachable. The service and its unit test `apps/api/src/modules/users/student-accounts.service.spec.ts` exist; nothing injects the service |
| — | Google sign-in | No spec | `apps/api/src/modules/auth/auth.service.ts` (`googleLogin`, `profileFromIdToken`, `profileFromAccessToken`), `apps/api/src/modules/auth/dto/google-login.dto.ts`, `apps/api/src/modules/users/users.service.ts` (`findByGoogleId`, `linkGoogle`) | `POST /auth/google` [public] | `apps/web/src/components/social-login.tsx` (button), `apps/web/src/components/google-auth-provider.tsx` (SDK provider), `loginWithGoogle` in `apps/web/src/lib/auth-context.tsx`; rendered by `apps/web/src/app/login/page.tsx` and `apps/web/src/app/register/page.tsx` | `User.googleId`, `User.avatarUrl`; added by `apps/api/prisma/migrations/20261116100000_add_google_oauth_fields/migration.sql` | Existing. Newer than the index, so it has no Feature ID and no specification |

---

## Module B: Classroom Management

| ID | Feature | Spec file | API logic file(s) | HTTP route(s) | Web UI file(s) + route | Prisma model(s) | Status in code |
|---|---|---|---|---|---|---|---|
| B1 | Create Classroom | `docs/features/classrooms/create-classroom.md` | `apps/api/src/modules/classrooms/classrooms.service.ts` (`create`, `findAllForUser`, `findById`, and the `isOwner`/`isMember` checks every other method calls), `apps/api/src/modules/classrooms/dto/create-classroom.dto.ts` | `POST /classrooms` [TEACHER], `GET /classrooms`, `GET /classrooms/:id` | `apps/web/src/app/dashboard/classrooms/page.tsx` → `/dashboard/classrooms` (list and create dialog); `apps/web/src/app/dashboard/classrooms/[id]/page.tsx` → `/dashboard/classrooms/[id]` (detail) | `Classroom` | Existing. `GET /classrooms` returns owned classrooms for a teacher and joined ones for a student, decided by `findAllForUser` |
| B2 | Join Classroom via Code | `docs/features/classrooms/join-classroom.md` | `apps/api/src/modules/classrooms/classrooms.service.ts` (`joinByCode`, `join`), `apps/api/src/modules/classrooms/dto/join-classroom.dto.ts` | `POST /classrooms/join` [STUDENT], `POST /classrooms/:id/join` [STUDENT] | `apps/web/src/app/dashboard/classrooms/page.tsx` → `/dashboard/classrooms` (join dialog, calls `POST /classrooms/join`) | `Classroom.joinCode`, `ClassroomMember` | Existing. The per-id variant `POST /classrooms/:id/join` has no UI caller |
| B3 | Manage Students (List & Remove) | `docs/features/classrooms/manage-students.md` | `apps/api/src/modules/classrooms/classrooms.service.ts` (`getMembers`, `removeMember`) | `GET /classrooms/:id/members`, `DELETE /classrooms/:id/members/:memberId` [TEACHER] | `apps/web/src/app/dashboard/classrooms/[id]/page.tsx` → `/dashboard/classrooms/[id]` | `ClassroomMember`, `User` | Existing |
| B4 | Edit, Delete, Archive / Restore | `docs/features/classrooms/edit-delete-classroom.md` | `apps/api/src/modules/classrooms/classrooms.service.ts` (`update`, `delete`, `archive`, `unarchive`), `apps/api/src/modules/classrooms/dto/update-classroom.dto.ts` | `PATCH /classrooms/:id` [TEACHER], `DELETE /classrooms/:id` [TEACHER], `PATCH /classrooms/:id/archive` [TEACHER], `PATCH /classrooms/:id/unarchive` [TEACHER] | `apps/web/src/app/dashboard/classrooms/[id]/page.tsx` → `/dashboard/classrooms/[id]` calls `PATCH /classrooms/:id` and `DELETE /classrooms/:id` only | `Classroom`, `Classroom.archivedAt` | Partial. Edit and delete have UI; archive and unarchive are API only — no page calls either route |
| B5 | Classroom Announcements | `docs/features/classrooms/classroom-announcements.md` | No service reads or writes the table. The only reference is `announcementPosted` in `apps/api/src/modules/notifications/notification-events.service.ts`, which itself has no caller | — | None | `Announcement` | Schema only |
| B7 | Classroom Dashboard | `docs/features/classrooms/classroom-dashboard.md` | No code. `apps/web/src/app/dashboard/classrooms/[id]/page.tsx` shows a member list, not the per-classroom dashboard the spec describes | — | None | — | Not implemented |
| B8 | Student Progress Tracking | `docs/features/classrooms/student-progress-tracking.md` | No code dedicated to it. The nearest existing behaviour is `getStudentPerformance` in `apps/api/src/modules/analytics/analytics.service.ts` (see H1) | — | None | — | Not implemented |
| B10 | Import / Export Student List | `docs/features/classrooms/import-export-students.md` | No code. `apps/api/src/common/csv/csv.util.ts` provides the serialisation helpers an export would need, and nothing calls them | — | None | — | Not implemented |

---

## Module C: Question Bank

| ID | Feature | Spec file | API logic file(s) | HTTP route(s) | Web UI file(s) + route | Prisma model(s) | Status in code |
|---|---|---|---|---|---|---|---|
| C1 | Create Question | `docs/features/question-bank/create-question.md` | `apps/api/src/modules/question-bank/questions.service.ts` (`create`, `bulkCreate`), `apps/api/src/modules/question-bank/question-validation.ts`, `apps/api/src/modules/question-bank/dto/create-question.dto.ts`, `apps/api/src/modules/question-bank/dto/bulk-create-questions.dto.ts` | `POST /questions` [TEACHER], `POST /questions/bulk` [TEACHER] | `apps/web/src/app/dashboard/questions/page.tsx` → `/dashboard/questions` (create dialog, `POST /questions`); `apps/web/src/app/dashboard/import-questions/page.tsx` → `/dashboard/import-questions` (`POST /questions/bulk`) | `Question`, `QuestionOption` | Existing |
| C2 | Edit Question | `docs/features/question-bank/edit-question.md` | `apps/api/src/modules/question-bank/questions.service.ts` (`update`, `delete`), `apps/api/src/modules/question-bank/dto/update-question.dto.ts` | `PATCH /questions/:id` [TEACHER], `DELETE /questions/:id` [TEACHER], `GET /questions/:id` [TEACHER] | `apps/web/src/app/dashboard/questions/page.tsx` → `/dashboard/questions` | `Question`, `QuestionOption` | Existing |
| C3 | Question Types | `docs/features/question-bank/question-types.md` | `QuestionType` enum in `apps/api/src/modules/question-bank/dto/create-question.dto.ts` (eleven values), per-type rules in `apps/api/src/modules/question-bank/question-validation.ts`, grading per type in `apps/api/src/modules/grading/grading-engine.ts` (`gradeAnswer`) | Carried on `POST /questions` and `PATCH /questions/:id` as the `type` field | `apps/web/src/app/dashboard/questions/page.tsx` offers six of the eleven: `MCQ`, `MCQ_MULTI`, `TRUE_FALSE`, `SHORT_ANSWER`, `FILL_BLANK`, `ESSAY` | `Question.type` (a `String`, not a Prisma enum) | Partial. The five English types are accepted by the API and rendered during an attempt but cannot be authored in the UI — see the row below |
| C4 | Question Categories | `docs/features/question-bank/question-categories.md` | `apps/api/src/modules/question-bank/questions.service.ts` (`createCategory`, `getCategories`, `deleteCategory`), `apps/api/src/modules/question-bank/dto/create-category.dto.ts` | `POST /questions/categories` [TEACHER], `GET /questions/categories` [TEACHER], `DELETE /questions/categories/:id` [TEACHER] | `apps/web/src/app/dashboard/questions/page.tsx` → `/dashboard/questions` (category filter and create dialog) | `QuestionCategory` | Existing |
| C5 | Search & Filter | `docs/features/question-bank/search-filter.md` | `apps/api/src/modules/question-bank/questions.service.ts` (`findAll`), `apps/api/src/common/dto/pagination.dto.ts`, `apps/api/src/common/utils/text.ts` | `GET /questions` [TEACHER] with `search`, `categoryId`, `difficulty`, `type` query parameters | `apps/web/src/app/dashboard/questions/page.tsx` → `/dashboard/questions` (search box, type tabs, dropdown filters) | `Question`, `QuestionCategory`, `Difficulty` | Existing |
| C6 | Import / Export Questions | `docs/features/question-bank/import-export.md` | Import exists: `apps/api/src/modules/question-bank/docx-parser.ts` and `questions.service.ts` (`bulkCreate`). Export does not; `apps/api/src/common/csv/csv.util.ts` is uncalled | `POST /questions/parse-docx` [TEACHER], `POST /questions/bulk` [TEACHER] | `apps/web/src/app/dashboard/import-questions/page.tsx` → `/dashboard/import-questions`, linked from `/dashboard/questions` | `Question`, `QuestionOption` | Partial. `.docx` import is complete; there is no export of any kind |
| C12 | Question Groups | `docs/features/question-bank/question-groups.md` | No service reads or writes either table | — | None | `QuestionGroup`, `QuestionGroupItem` | Schema only |
| C13 | Random Question Selection | `docs/features/question-bank/random-question-selection.md` | `apps/api/src/modules/question-bank/question-selection.service.ts` (`count`, `pickRandom`), provided and exported by `apps/api/src/modules/question-bank/question-bank.module.ts` | **None** | None | `Question`, `QuestionCategory` | Unreachable. No controller exposes it and no other service injects it |
| — | English exercise types | No spec | Types declared in `apps/api/src/modules/question-bank/dto/create-question.dto.ts` and `apps/api/src/modules/question-bank/dto/update-question.dto.ts`; validated in `apps/api/src/modules/question-bank/question-validation.ts`; graded in `apps/api/src/modules/grading/grading-engine.ts`; presented to the student by `apps/api/src/modules/grading/question-view.ts`; snapshotted at publish by `apps/api/src/modules/exams/exams.service.ts` (`publish`); served to the attempt by `apps/api/src/modules/attempts/attempts.service.ts` | Carried on the question and exam routes; audio moves through `POST /uploads/audio` [TEACHER], `POST /uploads/student-audio`, `GET /uploads/audio/*` [public] | `apps/web/src/app/dashboard/take-exam/[examId]/page.tsx` → `/dashboard/take-exam/[examId]` plays `audioUrlSnapshot`, shows `passageSnapshot`, and records and uploads an answer for `SPEAKING`. **No authoring UI:** `apps/web/src/app/dashboard/questions/page.tsx` does not offer these five types and has no audio or passage field | `Question.audioUrl`, `Question.passage`, `ExamQuestion.audioUrlSnapshot`, `ExamQuestion.passageSnapshot`; added by `apps/api/prisma/migrations/20261114160808_add_audio_passage_fields/migration.sql` | Partial. `LISTENING_MCQ`, `LISTENING_FILL`, `READING_MCQ`, `READING_FILL` and `SPEAKING` can be created only through the API, not through the question bank page |

---

## Module D: Exam Management

| ID | Feature | Spec file | API logic file(s) | HTTP route(s) | Web UI file(s) + route | Prisma model(s) | Status in code |
|---|---|---|---|---|---|---|---|
| D1 | Create / Edit Exam | `docs/features/exams/create-exam.md` | `apps/api/src/modules/exams/exams.service.ts` (`create`, `update`, `findAllForOwner`, `findById`, `findByIdForOwner`, `assertDraft`), `apps/api/src/modules/exams/dto/create-exam.dto.ts`, `apps/api/src/modules/exams/dto/update-exam.dto.ts` | `POST /exams`, `GET /exams`, `GET /exams/:id`, `PATCH /exams/:id` — the whole controller class carries `@Roles('TEACHER')` | `apps/web/src/app/dashboard/exams/page.tsx` → `/dashboard/exams` (list and create dialog); `apps/web/src/app/dashboard/exams/[id]/page.tsx` → `/dashboard/exams/[id]` (detail) | `Exam` | Existing |
| D2 | Exam Configuration | `docs/features/exams/configure-exam.md` | `apps/api/src/modules/exams/exams.service.ts` (`create`, `update`, `validateWindow`); every field read through the two exam DTOs | `POST /exams`, `PATCH /exams/:id` [TEACHER] | `apps/web/src/app/dashboard/exams/page.tsx` sets `durationSeconds`, `instructions`, `maxAttempts`, `shuffleQuestions`, `shuffleOptions`, `accessCode`. It does not set `availableFrom`, `availableUntil`, `gradingMode` or `showResultImmediately` | `Exam` | Partial. The API accepts every configuration field; the UI exposes six of ten |
| D3 | Add / Remove / Reorder Questions | `docs/features/exams/manage-questions.md` | `apps/api/src/modules/exams/exams.service.ts` (`addQuestion`, `removeQuestion`), `apps/api/src/modules/exams/dto/add-exam-question.dto.ts` | `POST /exams/:id/questions` [TEACHER], `DELETE /exams/:id/questions/:eqId` [TEACHER] | `apps/web/src/app/dashboard/exams/[id]/page.tsx` → `/dashboard/exams/[id]` | `ExamQuestion` (`position`, `points`) | Existing. Position is assigned on add; there is no reorder route and no drag-and-drop in the UI |
| D4 | Publish / Archive / Regrade | `docs/features/exams/publish-exam.md` | `apps/api/src/modules/exams/exams.service.ts` (`publish` writes the `*Snapshot` columns, `regrade`), with scoring from `apps/api/src/modules/grading/grading.service.ts` and `apps/api/src/modules/grading/grading-engine.ts` | `POST /exams/:id/publish` [TEACHER], `POST /exams/:id/regrade` [TEACHER] | `apps/web/src/app/dashboard/exams/[id]/page.tsx` calls publish. **No page calls regrade** | `Exam.status`, `ExamStatus` enum, every `ExamQuestion.*Snapshot` column | Partial. Publish has UI; regrade is API only. `ExamStatus` has no archived state, so "archive" from the spec title has no code |
| D5 | Assign Exam to Classroom | `docs/features/exams/assign-exam.md` | `apps/api/src/modules/assignments/assignments.service.ts` (`create`) — see F1 | `POST /assignments` [TEACHER] | `apps/web/src/app/dashboard/assignments/page.tsx` → `/dashboard/assignments` | `Assignment` | Existing |
| D6 | Exam Preview (Teacher) | `docs/features/exams/exam-preview.md` | No code. `apps/api/src/modules/attempts/attempts.service.ts` (`start`) is `@Roles('STUDENT')` only, so a teacher cannot open their own exam | — | None | — | Not implemented |
| D7 | Availability Window | `docs/features/exams/availability-window.md` | `apps/api/src/modules/exams/exams.service.ts` (`validateWindow`, and the `availableFrom`/`availableUntil` writes in `create` and `update`); enforced at `apps/api/src/modules/attempts/attempts.service.ts` (`start`), which rejects an attempt before `availableFrom` or after `availableUntil` | Carried on `POST /exams` and `PATCH /exams/:id`; enforced on `POST /attempts/start` | **None.** `apps/web/src/app/dashboard/exams/page.tsx` has no date inputs, so the window can only be set through the API | `Exam.availableFrom`, `Exam.availableUntil` | API only |
| D9 | Inline Question Creation in Exam | `docs/features/exams/inline-question-creation.md` | No code | — | None | — | Not implemented |
| D10 | Random Exam Generation | `docs/features/exams/random-exam-generation.md` | No code. Depends on C13, which is itself unreachable | — | None | — | Not implemented |
| D11 | Assign to Specific Students | `docs/features/exams/assign-to-students.md` | No service reads or writes the table | — | None | `AssignmentTarget` | Schema only |

---

## Module E: Online Examination

| ID | Feature | Spec file | API logic file(s) | HTTP route(s) | Web UI file(s) + route | Prisma model(s) | Status in code |
|---|---|---|---|---|---|---|---|
| E1 | Start Exam Attempt | `docs/features/examination/start-exam.md` | `apps/api/src/modules/attempts/attempts.service.ts` (`start`, `resolveAssignment`, `inProgressView`), `apps/api/src/modules/attempts/dto/start-attempt.dto.ts`, `apps/api/src/modules/grading/question-view.ts` (per-attempt shuffle and student projection), `apps/api/src/common/db/locks.ts` | `POST /attempts/start` [STUDENT] | `apps/web/src/app/dashboard/take-exam/[examId]/page.tsx` → `/dashboard/take-exam/[examId]`, entered from `/dashboard/exams` or `/dashboard/assignments` | `ExamAttempt`, `ExamAttempt.questionOrder` | Existing. Checks membership, `maxAttempts`, `accessCode` and the availability window |
| E2 | Answer Questions (Autosave) | `docs/features/examination/answer-questions.md` | `apps/api/src/modules/attempts/attempts.service.ts` (`saveAnswer`), `apps/api/src/modules/attempts/dto/save-answer.dto.ts`, `apps/api/src/modules/grading/grading-engine.ts` (`parseAnswerPayload`) | `POST /attempts/:id/answer` [STUDENT] | `apps/web/src/app/dashboard/take-exam/[examId]/page.tsx` → `/dashboard/take-exam/[examId]` | `Answer` (unique on `attemptId, examQuestionId`) | Existing |
| E3 | Submit Exam | `docs/features/examination/submit-exam.md` | `apps/api/src/modules/grading/attempt-lifecycle.service.ts` (`submitByStudent`, `finalize`, `submitIfExpired`, `sweepExpired`), `apps/api/src/modules/grading/grading.service.ts` (`gradeAttempt`). Timing comes from `ExamAttempt.expiresAt`, compared against the request clock; the helpers in `apps/api/src/common/utils/datetime.ts` are not involved | `POST /attempts/:id/submit` [STUDENT] | `apps/web/src/app/dashboard/take-exam/[examId]/page.tsx` → `/dashboard/take-exam/[examId]` | `ExamAttempt.status`, `ExamAttempt.submittedAt`, `ExamAttempt.score` | Existing. Expiry is evaluated lazily on request, per `docs/TECHNICAL_DECISIONS.md` |
| E4 | Resume Exam | `docs/features/examination/resume-exam.md` | `apps/api/src/modules/attempts/attempts.service.ts` (`start` returns the open attempt instead of creating a second one; `inProgressView` rebuilds the saved answers) | `POST /attempts/start` [STUDENT], `GET /attempts/:id` [STUDENT] | `apps/web/src/app/dashboard/take-exam/[examId]/page.tsx` → `/dashboard/take-exam/[examId]`, which resumes through `POST /attempts/start`. It never calls `GET /attempts/:id` | `ExamAttempt`, `Answer` | Partial. Server-side resume works; answers are not queued client-side, so a save lost to a dropped connection is lost |
| E5 | Screen Exit Monitoring | `docs/features/examination/screen-monitoring.md` | `apps/api/src/modules/attempts/attempts.service.ts` (`logExit`, `logReturn`, `getExitLogs`) | `POST /attempts/:id/exit-log` [STUDENT], `POST /attempts/:id/return-log` [STUDENT], `GET /attempts/:id/exit-logs` [TEACHER] | `apps/web/src/app/dashboard/take-exam/[examId]/page.tsx` records the exits. **No teacher page reads them** — nothing in `apps/web/src/` calls `GET /attempts/:id/exit-logs` | `ExamExitLog` | Partial. Recording works end to end; the teacher-facing half is API only |
| E11 | Exam History | `docs/features/examination/exam-history.md` | `apps/api/src/modules/attempts/attempts.service.ts` (`getMyAttempts`, `getAnswerReview`), `apps/api/src/modules/grading/result-visibility.ts` (`maskAttemptForStudent`) | `GET /attempts/my` [STUDENT], `GET /attempts/:id/review` | `apps/web/src/app/dashboard/my-results/page.tsx` → `/dashboard/my-results` | `ExamAttempt`, `Answer` | Existing |

---

## Module F: Assignment Management

| ID | Feature | Spec file | API logic file(s) | HTTP route(s) | Web UI file(s) + route | Prisma model(s) | Status in code |
|---|---|---|---|---|---|---|---|
| F1 | Create Assignment | `docs/features/assignments/create-assignment.md` | `apps/api/src/modules/assignments/assignments.service.ts` (`create`), `apps/api/src/modules/assignments/dto/create-assignment.dto.ts` | `POST /assignments` [TEACHER] | `apps/web/src/app/dashboard/assignments/page.tsx` → `/dashboard/assignments` (teacher branch) | `Assignment` (unique on `examId, classroomId`) | Existing |
| F2 | Student Assignment View | `docs/features/assignments/student-view.md` | `apps/api/src/modules/assignments/assignments.service.ts` (`findByClassroom`, `findById`) | `GET /assignments`, `GET /assignments/:id` | `apps/web/src/app/dashboard/assignments/page.tsx` → `/dashboard/assignments` (student branch, links on to `/dashboard/take-exam/[examId]?assignmentId=…`) | `Assignment`, `ExamAttempt` | Existing |
| F3 | Submission Tracking | `docs/features/assignments/submission-tracking.md` | `apps/api/src/modules/grading/grading.service.ts` (`progressForExam`), `apps/api/src/modules/attempts/attempts.service.ts` (`getAttemptsForExam`) | `GET /attempts?examId=…` [TEACHER] | `apps/web/src/app/dashboard/results/page.tsx` → `/dashboard/results` and `apps/web/src/app/dashboard/grading/page.tsx` → `/dashboard/grading` list attempts per exam | `ExamAttempt`, `Assignment` | Partial. Tracking is per exam, not per assignment, and `/dashboard/results` is unlinked |
| F4 | Deadline Management | `docs/features/assignments/deadline-management.md` | `apps/api/src/modules/assignments/assignments.service.ts` (`create`, `close`) stores and closes. No code refuses an attempt because `dueAt` has passed: `apps/api/src/modules/attempts/attempts.service.ts` (`start`) checks `Exam.availableFrom`/`availableUntil` and the assignment status, never `Assignment.dueAt` | `POST /assignments` [TEACHER], `PATCH /assignments/:id/close` [TEACHER] | `apps/web/src/app/dashboard/assignments/page.tsx` → `/dashboard/assignments` sets the due date and closes an assignment | `Assignment.dueAt`, `AssignmentStatus` | Partial. Stored, displayed and reminded on (see J5); not enforced |
| F5 | Teacher Feedback per Attempt | `docs/features/assignments/teacher-feedback.md` | `apps/api/src/modules/attempts/attempts.service.ts` (`updateAttemptFeedback`, `lockSubmittedForTeacher`), `apps/api/src/modules/attempts/dto/update-feedback.dto.ts` | `PATCH /attempts/:id/feedback` [TEACHER] | `apps/web/src/app/dashboard/grading/page.tsx` → `/dashboard/grading`; also `apps/web/src/app/dashboard/results/page.tsx` → `/dashboard/results` | `ExamAttempt.feedback`, `Answer.feedback` | Existing |
| F6 | File Attachments | `docs/features/assignments/file-attachments.md` | No service reads or writes the table | — | None | `AssignmentAttachment` | Schema only |
| F7 | Student File Submission | `docs/features/assignments/student-file-submission.md` | No service reads or writes the table. `POST /uploads/student-audio` stores a `SPEAKING` recording and is unrelated to this feature | — | None | `SubmissionFile`, `Exam.allowFileSubmission` | Schema only |
| F8 | Manual Grading Workflow | `docs/features/assignments/manual-grading-workflow.md` | Per-attempt override exists (see G3); there is no per-answer grading route. `Answer.earnedPoints` and `Answer.manuallyGraded` are written only by `apps/api/src/modules/grading/grading.service.ts` during automatic grading | — | None | `Answer.earnedPoints`, `Answer.manuallyGraded` | Not implemented. The columns the workflow needs exist and are only machine-written |
| F9 | Hide Results per Assignment | `docs/features/assignments/hide-results.md` | No code reads the column. `apps/api/src/modules/grading/result-visibility.ts` decides visibility from `Exam.showResultImmediately` and `Exam.resultsReleased` only | — | None | `Assignment.hideResults` | Schema only |
| F10 | Export Assignment Results | `docs/features/assignments/export-results.md` | No code. `apps/api/src/common/csv/csv.util.ts` holds the unused helpers | — | None | — | Not implemented |

---

## Module G: Grading & Results

| ID | Feature | Spec file | API logic file(s) | HTTP route(s) | Web UI file(s) + route | Prisma model(s) | Status in code |
|---|---|---|---|---|---|---|---|
| G1 | Auto-Grading | `docs/features/grading/auto-grading.md` | `apps/api/src/modules/grading/grading-engine.ts` (`gradeAnswer`, `computeScore`, `resolveType`, `snapshotOf`), `apps/api/src/modules/grading/grading.service.ts` (`loadContext`, `gradeAttempt`), `apps/api/src/modules/grading/attempt-lifecycle.service.ts` (`finalize`) | No route of its own; runs inside `POST /attempts/:id/submit` and `POST /exams/:id/regrade` | None directly; the student sees the outcome on `/dashboard/my-results` and the teacher on `/dashboard/grading` | `ExamAttempt.score`, `Answer.earnedPoints` | Existing |
| G2 | Exam Results & Review | `docs/features/grading/exam-results.md` | `apps/api/src/modules/attempts/attempts.service.ts` (`getResult`, `getAnswerReview`, `getAttemptsForExam`), `apps/api/src/modules/grading/question-view.ts` | `GET /attempts/:id/result`, `GET /attempts/:id/review`, `GET /attempts` [TEACHER] | `apps/web/src/app/dashboard/my-results/page.tsx` → `/dashboard/my-results` and `apps/web/src/app/dashboard/grading/page.tsx` → `/dashboard/grading`, both through `GET /attempts/:id/review`. **`GET /attempts/:id/result` has no caller in `apps/web/src/`** | `ExamAttempt`, `Answer`, `ExamQuestion` | Existing, with one unused endpoint |
| G3 | Manual Grading & Score Override | `docs/features/grading/manual-grading.md` | `apps/api/src/modules/attempts/attempts.service.ts` (`updateScore`, `lockSubmittedForTeacher`), `apps/api/src/modules/attempts/dto/update-score.dto.ts` | `PATCH /attempts/:id/score` [TEACHER] | `apps/web/src/app/dashboard/grading/page.tsx` → `/dashboard/grading`; also `apps/web/src/app/dashboard/results/page.tsx` → `/dashboard/results` | `ExamAttempt.score`, `ExamAttempt.manualScoreOverride` | Existing |
| G4 | Regrade | `docs/features/grading/regrade.md` | `apps/api/src/modules/exams/exams.service.ts` (`regrade`), `apps/api/src/modules/grading/grading.service.ts` (`recalculateScore`), `apps/api/src/modules/notifications/notification-events.service.ts` (`examRegraded`) | `POST /exams/:id/regrade` [TEACHER] | **None.** No file in `apps/web/src/` references the route | `ExamAttempt.score`, `Answer.earnedPoints` | API only |
| G5 | Result Visibility Control | `docs/features/grading/result-visibility.md` | `apps/api/src/modules/grading/result-visibility.ts` (`canStudentSeeResults`, `maskAttemptForStudent`), `apps/api/src/modules/exams/exams.service.ts` (`releaseResults`), `apps/api/src/modules/exams/dto/release-results.dto.ts` | `PATCH /exams/:id/release-results` [TEACHER] | `apps/web/src/app/dashboard/results/page.tsx` → `/dashboard/results` — the only caller, and that page has no inbound link | `Exam.showResultImmediately`, `Exam.resultsReleased` | Existing, but the only control that sets it sits on an unlinked page |
| G7 | Partial Scoring MCQ_MULTI | `docs/features/grading/partial-scoring.md` | `apps/api/src/modules/grading/grading-engine.ts` (`gradeAnswer`, the `mode === 'PARTIAL'` branch for `MCQ_MULTI`), `apps/api/src/modules/grading/grading.service.ts` (reads `Exam.gradingMode` into the grading context) | Set through `gradingMode` on `POST /exams` and `PATCH /exams/:id` [TEACHER] | **None.** `apps/web/src/app/dashboard/exams/page.tsx` has no grading-mode control, so every exam created in the UI stays at the `ALL_OR_NOTHING` default | `Exam.gradingMode`, `GradingMode` enum | API only |
| G9 | Export Grading Results | `docs/features/grading/export-results.md` | No code | — | None | — | Not implemented |

---

## Module H: Analytics & Reporting

| ID | Feature | Spec file | API logic file(s) | HTTP route(s) | Web UI file(s) + route | Prisma model(s) | Status in code |
|---|---|---|---|---|---|---|---|
| H1 | Student & Classroom Performance | `docs/features/analytics/student-performance.md` | `apps/api/src/modules/analytics/analytics.service.ts` (`getClassroomPerformance`, `getExamDistribution`, `getExamQuestionStats`, `getExamRanking`, `getStudentPerformance`) | `GET /analytics/classrooms/:id` [TEACHER], `GET /analytics/exams/:id/distribution` [TEACHER], `GET /analytics/exams/:id/questions` [TEACHER], `GET /analytics/exams/:id/ranking` [TEACHER], `GET /analytics/students/me/performance` [STUDENT], `GET /analytics/students/:id/performance` [TEACHER] | `apps/web/src/app/dashboard/analytics/page.tsx` → `/dashboard/analytics` calls three of the six: classroom performance, exam distribution and exam question stats. **Ranking and both performance endpoints have no caller in `apps/web/src/`** | `ExamAttempt`, `Answer`, `ExamQuestion`, `ClassroomMember` | Partial. The teacher view is wired for three endpoints; the student-facing performance view is API only, although `apps/web/src/components/sidebar-nav.tsx` already links students to `/dashboard/analytics` |
| H8 | Export Analytics Reports | `docs/features/analytics/export-reports.md` | No code | — | None | — | Not implemented |

---

## Module J: Notifications

| ID | Feature | Spec file | API logic file(s) | HTTP route(s) | Web UI file(s) + route | Prisma model(s) | Status in code |
|---|---|---|---|---|---|---|---|
| J1 | In-App Notification System | `docs/features/notifications/notification-management.md` | `apps/api/src/modules/notifications/notifications.service.ts` (`create`, `createMany`, `notify`, `getForUser`, `getUnreadCount`, `markAsRead`, `markAllAsRead`) and `apps/api/src/modules/notifications/notification-events.service.ts` for the domain triggers | `GET /notifications`, `GET /notifications/count`, `PATCH /notifications/:id/read`, `POST /notifications/read-all` | `apps/web/src/app/dashboard/notifications/page.tsx` → `/dashboard/notifications`; the unread badge is in `apps/web/src/app/dashboard/layout.tsx`, which polls `GET /notifications/count` | `Notification`, `NotificationType` enum | Partial. Reading and marking work end to end. Three of the seven triggers in `notification-events.service.ts` fire — `attemptSubmitted` from `apps/api/src/modules/grading/attempt-lifecycle.service.ts`, `resultsReleased` and `examRegraded` from `apps/api/src/modules/exams/exams.service.ts`. `assignmentCreated`, `gradingCompleted` and `announcementPosted` have no caller |
| J4 | Email Notifications | `docs/features/notifications/email-notifications.md` | `apps/api/src/modules/mail/mail.service.ts` (`send`, with SMTP transport built in `onModuleInit`), exported by `apps/api/src/modules/mail/mail.module.ts` | **None** | None | — | Unreachable. `MailModule` is imported by `apps/api/src/app.module.ts`, but no service in `apps/api/src/` injects `MailService`, so no email is ever sent |
| J5 | Deadline Reminders | `docs/features/notifications/deadline-reminders.md` | `apps/api/src/modules/notifications/reminders.service.ts` (`handleCron` on `@Cron('*/5 * * * *')`, `checkAndSendReminders`) and `apps/api/src/modules/notifications/notification-events.service.ts` (`deadlineReminder`); `ScheduleModule.forRoot()` is registered in `apps/api/src/app.module.ts` | No route; it runs on a timer | None. Reminders arrive as ordinary in-app notifications on `/dashboard/notifications` | `DeadlineReminder` (idempotency per assignment and interval), `Assignment.reminderIntervals` | Existing (in-app only). This is the one background scheduler in the API; see the discrepancies section, because it is the exception to the no-scheduler decision |

---

## Features with no Feature ID

Three capabilities are in the code but not in
`docs/FEATURE_DOCUMENTATION_INDEX.md`, which predates them. Their rows are
above, in the module where their code lives:

| Capability | Row | Why it has no ID |
|---|---|---|
| Google sign-in | Module A, last row | Added after the index was written; has no specification in `docs/features/` |
| English exercise types | Module C, last row | Added after the index was written; the nearest spec, `docs/features/question-bank/question-types.md`, describes the original six types |
| `.docx` question import | Module C, row C6 | Partly covered by `docs/features/question-bank/import-export.md`, whose spec is about CSV import and export |

Two further pieces of UI belong to no feature at all. Dark mode is implemented
by `apps/web/src/components/theme-provider.tsx` and
`apps/web/src/components/theme-toggle.tsx`, mounted in
`apps/web/src/app/layout.tsx`; it has no specification and no Feature ID.

---

## Shared web files

These files carry behaviour for a feature rather than for a page, so they do
not appear in the route table:

| File | Belongs to |
|---|---|
| `apps/web/src/lib/api.ts` | A2 — the single fetch wrapper. Prefixes `NEXT_PUBLIC_API_URL`, attaches the bearer token, unwraps the `{success, data, meta}` envelope, and retries once through `POST /auth/refresh` on a 401 |
| `apps/web/src/lib/auth-context.tsx` | A1, A2, A4, Google sign-in — the React context holding the session, with `login`, `register`, `loginWithGoogle` and `logout` |
| `apps/web/src/components/protected-route.tsx` | A5 — client-side redirect for an absent session or a disallowed role |
| `apps/web/src/components/sidebar-nav.tsx` | A5 — the per-role link list. Teachers get seven links, students six |
| `apps/web/src/components/social-login.tsx` | Google sign-in — the button |
| `apps/web/src/components/google-auth-provider.tsx` | Google sign-in — wraps the Google SDK provider |
| `apps/web/src/components/theme-provider.tsx`, `apps/web/src/components/theme-toggle.tsx` | Dark mode |
| `apps/web/src/components/ui/` | Every feature — the shadcn/ui primitives (18 files) |
| `apps/web/src/lib/utils.ts` | Every feature — the `cn` class-name helper |

---

## Routes that belong to no feature

Three routes serve infrastructure rather than a feature, which is why they do
not appear in any module table:

| Route | File | Purpose |
|---|---|---|
| `GET /health` [public] | `apps/api/src/app.controller.ts` | Liveness probe. The only handler outside `apps/api/src/modules/` |
| `GET /uploads/images/*` [public] | `apps/api/src/modules/storage/uploads.controller.ts` | Streams a stored image back by key, through `getStream` in `apps/api/src/modules/storage/storage.service.ts`. Paired with `POST /uploads/images` |
| `GET /uploads/audio/*` [public] | `apps/api/src/modules/storage/uploads.controller.ts` | The same for audio. Used by the `<audio>` element in `apps/web/src/app/dashboard/take-exam/[examId]/page.tsx` |

Both file-serving routes above are `@Public()`: a stored file is served to anyone
who knows its key, with no token and no ownership check. Noted as an
observation, not a finding — whether that is intended is a question for the
architect.

---

## Code that exists but nothing reaches

Each of these is a complete, tested file with no caller. They are listed here
so a reader does not mistake the file's existence for a working feature.

| File | Feature | What is missing |
|---|---|---|
| `apps/api/src/modules/users/student-accounts.service.ts` | A7 | No controller route. Unit-tested by `apps/api/src/modules/users/student-accounts.service.spec.ts` |
| `apps/api/src/modules/question-bank/question-selection.service.ts` | C13 | No controller route and no service injects it |
| `apps/api/src/modules/mail/mail.service.ts` | J4 | `MailModule` is imported by `apps/api/src/app.module.ts`, but nothing injects `MailService`. Unit-tested by `apps/api/src/modules/mail/mail.service.spec.ts` |
| `apps/api/src/common/csv/csv.util.ts` | B10, C6 (export half), F10, G9, H8 | No caller. Unit-tested by `apps/api/src/common/csv/csv.util.spec.ts` |
| `assignmentCreated`, `gradingCompleted` and `announcementPosted` in `apps/api/src/modules/notifications/notification-events.service.ts` | J1 | No service calls them. `apps/api/src/modules/assignments/assignments.service.ts` does not import `NotificationEvents` at all |

Six Prisma models are migrated and read by nothing, across five features:
`Announcement` (B5),
`QuestionGroup` and `QuestionGroupItem` (C12), `AssignmentTarget` (D11),
`AssignmentAttachment` (F6) and `SubmissionFile` (F7).

---

## Endpoints with no UI, and UI with no endpoint

### Endpoints no web file calls

Checked by searching `apps/web/src/` for each route string.

| Route | Feature | Note |
|---|---|---|
| `POST /auth/forgot-password`, `POST /auth/reset-password` | A3 | No page exists |
| `PATCH /classrooms/:id/archive`, `PATCH /classrooms/:id/unarchive` | B4 | The classroom detail page offers edit and delete only |
| `POST /classrooms/:id/join` | B2 | The UI uses the code-based `POST /classrooms/join` |
| `POST /exams/:id/regrade` | G4 | — |
| `GET /attempts/:id` | E4 | The attempt page resumes through `POST /attempts/start` |
| `GET /attempts/:id/result` | G2 | Both result pages use `GET /attempts/:id/review` |
| `GET /attempts/:id/exit-logs` | E5 | Exits are recorded but never shown to a teacher |
| `GET /analytics/exams/:id/ranking` | H1 | — |
| `GET /analytics/students/me/performance`, `GET /analytics/students/:id/performance` | H1 | Students are linked to `/dashboard/analytics`, which does not call either |
| `POST /uploads/images` | C6 (question images) | `Question.imageUrl` is displayed by `apps/web/src/app/dashboard/questions/page.tsx` but there is no upload control |
| `POST /uploads/audio` | English exercise types | A teacher cannot attach audio through the UI. `POST /uploads/student-audio` and `GET /uploads/audio/*` are both used, by `apps/web/src/app/dashboard/take-exam/[examId]/page.tsx` |

### UI with no endpoint behind it

None. Every API path referenced in `apps/web/src/` resolves to a handler in one
of the nine controllers.

### A page with no link

`/dashboard/results` (`apps/web/src/app/dashboard/results/page.tsx`) is not
linked from anywhere. It is the only caller of
`PATCH /exams/:id/release-results` (G5), so releasing results currently
requires typing the URL.

---

## Discrepancies found against the existing documents

Reported, not corrected — `docs/FEATURE_DOCUMENTATION_INDEX.md` and
`docs/FEATURE_STATUS.md` are not changed by this document.

### The two documents use incompatible Feature IDs

This is the most consequential finding, because it makes a cross-reference
between them silently wrong. The same ID means different features:

| ID | In `docs/FEATURE_DOCUMENTATION_INDEX.md` | In `docs/FEATURE_STATUS.md` |
|---|---|---|
| A2 | Login / Logout / Token Refresh | User Profile (view) |
| A3 | Forgot / Reset Password | Teacher / Student Roles |
| A4 | User Profile & Edit Profile | Forgot / Reset Password |
| A5 | Role-Based Access Control | Edit Profile |
| B4 | Edit, Delete, Archive / Restore | Edit classroom |
| B5 | Classroom Announcements | Delete classroom |
| C6 | Import / Export Questions | Question images |
| D7 | Availability Window | Answer review after submit |
| G4 | Regrade | Answer review in detail |
| G5 | Result Visibility Control | Manual score override |

`docs/FEATURE_STATUS.md` also counts 77 features against the index's 61, and
adds a Module K that the index does not have. **This map uses the index's IDs
throughout**, as instructed. Someone should decide which scheme is canonical;
until then, an ID is ambiguous unless the document is named with it.

### Rows where the code no longer matches the stated status

| Where | It says | The code says |
|---|---|---|
| Index, C13 | Not Implemented | `apps/api/src/modules/question-bank/question-selection.service.ts` exists, with `count` and `pickRandom`. It is unreachable, which is not the same as absent |
| Index, D7 | Not Implemented (schema exists) | Implemented in the API: `validateWindow` in `apps/api/src/modules/exams/exams.service.ts`, enforced by `start` in `apps/api/src/modules/attempts/attempts.service.ts`. Only the UI is missing |
| Index, G7 | Not Implemented (schema exists) | Implemented: the `mode === 'PARTIAL'` branch of `gradeAnswer` in `apps/api/src/modules/grading/grading-engine.ts`, fed by `Exam.gradingMode`. Only the UI is missing |
| Index, J1 | Existing (no auto-triggers) | Three triggers do fire — `attemptSubmitted`, `resultsReleased`, `examRegraded`. Three do not |
| Index, J4 | Not Implemented | `apps/api/src/modules/mail/mail.service.ts` is written and unit-tested; it is wired into `app.module.ts` and injected nowhere |
| Index, J5 | Not Implemented | Implemented: `apps/api/src/modules/notifications/reminders.service.ts` runs on `@Cron('*/5 * * * *')` with `ScheduleModule.forRoot()` in `apps/api/src/app.module.ts`, and `DeadlineReminder` gives it idempotency |
| Index, A7 | Not Implemented | `apps/api/src/modules/users/student-accounts.service.ts` exists and is unit-tested; there is no endpoint |
| Index, B4 | Existing | Archive and unarchive are API only — no UI calls them |
| Index, cross-references | "F6, F7 depend on MinIO/local storage setup (not yet built)" | Storage is built: `apps/api/src/modules/storage/storage.service.ts` uses MinIO and `apps/api/src/modules/storage/uploads.controller.ts` serves five routes. Without `MINIO_ENDPOINT` the service logs a warning and uploads return 503 |
| Index, cross-references | "Scheduler exception: J5 … needs architect/PO decision" | The scheduler is already running. Either the decision was taken and not recorded, or it was not taken and the code went in anyway |
| Status, A4 (password reset) | ✅ Done | API only. "Done" with a warning note in the same cell reads as complete in the summary table, which counts it toward 100% of P1 |
| Status, C6 (question images) | ✅ Done, "chưa có upload endpoint/UI" | The endpoint exists: `POST /uploads/images` in `apps/api/src/modules/storage/uploads.controller.ts`. The UI still does not |
| Status, F3 Deadline Enforcement | ⏳ Chưa làm | Half-true: `Assignment.dueAt` is stored, shown and used by the reminder job, but no code refuses a late attempt |
| Status, F4 Submission Tracking | ⏳ Chưa làm | `progressForExam` in `apps/api/src/modules/grading/grading.service.ts` and `getAttemptsForExam` in `apps/api/src/modules/attempts/attempts.service.ts` exist, with UI on `/dashboard/grading` |
| Status, G2 | API listed as `GET /attempts/:id` | The result pages use `GET /attempts/:id/review`. `GET /attempts/:id/result` exists and has no caller |
| Status, J4 and J5 | ⏳ Chưa làm, "cần email service" / "cần background scheduler" | Both exist. The scheduler runs; the mail service is unwired |
| Status, "Frontend Routes" table | 15 routes | 18 exist. Missing from the table: `/`, `/dashboard/grading`, `/dashboard/import-questions` |
| Status, "API Routes" list | Omits `/auth/google` and every `/uploads` route | Both exist; see the module table above |
| Status, Tech Stack | PostgreSQL on port 5433 | Not verified by this document — the running compose configuration was not inspected |

### Specification drift to pass to the business analyst

These are differences between a specification and the implementation, which
belong to `docs/features/` and so are not mine to edit:

- `docs/features/question-bank/question-types.md` does not cover
  `LISTENING_MCQ`, `LISTENING_FILL`, `READING_MCQ`, `READING_FILL` or
  `SPEAKING`, all of which are in the `QuestionType` enum and graded by
  `grading-engine.ts`.
- `docs/features/question-bank/import-export.md` specifies CSV; the
  implementation is `.docx` (`apps/api/src/modules/question-bank/docx-parser.ts`).
- Google sign-in has no specification anywhere under the `docs/features`
  directory.
- `docs/features/exams/publish-exam.md` is titled "Publish / Archive /
  Regrade", but `ExamStatus` has no archived state.

---

## Open items this map could not settle from the code

These are stated as unresolved rather than guessed:

1. **Whether the unreachable code is unfinished work or abandoned work.**
   `student-accounts.service.ts`, `question-selection.service.ts`,
   `mail.service.ts` and `csv.util.ts` are each written and unit-tested but
   have no caller. The code cannot say whether the missing wiring is the next
   step or a reversal.
2. **Whether the J5 scheduler is sanctioned.** `docs/TECHNICAL_DECISIONS.md`
   records AD-06, no background scheduler, and `reminders.service.ts` runs one.
   Needs a ruling, and then either the decision record or the code should
   change.
3. **Whether `/dashboard/results` is meant to be reachable.** It is the only
   way to release results. Either it needs a link or its controls belong on
   `/dashboard/grading`.
4. **Whether `GET /attempts/:id/result` is dead or reserved.** It duplicates
   part of `GET /attempts/:id/review` and has no caller.
5. **Whether `forgotPassword` returning `resetToken` in the response body is
   deliberate.** `apps/api/src/modules/auth/auth.service.ts` carries the
   comment "In production: send email with token. For now, return it." With no
   UI and no mail wiring, the API is the only way to complete a reset. This is
   a security question for the architect, not a documentation one.
6. **Reorder for D3.** `ExamQuestion.position` is written on add and there is
   no route that changes it, so "Reorder" in the spec title may be unbuilt or
   may be intended to work through remove-and-re-add.
7. **Database port.** `docs/FEATURE_STATUS.md` states PostgreSQL on 5433. The
   running services were not inspected, so this is neither confirmed nor
   contradicted here.

---

## Companion documents

| Document | Answers |
|---|---|
| `docs/FEATURE_DOCUMENTATION_INDEX.md` | Feature ID → specification, priority, complexity |
| `docs/FEATURE_STATUS.md` | Completion counts per priority band (note the ID clash above) |
| `docs/FEATURE_GAPS.md` | What is missing relative to the MVP |
| `docs/FEATURE_OPEN_QUESTIONS.md` | Product decisions awaiting an owner |
| `docs/TECHNICAL_DECISIONS.md` | Why exam timing, expiry and snapshotting work as they do |
| `apps/api/prisma/schema.prisma` | The authoritative data model for every Prisma column named here |
