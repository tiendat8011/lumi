# F. Assignment Management

## P0 — Done

### F1. Create Assignment — Done
- POST /assignments `{examId, classroomId, dueAt?}`
- Validates: exam PUBLISHED, classroom owned by teacher
- Unique constraint: one assignment per exam per classroom

### F2. Close Assignment — Done
- PATCH /assignments/:id/close → status CLOSED

---

## P1

### F3. Deadline Enforcement
- Schema has `dueAt` field (exists)
- **Server enforcement**: If NOW() > dueAt, treat as closed for new attempts
- **UI**: Show countdown to deadline, "Đã hết hạn" badge after
- **Edge cases**:
  - In-progress attempt when deadline passes → still finishable (expiresAt governs)
  - dueAt null → no deadline

### F4. Submission Tracking
- **API**: GET /assignments/:id/submissions
- **Returns**: `{total, submitted, inProgress, notStarted, students[{name, status, score, submittedAt}]}`
- **UI**: Table with status per student in assignment detail page

---

## P2

### F5. Teacher Feedback per Assignment
- **Schema**: Add `feedback String?` to ExamAttempt
- **API**: PATCH /attempts/:id/feedback `{feedback}`
- Teacher writes feedback visible to student on result page

### F6. File Attachments on Assignment
- **Schema**: `AssignmentAttachment {id, assignmentId, fileUrl, fileName}`
- Teacher attaches reference files (PDF, images) to assignment
- **API**: POST /assignments/:id/attachments (multipart)

### F7. Student File Submission
- For essay/project-based assignments (not exam-based)
- **Schema**: `Submission {id, assignmentId, studentId, text?, fileUrl?, submittedAt}`
- **API**: POST /assignments/:id/submit (multipart or JSON)

### F8. Manual Grading Workflow
- Teacher views submissions, assigns score manually
- **API**: PATCH /submissions/:id/grade `{score, feedback?}`

### F9. Hide Score / Hide Results
- **Schema**: Add `hideResults Boolean @default(false)` to Assignment
- Students can't see score until teacher toggles

### F10. Export Assignment Results
- **API**: GET /assignments/:id/export?format=csv
- Columns: studentName, email, score, submittedAt, status
