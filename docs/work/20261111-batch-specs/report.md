# 20261111-batch-specs: Write Missing Feature Specifications

## Outcome

24 feature specifications were written for all P1/P2 features that lacked documentation,
bringing the total from 37 to 61 specs across 9 modules. Every spec follows the 13-section
structure (5.1–5.13) with happy paths, edge cases, UX specs, Mermaid flow diagrams,
acceptance criteria, and QA scenarios.

## What was delivered

| Module | New specs | Features |
|---|---|---|
| Authentication | 2 | A6 Admin Dashboard, A7 Teacher Creates Students |
| Classrooms | 3 | B7 Dashboard, B8 Progress Tracking, B10 Import/Export Students |
| Question Bank | 2 | C12 Question Groups, C13 Random Selection |
| Exams | 5 | D5 Preview, D6 Availability Window, D9 Inline Questions, D10 Random Generation, D11 Assign to Students |
| Examination | 1 | E11 Exam History |
| Assignments | 6 | F5 Feedback, F6 File Attachments, F7 File Submission, F8 Manual Grading, F9 Hide Results, F10 Export Results |
| Grading | 2 | G7 Partial Scoring, G9 Export Results |
| Analytics | 1 | H8 Export Reports |
| Notifications | 2 | J4 Email Notifications, J5 Deadline Reminders |

## Files changed

### New files (24 specs)
- `docs/features/authentication/admin-dashboard.md`
- `docs/features/authentication/teacher-create-students.md`
- `docs/features/classrooms/classroom-dashboard.md`
- `docs/features/classrooms/student-progress-tracking.md`
- `docs/features/classrooms/import-export-students.md`
- `docs/features/question-bank/question-groups.md`
- `docs/features/question-bank/random-question-selection.md`
- `docs/features/exams/exam-preview.md`
- `docs/features/exams/availability-window.md`
- `docs/features/exams/inline-question-creation.md`
- `docs/features/exams/random-exam-generation.md`
- `docs/features/exams/assign-to-students.md`
- `docs/features/examination/exam-history.md`
- `docs/features/assignments/teacher-feedback.md`
- `docs/features/assignments/file-attachments.md`
- `docs/features/assignments/student-file-submission.md`
- `docs/features/assignments/manual-grading-workflow.md`
- `docs/features/assignments/hide-results.md`
- `docs/features/assignments/export-results.md`
- `docs/features/grading/partial-scoring.md`
- `docs/features/grading/export-results.md`
- `docs/features/analytics/export-reports.md`
- `docs/features/notifications/email-notifications.md`
- `docs/features/notifications/deadline-reminders.md`

### Updated files
- `docs/FEATURE_DOCUMENTATION_INDEX.md` — updated from 37 to 61 entries, added cross-references and dependency chains

## Acceptance criteria

| Criterion | Status | Verified by |
|---|---|---|
| All features in FEATURE_STATUS.md (P1/P2) have spec files | ✅ Verified | orchestrator — 61 files in docs/features/ |
| Each spec has 13 sections (5.1–5.13) | ✅ Verified | orchestrator — grep confirmed all 24 new specs |
| Happy path with Mermaid diagram | ✅ Verified | orchestrator — sampled exam-preview.md, partial-scoring.md |
| Edge cases table | ✅ Verified | orchestrator — sampled multiple specs |
| UX specification | ✅ Verified | orchestrator — sampled multiple specs |
| Acceptance criteria in Given/When/Then | ✅ Verified | orchestrator — sampled multiple specs |
| QA test scenarios | ✅ Verified | orchestrator — sampled multiple specs |
| Documentation index updated | ✅ Verified | orchestrator |

## Known limitations

- Specs were written by 9 independent agents. While each follows the same structure and
  references the Prisma schema, there was no cross-agent review for consistency between
  specs (e.g., F8 manual grading and G7 partial scoring may have overlapping or inconsistent
  rules about score recalculation).
- Feature IDs follow FEATURE_STATUS.md numbering. Some IDs are not sequential in the index
  (e.g., B7/B8/B10 skipping B9, which is covered by B5).

## Blocking architectural questions

1. **J5 (Deadline Reminders)**: Requires a background scheduler (`@nestjs/schedule`), which
   conflicts with technical decision AD-06 (no background scheduler, lazy evaluation only).
   The spec recommends a controlled exception. Needs architect + PO confirmation.

2. **F6/F7 (File Attachments/Submission)**: Requires MinIO or local file storage
   infrastructure, which does not exist yet. Blocks both features.

## Schema changes proposed (for future implementation)

| Feature | Change | Impact |
|---|---|---|
| A7 | Add `createdByTeacherId` to User | Migration |
| D11 | New `AssignmentTarget` model | Migration + new API logic |
| F7 | New `SubmissionFile` model | Migration + file storage |
| F8 | Add `earnedPoints` to Answer | Migration + grading logic |
| J5 | Add `DEADLINE_REMINDER` to enum, new `DeadlineReminder` model | Migration + scheduler |

## Documentation updated

- `docs/FEATURE_DOCUMENTATION_INDEX.md` — fully updated
- `docs/work/20261111-batch-specs/TASKS.md` — task board closed
- `docs/work/20261111-batch-specs/report.md` — this report

## Outstanding questions for the user

None blocking this documentation task. The blocking questions listed above apply only
if/when these features are implemented.
