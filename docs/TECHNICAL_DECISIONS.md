# Lumi Lite — Technical Decisions

All decisions that shape the MVP architecture, scope, and behavior. Each is marked:

- **PROPOSED**: Recommended default; implementation can proceed, but PO may override.
- **CONFIRMED**: Agreed upon and locked.
- **OPEN**: Blocks implementation or significantly changes scope; needs PO input.

---

## Product Decisions

### PD-01: "100 users" interpretation

| | |
|---|---|
| **Status** | **CONFIRMED** |
| **Decision** | 100 concurrent active users. |
| **Rationale** | PO confirmed. Requires connection pooling (PgBouncer), VPS specs 4 vCPU / 8 GB, k6 load test validation before launch. Architecture unchanged, deployment sizing adjusted. |
| **Blocks implementation?** | No. |

### PD-02: Roles — TEACHER + STUDENT vs adding ADMIN

| | |
|---|---|
| **Status** | **PROPOSED** |
| **Recommended default** | `TEACHER` + `STUDENT` only. Role enum includes `ADMIN` value but no admin dashboard or admin-specific endpoints are built. |
| **Rationale** | For ~100 users, the teacher who owns the platform can manage via direct DB access or a simple CLI script. An admin dashboard is a significant scope addition. |
| **If PO wants ADMIN** | Add admin module: user management (CRUD, role changes, disable accounts), classroom oversight, system stats. Estimated +4–6 dev-days. |
| **Blocks implementation?** | No. Enum is extensible. |

### PD-03: Exam types — homework + timed exams vs exams only

| | |
|---|---|
| **Status** | **PROPOSED** |
| **Recommended default** | Unified "exam" model. A homework assignment is an exam with a long duration (e.g., 7 days) and `available_from`/`available_until` set to the homework period. No separate entity needed. |
| **Rationale** | Reduces model complexity. The teacher sets duration and availability window, which covers both use cases. |
| **If PO wants distinct types** | Add `type` enum (`EXAM`, `HOMEWORK`) to exams table. Different UI treatment but same engine. Minimal backend impact (+0.5 days). |
| **Blocks implementation?** | No. |

### PD-04: Question types — MCQ only vs essay/manual grading

| | |
|---|---|
| **Status** | **PROPOSED** |
| **Recommended default** | MCQ (single correct answer) only for MVP. |
| **Rationale** | Essay questions require manual grading workflow: teacher grading UI, per-question scores, PENDING_GRADING status. This adds ~5–7 dev-days and complicates the attempt lifecycle. |
| **If PO wants essays** | Add `ESSAY` question type. Answer payload stores text. Attempt status gains `PENDING_GRADING`. Teacher grading UI needed. Score is partial until all essays graded. Significant scope increase. |
| **Blocks implementation?** | No. MCQ-only is a valid MVP. |

### PD-05: Retake policy — one attempt vs configurable

| | |
|---|---|
| **Status** | **PROPOSED** |
| **Recommended default** | Default 1 attempt. `exams.max_attempts` field exists (default = 1). Backend enforces limit at start-attempt time. |
| **Rationale** | The field is trivial to add. Enforcement is a simple count query. Teachers can set it to 1 (default) or higher. Best score / last score policy deferred — MVP uses last attempt's score. |
| **If PO wants strict single-attempt** | Remove `max_attempts` field, hardcode to 1. Saves ~0.5 days but reduces flexibility. Not recommended. |
| **Blocks implementation?** | No. |

### PD-06: File/image uploads

| | |
|---|---|
| **Status** | **CONFIRMED** |
| **Decision** | Image upload included in MVP. Teachers upload images into question content and options. MinIO (S3-compatible, self-hosted) for storage. |
| **Rationale** | PO confirmed. Many exam questions require diagrams, charts, or photos. MinIO runs in Docker Compose — no external service needed. |
| **Implementation** | Milestone 3A: UploadsModule, `POST /uploads/images`, MinIO in Docker Compose. Images referenced as URLs in question content (Markdown/HTML). |
| **Blocks implementation?** | No. |

### PD-07: Google Docs import

