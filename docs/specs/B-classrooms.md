# B. Classroom Management

## P0 — Mostly Done

### B1. Create Classroom — Done
- **API**: POST /classrooms `{name}` → auto-generate 6-char hex joinCode
- **Edge cases**: joinCode collision → retry (astronomically rare with 16M combinations)

### B2. Join via Code — Done
- **API**: POST /classrooms/join `{joinCode}`
- **Edge cases**: Idempotent (re-join returns existing membership), case-insensitive code match

### B3. Member List — Done
- **API**: GET /classrooms/:id/members (TEACHER only)

### B4. Edit Classroom — P0 gap
- **API**: PATCH /classrooms/:id `{name?}`
- Only owner can edit
- **Edge cases**: Non-owner → 403, non-existent → 404

### B5. Delete Classroom — P0 gap
- **API**: DELETE /classrooms/:id
- Cascade: delete all ClassroomMembers, Assignments
- **Edge cases**: Active assignments with in-progress attempts → reject with 400 "Close all assignments first"

---

## P1

### B6. Remove Students
- **API**: DELETE /classrooms/:id/members/:userId
- Only classroom owner can remove
- **Edge cases**:
  - Student has in-progress attempt in this classroom → complete/expire it first
  - Student not a member → 404
  - Owner removing themselves → 400

### B7. Classroom Dashboard
- **API**: GET /classrooms/:id/dashboard
- **Returns**: `{memberCount, assignmentCount, avgScore, completionRate, recentActivity[]}`
- Aggregates from assignments + attempts within this classroom

### B8. Student Progress Tracking
- **API**: GET /classrooms/:id/students/:userId/progress
- **Returns**: `{student, attempts[], avgScore, completedExams, totalExams}`
- Teacher-only endpoint
- **Edge cases**: Student not in classroom → 404

---

## P2

### B9. Classroom Announcements
- **Schema**: `Announcement {id, classroomId, content, createdAt}`
- **API**: POST/GET /classrooms/:id/announcements
- Visible to all classroom members

### B10. Import/Export Student Lists
- **API**: POST /classrooms/:id/import-students (CSV upload: email,displayName)
- **API**: GET /classrooms/:id/export-students → CSV download
- **Edge cases**: Duplicate emails in CSV → skip with warning, invalid email format → skip

### B11. Archive/Restore Classroom
- **Schema**: Add `archivedAt DateTime?` to Classroom
- **API**: POST /classrooms/:id/archive, POST /classrooms/:id/restore
- Archived classrooms hidden from default list, no new assignments allowed
