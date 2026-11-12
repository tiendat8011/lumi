# Lumi Lite — Feature Documentation Index

> Last updated: 2026-11-12
> Batch 1: Core MVP — 37 feature specifications across 9 modules
> Batch 2: Extended features — 24 additional specifications (P1/P2)

---

## Module A: Authentication & User Management

| Feature ID | Feature Name | Spec File | Priority | Status | Complexity |
|---|---|---|---|---|---|
| A1 | User Registration | [register.md](features/authentication/register.md) | P0 | Existing | S |
| A2 | Login / Logout / Token Refresh | [login-logout.md](features/authentication/login-logout.md) | P0 | Existing | M |
| A3 | Forgot / Reset Password | [password-reset.md](features/authentication/password-reset.md) | P1 | Partial (API only) | S |
| A4 | User Profile & Edit Profile | [user-profile.md](features/authentication/user-profile.md) | P1 | Existing | S |
| A5 | Role-Based Access Control | [role-management.md](features/authentication/role-management.md) | P0 | Existing | S |
| A6 | Admin Dashboard | [admin-dashboard.md](features/authentication/admin-dashboard.md) | P2 | Not Implemented | M |
| A7 | Teacher Creates Student Accounts | [teacher-create-students.md](features/authentication/teacher-create-students.md) | P2 | Not Implemented | M |

## Module B: Classroom Management

| Feature ID | Feature Name | Spec File | Priority | Status | Complexity |
|---|---|---|---|---|---|
| B1 | Create Classroom | [create-classroom.md](features/classrooms/create-classroom.md) | P0 | Existing | S |
| B2 | Join Classroom via Code | [join-classroom.md](features/classrooms/join-classroom.md) | P0 | Existing | S |
| B3 | Manage Students (List & Remove) | [manage-students.md](features/classrooms/manage-students.md) | P0/P1 | Existing | S |
| B4 | Edit, Delete, Archive/Restore | [edit-delete-classroom.md](features/classrooms/edit-delete-classroom.md) | P0/P2 | Existing | S |
| B5 | Classroom Announcements | [classroom-announcements.md](features/classrooms/classroom-announcements.md) | P2 | Proposed (schema only) | M |
| B7 | Classroom Dashboard | [classroom-dashboard.md](features/classrooms/classroom-dashboard.md) | P1 | Not Implemented | M |
| B8 | Student Progress Tracking | [student-progress-tracking.md](features/classrooms/student-progress-tracking.md) | P1 | Not Implemented | M |
| B10 | Import/Export Student List | [import-export-students.md](features/classrooms/import-export-students.md) | P2 | Not Implemented | M |

## Module C: Question Bank

| Feature ID | Feature Name | Spec File | Priority | Status | Complexity |
|---|---|---|---|---|---|
| C1 | Create Question | [create-question.md](features/question-bank/create-question.md) | P0 | Existing | M |
| C2 | Edit Question | [edit-question.md](features/question-bank/edit-question.md) | P0 | Existing | S |
| C3 | Question Types (MCQ, TRUE_FALSE, etc.) | [question-types.md](features/question-bank/question-types.md) | P0/P1 | Existing | M |
| C4 | Question Categories | [question-categories.md](features/question-bank/question-categories.md) | P1 | Existing | S |
| C5 | Search & Filter | [search-filter.md](features/question-bank/search-filter.md) | P1 | Existing | S |
| C6 | Import / Export Questions | [import-export.md](features/question-bank/import-export.md) | P2 | Not Implemented | L |
| C12 | Question Groups | [question-groups.md](features/question-bank/question-groups.md) | P2 | Not Implemented (schema exists) | M |
| C13 | Random Question Selection | [random-question-selection.md](features/question-bank/random-question-selection.md) | P2 | Not Implemented | M |

## Module D: Exam Management