| | |
|---|---|
| **Status** | **CONFIRMED** |
| **Decision** | Teachers can import questions from Google Docs by exporting to `.docx` and uploading. No Google API/OAuth integration. |
| **Rationale** | PO confirmed. Bulk question creation is critical UX. Parsing `.docx` via `mammoth` library avoids OAuth complexity. Two-step flow (preview → confirm) gives teacher control. |
| **Implementation** | Milestone 3B: DocxParserService, QuestionExtractorService, import endpoints, preview UI. Embedded images auto-extracted and uploaded to S3. |
| **Template convention** | `Câu X.` for questions, `A.`/`B.`/`C.`/`D.` for options, `*` prefix marks correct answer. |
| **Blocks implementation?** | No. Depends on M3A (image upload) for embedded image extraction. |

---

## Architecture Decisions

### AD-01: Monorepo structure

| | |
|---|---|
| **Status** | **PROPOSED** |
| **Decision** | Single git repository with `apps/api` (NestJS) and `apps/web` (Next.js). No monorepo tool (nx, turborepo) needed at this scale. |
| **Rationale** | Simplest setup. Both apps share nothing at the code level yet. Package manager workspaces sufficient if needed. |
| **Consequences** | If apps grow, consider Turborepo for build caching. Not needed for MVP. |

### AD-02: Fastify vs Express adapter

| | |
|---|---|
| **Status** | **PROPOSED** |
| **Decision** | Use Fastify adapter for NestJS. |
| **Rationale** | Better performance, built-in schema validation hooks, better logging (pino). NestJS supports it natively. |
| **Consequences** | Some Express-specific middleware won't work directly. Rarely an issue for NestJS apps. If any third-party NestJS library requires Express, fall back to Express. |

### AD-03: Prisma as ORM

| | |
|---|---|
| **Status** | **PROPOSED** |
| **Decision** | Use Prisma for data access and migrations. |
| **Rationale** | Type-safe, good migration story, matches guide recommendation. Simpler than TypeORM for this scale. |
| **Consequences** | Some advanced PostgreSQL features (advisory locks, CTEs) require `$queryRaw`. Acceptable trade-off. |

### AD-04: JWT strategy — access + refresh tokens

| | |
|---|---|
| **Status** | **PROPOSED** |
| **Decision** | Short-lived access token (15 min) + long-lived refresh token (7 days). Refresh tokens stored hashed in a `refresh_tokens` table. |
| **Rationale** | Standard approach. Refresh token rotation prevents token reuse. Logout invalidates refresh token. |
| **Consequences** | Access token revocation is not instant (up to 15 min window). Acceptable for MVP. For immediate revocation, would need token blacklist (Redis). |

### AD-05: Question snapshot at publish time

| | |
|---|---|
| **Status** | **PROPOSED** |
| **Decision** | When a teacher publishes an exam, each `exam_question` row receives a `content_snapshot` (text) and `options_snapshot` (JSONB array of `{content, is_correct, position}`). After publish, the snapshot is the source of truth. |
| **Rationale** | Prevents accidental mutation of live exams when teacher edits question bank. Essential for grading correctness — the correct answer at grading time must match what the student saw. |
| **Consequences** | Slightly more storage. Need to handle snapshot display in student-facing APIs. Cannot retroactively change a published exam's questions (must archive and recreate). |

### AD-06: Lazy expiration (no background scheduler)

| | |
|---|---|
| **Status** | **PROPOSED** |
| **Decision** | No cron/scheduler to expire attempts. Backend checks `NOW() > expires_at` on every attempt-related request and transitions to EXPIRED if needed. |
| **Rationale** | With ~100 users, the chance of abandoned attempts causing issues is low. Every attempt will be touched (by autosave, submit, or teacher viewing results) before it matters. Adding a scheduler adds operational complexity (BullMQ + Redis). |
| **Consequences** | An abandoned attempt (student closes browser, never returns) stays IN_PROGRESS until someone queries it. This is cosmetically imperfect but functionally safe — the student can't submit after expiry anyway. If this becomes a reporting issue, add a simple cron job later. |

### AD-07: Autosave API contract

