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