| Feature ID | Feature Name | Spec File | Priority | Status | Complexity |
|---|---|---|---|---|---|
| D1 | Create / Edit Exam | [create-exam.md](features/exams/create-exam.md) | P0 | Existing | M |
| D2 | Exam Configuration | [configure-exam.md](features/exams/configure-exam.md) | P0 | Existing | M |
| D3 | Add/Remove/Reorder Questions | [manage-questions.md](features/exams/manage-questions.md) | P0 | Existing | M |
| D4 | Publish / Archive / Regrade | [publish-exam.md](features/exams/publish-exam.md) | P0 | Existing | M |
| D5 | Assign Exam to Classroom | [assign-exam.md](features/exams/assign-exam.md) | P0 | Existing | S |
| D6 | Exam Preview (Teacher) | [exam-preview.md](features/exams/exam-preview.md) | P1 | Not Implemented | M |
| D7 | Availability Window (Start/End Time) | [availability-window.md](features/exams/availability-window.md) | P1 | Not Implemented (schema exists) | M |
| D9 | Inline Question Creation in Exam | [inline-question-creation.md](features/exams/inline-question-creation.md) | P2 | Not Implemented | M |
| D10 | Random Exam Generation | [random-exam-generation.md](features/exams/random-exam-generation.md) | P2 | Not Implemented | L |
| D11 | Assign to Specific Students | [assign-to-students.md](features/exams/assign-to-students.md) | P2 | Not Implemented | M |

## Module E: Online Examination

| Feature ID | Feature Name | Spec File | Priority | Status | Complexity |
|---|---|---|---|---|---|
| E1 | Start Exam Attempt | [start-exam.md](features/examination/start-exam.md) | P0 | Existing | L |
| E2 | Answer Questions (Autosave) | [answer-questions.md](features/examination/answer-questions.md) | P0 | Existing | L |
| E3 | Submit Exam | [submit-exam.md](features/examination/submit-exam.md) | P0 | Existing | L |
| E4 | Resume Exam | [resume-exam.md](features/examination/resume-exam.md) | P1 | Existing | M |
| E5 | Screen Exit Monitoring | [screen-monitoring.md](features/examination/screen-monitoring.md) | P1 | Existing | M |
| E11 | Exam History | [exam-history.md](features/examination/exam-history.md) | P2 | Existing | S |

## Module F: Assignment Management

| Feature ID | Feature Name | Spec File | Priority | Status | Complexity |
|---|---|---|---|---|---|
| F1 | Create Assignment | [create-assignment.md](features/assignments/create-assignment.md) | P0 | Existing | S |
| F2 | Student Assignment View | [student-view.md](features/assignments/student-view.md) | P0 | Existing | S |
| F3 | Submission Tracking | [submission-tracking.md](features/assignments/submission-tracking.md) | P1 | Partial | M |
| F4 | Deadline Management | [deadline-management.md](features/assignments/deadline-management.md) | P1 | Partial (stored, not enforced) | M |
| F5 | Teacher Feedback per Attempt | [teacher-feedback.md](features/assignments/teacher-feedback.md) | P2 | Existing | S |
| F6 | File Attachments | [file-attachments.md](features/assignments/file-attachments.md) | P2 | Not Implemented | M |
| F7 | Student File Submission | [student-file-submission.md](features/assignments/student-file-submission.md) | P2 | Not Implemented | L |
| F8 | Manual Grading Workflow | [manual-grading-workflow.md](features/assignments/manual-grading-workflow.md) | P2 | Not Implemented | L |
| F9 | Hide Results per Assignment | [hide-results.md](features/assignments/hide-results.md) | P2 | Not Implemented (schema field exists) | S |
| F10 | Export Assignment Results | [export-results.md](features/assignments/export-results.md) | P2 | Not Implemented | M |

## Module G: Grading & Results

| Feature ID | Feature Name | Spec File | Priority | Status | Complexity |
|---|---|---|---|---|---|
| G1 | Auto-Grading | [auto-grading.md](features/grading/auto-grading.md) | P0 | Existing | M |
| G2 | Exam Results & Review | [exam-results.md](features/grading/exam-results.md) | P0 | Existing | M |
| G3 | Manual Grading & Score Override | [manual-grading.md](features/grading/manual-grading.md) | P1 | Existing | M |
| G4 | Regrade | [regrade.md](features/grading/regrade.md) | P1 | Existing (API only) | M |
| G5 | Result Visibility Control | [result-visibility.md](features/grading/result-visibility.md) | P1 | Existing | S |
| G7 | Partial Scoring MCQ_MULTI | [partial-scoring.md](features/grading/partial-scoring.md) | P2 | Not Implemented (schema exists) | M |
| G9 | Export Grading Results | [export-results.md](features/grading/export-results.md) | P2 | Not Implemented | M |

## Module H: Analytics & Reporting