| | |
|---|---|
| **Status** | **PROPOSED** |
| **Decision** | `PUT /attempts/:id/answers/:examQuestionId` with body `{ selected_option_id: string }`. Uses database UPSERT on unique `(attempt_id, exam_question_id)`. Returns `{ saved_at: timestamp }`. |
| **Rationale** | PUT is idempotent by HTTP spec. UPSERT handles retries naturally. One answer per question per attempt — no versioning needed. |
| **Consequences** | No conflict detection needed. Last write wins, which is correct for a single student working on their own attempt. |

### AD-08: Submit idempotency mechanism

| | |
|---|---|
| **Status** | **PROPOSED** |
| **Decision** | `POST /attempts/:id/submit` uses `SELECT ... FOR UPDATE` on the attempt row inside a transaction. If status is already SUBMITTED, return existing result. If IN_PROGRESS, grade and transition. |
| **Rationale** | Database-level pessimistic lock is simplest for preventing double-grading. No need for application-level idempotency keys at this scale. |
| **Consequences** | Brief lock contention if student clicks submit multiple times rapidly. At ~100 users, this is negligible. |

### AD-09: API response envelope

| | |
|---|---|
| **Status** | **PROPOSED** |
| **Decision** | Wrap all responses in `{ success: boolean, data?: any, meta?: { page, limit, total }, error?: { code, message } }`. Implemented via NestJS interceptor. |
| **Rationale** | Consistent contract for frontend. Error codes are machine-readable for client logic. |
| **Consequences** | Minor overhead. Frontend always unwraps `.data`. |

### AD-10: Pagination strategy

| | |
|---|---|
| **Status** | **PROPOSED** |
| **Decision** | Offset-based pagination with `?page=1&limit=20` query params. Default limit = 20, max limit = 100. |
| **Rationale** | Simple, good enough for ~100 users. Cursor-based pagination is better at scale but unnecessary here. |
| **Consequences** | Page drift on inserts. Not a problem at this scale. |

### AD-11: Late submission handling (expired but not submitted)

| | |
|---|---|
| **Status** | **CONFIRMED** |
| **Decision** | Auto-submit on expiry: when time runs out, backend automatically submits and grades whatever answers have been saved. Status transitions to SUBMITTED (not EXPIRED). |
| **Rationale** | PO confirmed. Most student-friendly approach. Lazy expiry check triggers auto-submit + grading in a single transaction. |
| **Blocks implementation?** | No. |

### AD-12: UUID vs auto-increment IDs

| | |
|---|---|
| **Status** | **PROPOSED** |
| **Decision** | Use UUIDs (v4) as primary keys for all tables. |
| **Rationale** | Prevents ID enumeration, safer in URLs, no sequence contention. Prisma supports UUID natively. |
| **Consequences** | Slightly larger indexes. Not meaningful at this scale. |

### AD-13: UI framework and component library

| | |
|---|---|
| **Status** | **CONFIRMED** |
| **Decision** | Next.js + Tailwind CSS + shadcn/ui. Mobile-first responsive design. |
| **Rationale** | shadcn/ui provides accessible, customizable components. Tailwind CSS tokens map directly to the brand color system. Mobile-first ensures phone usability. |
| **Consequences** | shadcn/ui components are copy-pasted into the project (not a dependency), giving full control. |

### AD-14: Brand color system and theming

| | |
|---|---|
| **Status** | **CONFIRMED** |
| **Decision** | Follow `docs/LMS_BRAND_COLOR_SYSTEM.md` as the single source of truth for all colors. Support light and dark themes. |
| **Rationale** | PO provided a complete brand system: Trustworthy Blue (`#2563EB` primary), neutral-first UI, semantic colors for states, WCAG AA contrast. Includes CSS variables for both themes and per-component rules. |
| **Key rules** | (1) All colors via CSS variables/semantic tokens — no hardcoded HEX in components. (2) Neutral-first: most of the screen is neutral, blue only for primary actions. (3) Exam UI must be calm and distraction-free. (4) Never reveal answer correctness during active attempt. (5) Color is never the only way to communicate state. |
| **Consequences** | shadcn/ui theme customization needed to map brand tokens. Straightforward — shadcn uses CSS variables natively. |
