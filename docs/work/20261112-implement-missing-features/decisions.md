# Decisions: 20261112-implement-missing-features

The user asked for every missing feature to be implemented without stopping.
Several specs carry open questions. Each ruling below takes the default the
docs themselves recommend, so that work can proceed. All are provisional and
listed in the final report for the user to veto.

## D1: Is the admin dashboard (A6) in scope, given PD-02 recommends no admin features?

- Date: 2026-11-12
- Raised by: orchestrator
- Status: decided (provisional)
- Decision: In scope. PD-02 is PROPOSED, not CONFIRMED, and the user asked for all specified features. No self-registration as ADMIN; the first admin is created by a seed script.
- Decided by: orchestrator
- Copy to docs/TECHNICAL_DECISIONS.md: yes

## D2: Deadline reminders (J5) need a scheduler; AD-06 says no scheduler

- Date: 2026-11-12
- Raised by: business-analyst (J5 spec, OQ-01 and OQ-05)
- Status: decided (provisional)
- Decision: Add `@nestjs/schedule` as an in-process cron for reminders only. AD-06 is PROPOSED and is about attempt expiry; attempt expiry stays lazy. No Redis or job queue.
- Reason: Reminders are proactive by nature and cannot be evaluated lazily. An in-process cron is the smallest mechanism that works for a single API instance.
- Rejected option: client-side check on page load; it does not notify a student who has not opened the app.
- Consequence: reminders assume a single API instance. Recorded as a known limitation.
- Copy to docs/TECHNICAL_DECISIONS.md: yes

## D3: File storage for uploads (C6 images, F6, F7)

- Date: 2026-11-12
- Status: decided
- Decision: MinIO (S3-compatible), per PD-06 CONFIRMED. Added to `docker-compose.yml`. Files are served through the API with authorization checks, not by public bucket URL, except question images.
- Copy to docs/TECHNICAL_DECISIONS.md: no (already PD-06)

## D4: Email delivery (J4, A3)

- Date: 2026-11-12
- Status: decided (provisional)
- Decision: Nodemailer over SMTP, configured by environment. When `SMTP_HOST` is unset, mail is logged and not sent. `POST /auth/forgot-password` returns the reset token in the response only when `NODE_ENV` is not `production`.
- Reason: no SMTP credentials exist in this environment; the feature must still be testable.
- Copy to docs/TECHNICAL_DECISIONS.md: yes

## D5: Partial scoring formula for MCQ_MULTI (OQ-06)

- Date: 2026-11-12
- Status: decided (provisional)
- Decision: Option B from OQ-06: `max(0, correctSelected − incorrectSelected) / totalCorrect × points`.
- Copy to docs/TECHNICAL_DECISIONS.md: yes

## D6: Exam availability window versus assignment deadline (OQ-07)

- Date: 2026-11-12
- Status: decided (provisional)
- Decision: Option A: both are enforced at attempt start; the most restrictive applies. `expiresAt` is not shortened by `dueAt` unless the F4 spec says so.
- Copy to docs/TECHNICAL_DECISIONS.md: yes

## D7: Where migrations and tests run

- Date: 2026-11-12
- Status: decided
- Decision: Automated tests run against a separate database `lumi_test` in the existing `lumi-postgres` container. The new migration is applied to the dev database `lumi_dev` with `prisma migrate dev` only if it is purely additive. No agent may reset or drop the dev database; if Prisma asks to reset, the agent stops and reports.

## D8: Other spec open questions

- Date: 2026-11-12
- Status: decided (provisional)
- Decision: Where a spec's open question has a "Recommended default", the implementation follows it. The architect lists any case where two specs' defaults conflict, and the orchestrator rules on those individually below.

## D9: Rulings on the architect's BLOCKING findings (design.md section 6)

- Date: 2026-11-12
- Raised by: architect
- Status: decided
- Decided by: orchestrator. Each ruling accepts the architect's recommendation; the evidence is in design.md section 6.

| Finding | Ruling |
|---|---|
| B1 earnedPoints precision | `Answer.earnedPoints` is Decimal(10,4). The attempt score is always computed from stored per-answer values. G7-BR-05 is reworded to "4 decimal places". |
| B2 gradingMode after publish | G7-BR-02 stands: read-only after publish. Regrade OQ 5 default is rejected. |
| B3 manual grades versus regrade | Add `Answer.manuallyGraded`. A per-question grade sets it and clears the attempt's `manualScoreOverride`; a bulk override sets `manualScoreOverride`; regrade skips overridden attempts and keeps manually graded answers. G3 assumption A2 is deleted. |
| B4 start-attempt contract | design.md 5.1 is the contract: E1's route and codes, one check order, resume runs no checks, the server resolves `assignmentId`. |
| B5 F10 versus G9 export | One endpoint, `GET /exams/:id/results/export` with an optional `assignmentId`. CSV only. F10 becomes a pointer to G9. |
| B6 scope of D8 | D8 covers only open questions inside an in-scope item. Cloning a published exam and correcting the answer key of a published exam are NOT built. Answer-key correction changes grades after the fact and needs the user's decision. |

MAJOR findings M1–M17 and MINOR m1–m4 are accepted as recommended. QUESTIONs:
Q1 comma limitation accepted and recorded as a known limitation; Q2 no
server-side grace period; Q3 no start through an archived classroom; Q4
ranking left as it is.

- Consequences: specs are updated by the business analyst in the documentation phase. Until then design.md is authoritative where it differs from a spec.
- Copy to docs/TECHNICAL_DECISIONS.md: yes (B1, B2, B3, B5)

## D10: Items reduced in scope

- Date: 2026-11-12
- Status: decided (provisional)
- Decision: H8 and G9 exports are CSV only. PDF and XLSX are not built; both are listed as known limitations.
- Reason: CSV meets the stated need (data out of the system); PDF needs a rendering dependency out of proportion to the value at this size.

## D11: Process shortcuts taken to stay within the usage limit

- Date: 2026-11-12
- Status: decided
- Decision:
  1. The architect was interrupted after design.md section 6. Sections 7–9 are not written; the orchestrator defines the work packages in TASKS.md from the file list in design.md 3.1 and the endpoint map in section 4.
  2. The QA spec risk review and test-plan.md were not delivered before the interruption. The architect's section 6 serves as the spec review. QA writes the test plan in the verification phase.
  3. The business analyst's point-by-point answer to section 6 is replaced by ruling D9.
  4. A developer may update an existing baseline e2e test only where design.md changes the contract that test asserts, and must list every such change in the handoff. QA reviews those changes in the verification phase.
- Risk: fewer independent eyes before implementation. Mitigated by the verification phase (QA plus independent reviewer).

## D12: P0a deviations

- Date: 2026-11-13
- Raised by: developer (P0a handoff)
- Status: decided
- Decision: All 13 deviations accepted. Notable: migration generated with `migrate diff` and applied with `migrate deploy` (cannot reset; safer than the design's route); `POST /attempts/start` uses `@Res()` to return 201 new / 200 resumed; the error filter no longer leaks internal exception messages. Window validation on exam create/update, new env vars, `parseCsv` and `fileDownload` move to P0b. `GET /attempts/my` and `/:id/result` do not trigger lazy expiry: assigned to P0b.
- Known consequence: until package W5, the web take-exam page and both review dialogs do not match the new API shapes (`questions` at top level, review returns an object). The web app is broken for taking exams between P0a and W5.