| Feature ID | Feature Name | Spec File | Priority | Status | Complexity |
|---|---|---|---|---|---|
| H1 | Student & Classroom Performance | [student-performance.md](features/analytics/student-performance.md) | P1/P2 | Existing (API + partial UI) | M |
| H8 | Export Analytics Reports | [export-reports.md](features/analytics/export-reports.md) | P2 | Not Implemented | M |

## Module J: Notifications

| Feature ID | Feature Name | Spec File | Priority | Status | Complexity |
|---|---|---|---|---|---|
| J1 | In-App Notification System | [notification-management.md](features/notifications/notification-management.md) | P1/P2 | Existing (no auto-triggers) | M |
| J4 | Email Notifications | [email-notifications.md](features/notifications/email-notifications.md) | P2 | Not Implemented | L |
| J5 | Deadline Reminders | [deadline-reminders.md](features/notifications/deadline-reminders.md) | P2 | Not Implemented | M |

---

## Summary

| Metric | Count |
|---|---|
| Total feature specs | 61 |
| Batch 1 (Core MVP) | 37 |
| Batch 2 (Extended P1/P2) | 24 |
| Modules covered | 9 |
| P0 features documented | 16 |
| P1 features documented | 20 |
| P2 features documented | 25 |

## Companion Documents

| Document | Purpose |
|---|---|
| [FEATURE_STATUS.md](FEATURE_STATUS.md) | Implementation status matrix (P0/P1/P2 completion) |
| [FEATURE_GAPS.md](FEATURE_GAPS.md) | Gap analysis — what's missing vs. required for MVP |
| [FEATURE_OPEN_QUESTIONS.md](FEATURE_OPEN_QUESTIONS.md) | Product decisions needing PO input |

## Cross-References

### Critical Flows Spanning Multiple Specs
1. **Exam Lifecycle**: D1 (create) → D3 (add questions) → D2 (configure) → D4 (publish with snapshot) → D5 (assign) → E1 (start) → E2 (answer) → E3 (submit) → G1 (auto-grade) → G2 (results)
2. **Assignment Flow**: D5 (assign) → F1 (create) → F2 (student view) → E1 (start attempt) → F3 (track) → F4 (deadline) → J5 (reminders)
3. **Question Integrity**: C1 (create) → C2 (edit) → D3 (link to exam) → D4 (snapshot at publish) → G4 (regrade from snapshot)
4. **Auth & Access**: A1 (register) → A2 (login) → A5 (role check) → B2 (join classroom) → E1 (membership check)
5. **Teacher Account Management**: A7 (create students) → B10 (import students) → B3 (manage members)
6. **Random Exam Building**: C12 (question groups) → C13 (random selection) → D10 (random exam generation)
7. **Grading Pipeline**: G1 (auto-grade) → G7 (partial scoring) → F8 (manual grading) → G3 (score override) → G9/F10 (export)
8. **Notification Pipeline**: J1 (in-app) → J4 (email) → J5 (deadline reminders)
9. **File Infrastructure**: F6 (teacher attachments) → F7 (student file submission)

### Shared Business Rules
- **Server-authoritative timing**: E1-BR-01, E3-BR-01 — server controls exam clock, not client
- **Snapshot immutability**: D4 snapshot, G4 regrade — exam content frozen at publish
- **Score formula**: (earned / total) × 10, Decimal(10,2) — G1, G3, G4, G7, F8
- **Lazy expiry**: No background scheduler; expiry checked on next access — E1, E3
- **Auto-submit on expiry**: AD-11 CONFIRMED — E3
- **File storage prerequisite**: F6, F7 depend on MinIO/local storage setup (not yet built)
- **Scheduler exception**: J5 (deadline reminders) requires `@nestjs/schedule` — conflicts with AD-06 (no scheduler); needs architect/PO decision

### Implementation Dependencies (Batch 2)
| Feature | Depends on | Notes |
|---|---|---|
| B10 (Import Students) | A7 (Create Students) | Reuses user creation logic |
| D10 (Random Exam Gen) | C13 (Random Selection) | Uses selection engine |
| F7 (File Submission) | F6 (File Attachments) | Shared file storage infrastructure |
| J4 (Email) | Email service setup | Nodemailer + SMTP or SendGrid |
| J5 (Deadline Reminders) | `@nestjs/schedule` | Requires AD-06 exception approval |
