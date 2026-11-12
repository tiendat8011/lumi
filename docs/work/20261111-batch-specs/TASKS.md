# 20261111-batch-specs: Write Missing Feature Specifications

## Objective
Write feature specs for the 24 features in FEATURE_STATUS.md that lack documentation.
Each spec follows the existing 13-section structure (5.1–5.13).

## Collaboration mode: B (subagents, orchestrator relays)

## Status: ✅ COMPLETE

All 24 specs written, verified (13 sections each), index updated.

## Task results

| Task | Features | Agent | Status | Files created |
|---|---|---|---|---|
| T1 | D5, D6 | ba-exams | ✅ done | exam-preview.md, availability-window.md |
| T1b | D9, D10, D11 | ba-exams-r2 | ✅ done | inline-question-creation.md, random-exam-generation.md, assign-to-students.md |
| T2 | F5, F6 | ba-assignments | ✅ done | teacher-feedback.md, file-attachments.md |
| T2b | F7, F8, F9, F10 | ba-assignments-r2 | ✅ done | student-file-submission.md, manual-grading-workflow.md, hide-results.md, export-results.md |
| T3 | B7, B8 | ba-classrooms | ✅ done | classroom-dashboard.md, student-progress-tracking.md |
| T3b | B10 | ba-mixed-1 | ✅ done | import-export-students.md |
| T4 | A6 | ba-auth | ✅ done | admin-dashboard.md |
| T4b | A7 | ba-mixed-1 | ✅ done | teacher-create-students.md |
| T5 | C12 | ba-questionbank | ✅ done | question-groups.md |
| T5b | C13 | ba-mixed-1 | ✅ done | random-question-selection.md |
| T6 | E11 | ba-examination | ✅ done | exam-history.md |
| T7 | G7 | ba-grading | ✅ done | partial-scoring.md |
| T7b | G9 | ba-mixed-2 | ✅ done | export-results.md |
| T8 | H8 | ba-analytics | ✅ done | export-reports.md |
| T9 | J4 | ba-notifications | ✅ done | email-notifications.md |
| T9b | J5 | ba-mixed-2 | ✅ done | deadline-reminders.md |
| T10 | Index update | orchestrator | ✅ done | FEATURE_DOCUMENTATION_INDEX.md |

## Phase gates

| Gate | Condition | Status |
|---|---|---|
| All specs written | 24/24 done | ✅ passed |
| Structure verified | All 24 have 13 sections | ✅ passed |
| Index updated | FEATURE_DOCUMENTATION_INDEX.md updated | ✅ passed |

## Notable findings from specs

### Blocking open questions (need PO/architect decision before implementation)
1. **J5-OQ-01**: Deadline reminders require `@nestjs/schedule` — conflicts with AD-06 (no scheduler)
2. **F7-OQ-05 / F6**: File upload needs MinIO setup as shared prerequisite

### Schema changes proposed across specs
- A7: `createdByTeacherId` on User
- D11: New `AssignmentTarget` junction table
- F7: New `SubmissionFile` model
- F8: `earnedPoints Decimal(10,2)?` on Answer
- G7: GradingMode.PARTIAL activation (enum exists, logic doesn't)
- J5: `DEADLINE_REMINDER` in NotificationType, `reminderIntervals` on Assignment, new `DeadlineReminder` tracking table

### Implementation dependency chains
- A7 → B10 (user creation logic reuse)
- C13 → D10 (random selection engine → exam generation)
- F6 → F7 (shared file storage)
- J1 → J4 → J5 (notification pipeline)
