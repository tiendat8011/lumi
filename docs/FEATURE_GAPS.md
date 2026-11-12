# Lumi Lite — Feature Gaps Analysis

> Last updated: 2026-11-11
> Compares existing implementation against required behavior and identifies missing functionality.

---

## Gap Summary

| Category | Implemented | Required for MVP | Gap |
|---|---|---|---|
| Backend API endpoints | 40+ | ~50 | ~10 missing endpoints |
| Frontend pages | 15 | ~18 | 3 missing pages |
| Tests | 0 | Critical path coverage | Full gap |
| File upload | 0 | Image upload for questions | Full gap |
| .docx import | 0 | Bulk question creation | Full gap |
| Email service | 0 | Password reset delivery | Full gap |
| Notification triggers | 0 | Auto-create on events | Full gap |

---

## A. Authentication & User Management

### Existing
- Register, login, logout, refresh token — fully functional
- Edit profile (displayName, password change) — API + UI
- Forgot/reset password — API only (returns token in response)
- JWT access (900s) + refresh rotation (7d)
- Global guards (JwtAuthGuard, RolesGuard)

### Gaps

| Gap ID | Description | Severity | Effort |
|---|---|---|---|
| A-GAP-01 | No forgot password UI page — API exists but no `/forgot-password` route | Medium | S (1 day) |
| A-GAP-02 | Password reset token returned in API response — no email delivery | High (prod blocker) | M (2–3 days with SMTP setup) |
| A-GAP-03 | No rate limiting on auth endpoints (login, register, forgot-password) | Medium | S (1 day) |
| A-GAP-04 | No email verification on registration | Low | M (2 days) |
| A-GAP-05 | No account deactivation/deletion | Low | S (1 day) |
| A-GAP-06 | Teacher cannot create student accounts (A7 from spec) | Low (P2) | M (2 days) |

---

## B. Classroom Management

### Existing
- Create, edit, delete, archive/unarchive classroom
- Join by code, list members, remove members
- Archive with `archivedAt` field

### Gaps

| Gap ID | Description | Severity | Effort |
|---|---|---|---|
| B-GAP-01 | No classroom dashboard (member count, avg score, completion) | Medium | M (2 days) |
| B-GAP-02 | No student progress tracking per classroom | Medium | M (2 days) |
| B-GAP-03 | No classroom announcements (schema exists, no endpoints/UI) | Low | M (2 days) |
| B-GAP-04 | No student import via CSV | Low (P2) | M (2–3 days) |
| B-GAP-05 | No student export to CSV | Low (P2) | S (1 day) |
| B-GAP-06 | No join code regeneration | Low | S (0.5 days) |
| B-GAP-07 | Delete classroom does not check for active attempts | Medium | S (0.5 days) |

---

## C. Question Bank

### Existing
- CRUD for all question types (MCQ, MCQ_MULTI, TRUE_FALSE, SHORT_ANSWER, FILL_BLANK, ESSAY)
- Categories with hierarchy (parentId)
- Difficulty levels (EASY/MEDIUM/HARD)
- Search and filter (search, categoryId, difficulty, type)
- Frontend with type selector, filter dropdowns, category management

### Gaps

| Gap ID | Description | Severity | Effort |
|---|---|---|---|
| C-GAP-01 | No image upload — imageUrl field exists but no upload endpoint/service | High | M (3–4 days, includes MinIO setup) |
| C-GAP-02 | No .docx import for bulk question creation | High | L (4–5 days) |
| C-GAP-03 | No question import/export (JSON/CSV) | Medium | M (2 days) |
| C-GAP-04 | No question groups functionality (schema exists, no endpoints) | Low (P2) | M (2 days) |
| C-GAP-05 | No random question selection for exam building | Low (P2) | S (1 day) |
| C-GAP-06 | No question duplication/copy | Low | S (0.5 days) |
| C-GAP-07 | No bulk delete for questions | Low | S (0.5 days) |
| C-GAP-08 | SHORT_ANSWER grading does not support multiple acceptable answers (comma-separated) | Medium | S (0.5 days) |

---

## D. Exam Management

