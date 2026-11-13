# 20261112-implement-missing-features: Implement all missing features

- Request: "Dựa theo feature được define ở @docs, hãy implement toàn bộ những feature còn thiếu. Verify sau khi implement"
- Workflow: feature-development (scaled; specs already exist, so Phase 1 research is skipped)
- Size: L
- Collaboration mode: B (subagents, orchestrator as bridge)
- Spec: all 61 specs under `docs/features/`, plus `docs/FEATURE_GAPS.md`
- Started: 2026-11-12
- Current phase: Phase 3 — implementation, Package 0b next

## Execution policy (user, 2026-11-12)

- Phases run one after another, without waiting for the user between phases,
  until the 5-hour usage limit stops the session.
- After the design phase, one agent at a time. Every agent saves its work to
  disk step by step, so an interruption loses at most the current step.
- This board is updated after every handoff so the work can resume from it.

## Baseline (verified by orchestrator, 2026-11-12)

- `npm run build:api` passes. `npm run build:web` passes.
- `npm run lint`: web has 34 pre-existing problems (20 errors). Not introduced by this task.
- No test files exist. `apps/api/test/` holds only `jest-e2e.json`.
- Dev database `lumi_dev` on `localhost:5433` (container `lumi-postgres`): 3 users, 2 migrations applied.
- User's dev servers are running on :3000 (web) and :4000 (api).
- Repository has no commits. Source snapshot taken before any change:
  `/private/tmp/claude-501/-Users-ntd8011-Documents-Tool-lumi-azota-lite-claude-files/dc223c0d-048c-44e4-a78a-15196fa6d22d/scratchpad/pre-impl-snapshot-20261112.tgz`

## Scope

In scope: every spec whose status is Not Implemented, Proposed, or Partial, and
the module gaps (A–J) in `docs/FEATURE_GAPS.md` that a spec defines.

| Module | Items |
|---|---|
| A | A1 fixes (register returns tokens, reject ADMIN), A3 forgot/reset password UI, A6 admin dashboard, A7 teacher creates students |
| B | B5 announcements, B7 classroom dashboard, B8 student progress, B10 import/export students |
| C | C6 import/export questions (+ image upload, PD-06), C12 question groups, C13 random selection |
| D | D6 exam preview, D7 availability window UI, D9 inline question creation, D10 random exam generation, D11 assign to specific students, archive exam, regrade button |
| E | Start-attempt enforcement (membership, assignment, access code, deadline, concurrency), all question types in the exam UI, shuffle options, autosave retry |
| F | F3 submission tracking, F4 deadline enforcement, F6 file attachments, F7 student file submission, F8 manual grading workflow, F9 hide results, F10 export assignment results |
| G | MCQ_MULTI / SHORT_ANSWER / FILL_BLANK grading, G7 partial scoring, G9 export grading results |
| H | Ranking UI, student performance chart, H8 export reports |
| J | J1 automatic triggers, J4 email notifications, J5 deadline reminders |

Out of scope: P3 features (K4–K17, A8), cross-cutting ops gaps (X-GAP-02..08),
and gaps no spec defines (A-GAP-04/05, B-GAP-06, C-GAP-06/07, H-GAP-04).

## Tasks

### T1: Consolidated technical design

- Assigned agent: architect
- Expected output: `design.md`
- Status: done (sections 1–6; sections 7–9 not written, see decisions.md D11)
- Verification evidence: orchestrator read all 1,306 lines. Six BLOCKING findings ruled in D9.

### T2: Test infrastructure

- Assigned agent: qa-engineer
- Status: done for the harness and baseline tests; test-plan.md and spec review not delivered (D11)
- Verification evidence: `npm run test:e2e:api` on 2026-11-12 21:15 — 6 suites, 110 passed, 28 todo, 0 failed, against `lumi_test`.

### Implementation packages (one agent at a time, in this order)

Each package ends with `npm run build:api`, `npm run test:api`, `npm run test:e2e:api` (and `npm run build:web` for web packages).

| ID | Package | Scope (design.md sections) | Status |
|---|---|---|---|
| P0a | Core: migration, common infra, grading engine, attempt lifecycle, attempts + publish/regrade hardening | 2, 3.1–3.6, 4.5 (attempt routes except files), 5.1–5.5 | done — orchestrator reran 2026-11-13: build pass; unit 111/111; e2e 151 pass, 11 todo, 0 fail; migration has no destructive SQL; lumi_dev users 3→3. 13 deviations in handoff, accepted (see D12). Web app out of step until W5. |
| P0b | Platform: storage, mail, notifications facade + dedupe, scheduler, config, docker-compose, student-accounts, question validation/selection, create-admin | 3.7–3.13 | done — orchestrator verified 2026-11-13: build pass; unit 120/120; e2e 151 pass, 11 todo, 0 fail. 4 deviations accepted (in-memory shuffle, isPublishableQuestion wrapper, async configureApp, jest transform update). Handoff: `p0b-handoff.md` |
| B1 | Auth + admin + teacher-created students (A1 fixes, A3 API, A6, A7) | 4.1, 5.12 | pending |
| B2 | Classrooms: announcements, dashboard, progress, import/export, access fixes (B5, B7, B8, B10) | 4.2, 5.6 | pending |
| B3 | Question bank: uploads, import/export incl. .docx, groups, random (C6, C12, C13) | 4.3 | pending |
| B4 | Exams + assignments: window validation, archive, preview, inline, generate, results export, assignment update/targets/submissions/attachments (D6–D11, F3, F4, F6, F9, G9/F10) | 4.4, 5.5, 5.7, 5.8, 5.11 | pending |
| B5 | Attempts extras: submission files, manual grading route (F7, F8) | 4.5, 5.4, 5.11 | pending |
| B6 | Analytics + notifications: export, access fixes, triggers wired, email fan-out, reminders (H8, J1, J4, J5) | 4.6, 5.9, 5.10 | pending |
| W1 | Web: api client, auth pages (register fix, forgot/reset), admin, profile, sidebar | — | pending |
| W2 | Web: classrooms (dashboard, progress, announcements, import/export, create students) | — | pending |
| W3 | Web: question bank (image upload, import/export, groups) | — | pending |
| W4 | Web: exams + assignments (window pickers, preview, inline, generate, archive, regrade, targets, attachments, tracking, hide results, export) | — | pending |
| W5 | Web: take-exam (all question types, access code, files, retry), results/review/manual grading, my-results | — | pending |
| W6 | Web: analytics (ranking, student chart, export), notifications | — | pending |
| V1 | QA: test plan, new e2e tests, verification report | — | pending |
| V2 | Independent review | — | pending |
| DOC | Specs (BA) and durable docs (technical writer) | — | pending |

## Phase gates

| Gate | Condition | Passed | Evidence |
|---|---|---|---|
| Spec approved | No open BLOCKING finding from architect, QA | | |
| Design approved | No open BLOCKING finding from QA; orchestrator has read it | | |
| Implementation complete | Lint and build pass; deviations reported | | |
| Verified | Acceptance criteria checked by QA; reviewer verdict recorded | | |
| Documented | Docs match final behavior | | |

## Open questions for the user

| # | Question | Raised by | Blocking? | Answer |
|---|---|---|---|---|
| 1 | Provisional rulings D1–D8 in `decisions.md` answer open questions with the docs' own recommended defaults. Veto any of them. | orchestrator | No | |
