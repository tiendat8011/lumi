# 20261112-implement-missing-features: Implement all missing features

- Request: "Dựa theo feature được define ở @docs, hãy implement toàn bộ những feature còn thiếu. Verify sau khi implement"
- Workflow: feature-development (scaled; specs already exist, so Phase 1 research is skipped)
- Size: L
- Collaboration mode: B (subagents, orchestrator as bridge)
- Spec: all 61 specs under `docs/features/`, plus `docs/FEATURE_GAPS.md`
- Started: 2026-11-12
- Current phase: Phase 2 — consolidated design

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

- Objective: one design covering every in-scope item, with a single schema migration, an endpoint map, cross-spec conflicts resolved, and work packages with disjoint file ownership.
- Assigned agent: architect
- Dependencies: none
- Expected output: `docs/work/20261112-implement-missing-features/design.md`
- Status: in_progress

### T2: Test infrastructure and spec risk review

- Objective: a working e2e harness against an isolated `lumi_test` database, and a review of the specs for contradictions that would make acceptance criteria untestable.
- Assigned agent: qa-engineer
- Dependencies: none
- Expected output: `apps/api/test/**` harness + smoke test, `test-plan.md`, review returned as message
- Status: in_progress

### T3+: Implementation work packages — defined after T1

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