### Existing
- CRUD for exams (DRAFT only editable)
- Add/remove/reorder questions from bank
- Publish with snapshot mechanism
- Configuration: duration, maxAttempts, shuffleQuestions, shuffleOptions, accessCode, instructions, gradingMode
- Release results, regrade (API only for regrade)
- Assign to classroom, close assignment

### Gaps

| Gap ID | Description | Severity | Effort |
|---|---|---|---|
| D-GAP-01 | No exam preview for teacher (read-only view with correct answers) | Medium | M (2 days) |
| D-GAP-02 | No start/end time UI (availableFrom/availableUntil fields exist but no datetime pickers) | Medium | S (1 day) |
| D-GAP-03 | No regrade UI button (API exists) | Low | S (0.5 days) |
| D-GAP-04 | No exam archive endpoint/UI (status exists in enum) | Low | S (1 day) |
| D-GAP-05 | No "create question directly in exam" flow | Low (P2) | M (2 days) |
| D-GAP-06 | No random exam generation from bank | Low (P2) | M (2 days) |
| D-GAP-07 | accessCode validation not enforced at attempt start | Medium | S (0.5 days) |
| D-GAP-08 | Deadline enforcement: Assignment.dueAt not checked at attempt start | Medium | S (0.5 days) |

---

## E. Online Examination

### Existing
- Start attempt with validation (membership, published, attempt limit)
- Countdown timer with red warning under 60s
- Question navigator (grid of question numbers)
- Autosave on each answer click
- Auto-submit on timeout (client-side + lazy expiry server-side)
- Manual submit with idempotency
- Instructions screen before timer
- Shuffle questions (stores questionOrder on attempt)
- Screen exit monitoring (visibilitychange listener + exit/return log API)
- Answer review (teacher and student, respects resultsReleased)

### Gaps

| Gap ID | Description | Severity | Effort |
|---|---|---|---|
| E-GAP-01 | No offline answer queue (localStorage fallback for network loss) | Medium | M (2 days) |
| E-GAP-02 | No multiple-tab detection/prevention | Medium | S (1 day) |
| E-GAP-03 | shuffleOptions not implemented on frontend (backend flag exists) | Medium | S (1 day) |
| E-GAP-04 | accessCode prompt not shown before starting exam | Medium | S (0.5 days) |
| E-GAP-05 | No answer type support beyond MCQ single-select in exam-taking UI | High | M (2–3 days) |
| E-GAP-06 | Autosave has no retry mechanism on network failure | Medium | S (1 day) |
| E-GAP-07 | No server-side concurrency protection on attempt start (no SELECT FOR UPDATE) | High | S (1 day) |
| E-GAP-08 | No debounce on autosave — saves immediately on every click | Low | S (0.5 days) |

---

## F. Assignment Management

### Existing
- Create assignment (examId + classroomId)
- List assignments (role-based: teacher by exam, student by membership)
- Close assignment (PATCH status to CLOSED)

### Gaps

| Gap ID | Description | Severity | Effort |
|---|---|---|---|
| F-GAP-01 | No deadline enforcement — dueAt field exists but not checked | Medium | S (0.5 days) |
| F-GAP-02 | No submission tracking per assignment (count of submitted/in-progress/not-started) | Medium | M (2 days) |
| F-GAP-03 | No assignment detail page (teacher view with student submission status) | Medium | M (2 days) |
| F-GAP-04 | No file attachment support on assignments | Low (P2) | L (3 days) |
| F-GAP-05 | No student file/text submission (non-exam assignments) | Low (P2) | L (4 days) |
| F-GAP-06 | No assignment edit (only create and close) | Low | S (0.5 days) |

---

## G. Grading & Results

### Existing
- Auto-grading for MCQ (single correct answer)
- Score calculation: (earned/total) × 10, Decimal(10,2)
- Manual score override (0–10)
- Attempt-level feedback from teacher
- Answer-level feedback field (exists in schema)
- Answer review with correct/selected highlighting
- Result visibility: showResultImmediately + resultsReleased
- Regrade API (re-runs auto-grading, skips manual overrides)

### Gaps

