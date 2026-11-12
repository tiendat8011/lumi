# Lumi Lite — Open Questions Requiring Product Owner Input

> Last updated: 2026-11-11
> These decisions are **not blocked** unless marked — implementation uses provisional defaults.

---

## Product Scope

### OQ-01: ADMIN Role Scope

| Field | Detail |
|---|---|
| **Question** | Should the ADMIN role have a dedicated dashboard and management endpoints? |
| **Why it matters** | The `ADMIN` enum value exists in the schema but has no routes, UI, or permissions. At ~100 users, direct DB access or CLI scripts may suffice. An admin dashboard adds 4–6 dev-days. |
| **Options** | (A) No admin features — manage via DB/CLI. (B) Basic admin: user list, role changes, disable accounts. (C) Full admin: dashboard with system stats, classroom oversight, audit logs. |
| **Provisional default** | Option A — no admin features. Enum is extensible. |
| **Impact** | Low. No code changes needed for option A. |
| **Status** | PROPOSED (per TD PD-02) |

### OQ-02: Essay Questions in MVP

| Field | Detail |
|---|---|
| **Question** | Are essay/free-text questions required for the first release? |
| **Why it matters** | Essay questions require a manual grading workflow, PENDING_GRADING status, teacher grading UI, and per-question scoring. Adds ~5–7 dev-days and complicates the attempt lifecycle. |
| **Options** | (A) MCQ-only for MVP — essays deferred. (B) Include ESSAY type with manual grading. (C) Include ESSAY but auto-score as 0 until teacher grades. |
| **Provisional default** | The schema and API already support ESSAY type (P2 Done). Auto-grading scores ESSAY as 0. Manual override exists. Minimal extra work needed for option C. |
| **Impact** | Medium. Affects grading workflow, result display, and attempt lifecycle. |
| **Status** | Partially resolved — ESSAY type exists but no dedicated grading UI workflow |

### OQ-03: File Upload Service

| Field | Detail |
|---|---|
| **Question** | Should MinIO/S3 be set up for the first release, or defer file uploads? |
| **Why it matters** | Question.imageUrl field exists but no upload endpoint or storage service. Many exam questions require diagrams/charts. Confirmed as needed by PD-06 but not yet implemented. |
| **Options** | (A) Add MinIO to Docker Compose + upload endpoint (M3A from backlog). (B) Use external image URLs only (paste from Google Drive, etc.). (C) Defer entirely. |
| **Provisional default** | Option A — per PD-06 CONFIRMED. Implementation pending. |
| **Impact** | Medium. Affects question creation UX significantly. |
| **Status** | CONFIRMED needed, NOT YET IMPLEMENTED |

### OQ-04: Google Docs Import

| Field | Detail |
|---|---|
| **Question** | Is .docx import ready for the first release? |
| **Why it matters** | Bulk question creation is critical UX per PD-07. Parsing .docx via mammoth library. Depends on file upload (OQ-03). |
| **Options** | (A) Include — M3B from backlog. (B) Defer to post-MVP. |
| **Provisional default** | Option A — per PD-07 CONFIRMED. Implementation pending. |
| **Impact** | High for teacher productivity. 4–5 dev-days. |
| **Status** | CONFIRMED needed, NOT YET IMPLEMENTED |

---

## Exam Behavior

### OQ-05: Multiple Attempt Score Policy

| Field | Detail |
|---|---|
| **Question** | When maxAttempts > 1, which score is the student's final score: best, last, or average? |
| **Why it matters** | Affects how student performance is reported and ranked. Current implementation shows last attempt's score. |
| **Options** | (A) Last attempt. (B) Best attempt. (C) Average. (D) Configurable per exam. |
| **Provisional default** | Option A — last attempt (current behavior). |
| **Impact** | Low. Affects analytics and result display. Easy to change later. |
| **Status** | PROPOSED |

### OQ-06: Partial Scoring for MCQ_MULTI

| Field | Detail |
|---|---|
| **Question** | How should MCQ with multiple correct answers be graded in PARTIAL mode? |
| **Why it matters** | GradingMode enum exists (ALL_OR_NOTHING / PARTIAL) but PARTIAL logic is not implemented. |
| **Options** | (A) (correct selected / total correct) × points — no penalty for wrong selections. (B) (correct selected − incorrect selected) / total correct × points — with penalty, min 0. (C) Exact match only (current ALL_OR_NOTHING). |
| **Provisional default** | Option B — penalty formula, floor at 0. Most commonly used in Vietnamese exams. |
| **Impact** | Medium. Affects scoring fairness. |
| **Status** | PROPOSED — schema exists, logic not implemented |