| Gap ID | Description | Severity | Effort |
|---|---|---|---|
| G-GAP-01 | MCQ_MULTI grading not properly implemented (all-or-nothing only) | Medium | S (1 day) |
| G-GAP-02 | PARTIAL grading mode for MCQ_MULTI not implemented | Medium | M (2 days) |
| G-GAP-03 | SHORT_ANSWER auto-grading: case-insensitive exact match not verified | Medium | S (0.5 days) |
| G-GAP-04 | No answer-level feedback endpoint (Answer.feedback exists but no PATCH endpoint) | Low | S (0.5 days) |
| G-GAP-05 | No result export (CSV/Excel) | Medium | M (2 days) |
| G-GAP-06 | No score distribution chart in teacher results view | Low | S (1 day) |
| G-GAP-07 | ESSAY questions always score 0 — no PENDING_GRADING status | Medium | M (2 days) |

---

## H. Analytics & Reporting

### Existing
- Classroom performance API (memberCount, examCount, avgScore, etc.)
- Score distribution API (10 buckets)
- Question accuracy API (correctRate per question)
- Student ranking API (with tie handling)
- Student performance over time API
- Frontend: /dashboard/analytics with stat cards, bar chart, progress bars

### Gaps

| Gap ID | Description | Severity | Effort |
|---|---|---|---|
| H-GAP-01 | No ranking UI (API exists) | Low | S (1 day) |
| H-GAP-02 | No student performance chart UI (API exists) | Low | S (1 day) |
| H-GAP-03 | No export reports (CSV) | Low (P2) | M (2 days) |
| H-GAP-04 | Analytics limited to single classroom — no cross-classroom view | Low | M (2 days) |

---

## J. Notifications

### Existing
- Notification model with types (NEW_ASSIGNMENT, SUBMISSION_RECEIVED, GRADING_COMPLETE, RESULTS_RELEASED, ANNOUNCEMENT)
- CRUD API: list, count unread, mark read, mark all read
- Frontend: bell icon with polling (30s), /dashboard/notifications page

### Gaps

| Gap ID | Description | Severity | Effort |
|---|---|---|---|
| J-GAP-01 | No automatic triggers — NotificationsService not called from any workflow | High | S (1 day) |
| J-GAP-02 | No email notifications | Medium (P2) | M (3 days with email setup) |
| J-GAP-03 | No deadline reminders (24h/1h before dueAt) | Low (P2) | M (2 days, needs scheduler) |

---

## Cross-Cutting Gaps

| Gap ID | Description | Severity | Effort |
|---|---|---|---|
| X-GAP-01 | No automated tests (unit, integration, or e2e) | Critical | L (10+ days) |
| X-GAP-02 | No rate limiting on any endpoint | High | M (2 days) |
| X-GAP-03 | No CORS configuration visible | Medium | S (0.5 days) |
| X-GAP-04 | No request logging / audit trail | Medium | M (2 days) |
| X-GAP-05 | No health check endpoint | Low | S (0.5 days) |
| X-GAP-06 | No production Docker Compose | Medium | M (2 days) |
| X-GAP-07 | No database backup scripts | High (prod blocker) | S (1 day) |
| X-GAP-08 | No load testing | Medium | M (2 days) |

---

## Priority Recommendations

### Must-fix before production (Critical/High)
1. **X-GAP-01**: Add critical path tests (attempt lifecycle, grading, concurrent submit)
2. **E-GAP-07**: Add concurrency protection on attempt start
3. **J-GAP-01**: Wire notification triggers into workflows
4. **C-GAP-01**: Implement file upload service (MinIO)
5. **X-GAP-02**: Add rate limiting
6. **X-GAP-07**: Database backup scripts
7. **A-GAP-02**: Email delivery for password reset

### Should-fix for good UX
8. **E-GAP-05**: Support all question types in exam-taking UI
9. **D-GAP-02**: Start/end time datetime pickers
10. **F-GAP-01**: Deadline enforcement
11. **D-GAP-07**: Access code validation at attempt start
12. **E-GAP-06**: Autosave retry on network failure

### Nice-to-have
13. Everything else in the gaps list above