### OQ-07: Exam Availability Window vs Assignment Deadline

| Field | Detail |
|---|---|
| **Question** | What is the relationship between Exam.availableFrom/availableUntil and Assignment.dueAt? Which takes precedence? |
| **Why it matters** | Both can restrict when students can start. If both are set, behavior must be deterministic. |
| **Options** | (A) Both enforced — student can start only if within BOTH windows. (B) Assignment.dueAt overrides exam window. (C) Exam window is the source of truth; dueAt is display-only. |
| **Provisional default** | Option A — both enforced. Most restrictive window applies. |
| **Impact** | Medium. Affects student experience and teacher configuration. |
| **Status** | PROPOSED — not fully enforced in current implementation |

---

## UX Decisions

### OQ-08: Forgot Password Delivery

| Field | Detail |
|---|---|
| **Question** | How should the password reset token be delivered to the user? |
| **Why it matters** | Currently, POST /auth/forgot-password generates a token and returns it in the response (dev mode). Production needs email or SMS delivery. |
| **Options** | (A) Email via SMTP (requires email service). (B) SMS via provider. (C) Keep returning token in response (dev/demo only). (D) In-app recovery via teacher/admin. |
| **Provisional default** | Option C for now — token returned in response. Email service deferred. |
| **Impact** | Low for development. High for production deployment. |
| **Status** | OPEN — blocks production readiness |

### OQ-09: Student Self-Registration vs Teacher-Created Accounts

| Field | Detail |
|---|---|
| **Question** | Should students be able to self-register, or should teachers create student accounts? |
| **Why it matters** | Current system allows self-registration with role selection. Azota supports both. Self-registration is simpler but allows anyone to create accounts. |
| **Options** | (A) Self-registration only (current). (B) Teacher-created only. (C) Both — self-registration + teacher can create accounts. (D) Self-registration with approval. |
| **Provisional default** | Option A — self-registration (current implementation). |
| **Impact** | Medium. Affects onboarding flow and security model. |
| **Status** | PROPOSED |

### OQ-10: Notification Triggers Integration

| Field | Detail |
|---|---|
| **Question** | When should notifications be automatically created? |
| **Why it matters** | NotificationsService exists with create/createMany methods, but no service calls it automatically. Triggers need to be wired into assignment creation, submission, result release flows. |
| **Options** | (A) Wire all triggers: NEW_ASSIGNMENT, SUBMISSION_RECEIVED, RESULTS_RELEASED. (B) Only NEW_ASSIGNMENT for now. (C) Defer — notifications are manual/API-only. |
| **Provisional default** | Option A — wire all triggers during integration. |
| **Impact** | Low-medium. 1–2 dev-days to integrate. |
| **Status** | PROPOSED |

---

## Infrastructure

### OQ-11: Real-time Features

| Field | Detail |
|---|---|
| **Question** | Does the system need WebSocket/SSE for real-time updates? |
| **Why it matters** | Currently, notification counts are polled every 30 seconds. Real-time would improve UX for notifications, exam monitoring, live results. |
| **Options** | (A) Polling only (current). (B) Add WebSocket gateway for notifications. (C) SSE for simple push. |
| **Provisional default** | Option A — polling is sufficient for ~100 users. |
| **Impact** | Low. Polling works at this scale. |
| **Status** | PROPOSED |

### OQ-12: Test Coverage Requirement

| Field | Detail |
|---|---|
| **Question** | What level of test coverage is required before production? |
| **Why it matters** | Currently NO tests exist. The implementation backlog specifies Jest + Supertest for e2e. Critical business logic (grading, attempt lifecycle, concurrent submission) needs testing. |
| **Options** | (A) Full test suite as specified in backlog. (B) Critical path only: attempt lifecycle, grading, concurrent submit. (C) Manual testing only for MVP. |
| **Provisional default** | Option B — critical path tests. |
| **Impact** | High. Affects confidence in exam integrity. |
| **Status** | OPEN — affects launch readiness |
