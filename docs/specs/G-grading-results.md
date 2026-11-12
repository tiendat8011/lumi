# G. Grading & Results

## P0 — Done

### G1. Automatic Grading — Done
- MCQ: compare selectedOptionId against optionsSnapshot isCorrect
- Score: (earnedPoints / totalPoints) * 10, 2 decimal places

### G2. Individual Results — Done
- GET /attempts/:id/result → score, answers, exam info

### G3. Classroom Results — Done
- GET /attempts?examId= → list of all attempts with student info, score, status

---

## P1

### G4. Answer Review
- **API**: GET /attempts/:id/review
- **Returns**: Per-question: content, studentAnswer, correctAnswer, isCorrect, pointsEarned
- **Access control**:
  - Teacher: always
  - Student: only if showResultImmediately=true OR resultsReleased=true

### G5. Edit Score (Manual Override)
- **API**: PATCH /attempts/:id/score `{score, reason?}`
- Teacher-only, any attempt status
- **Schema**: Add `manualScoreOverride Boolean @default(false)` to ExamAttempt
- **Edge cases**:
  - Score must be 0-10
  - Original auto-graded score preserved (can revert)
  - Log reason for audit trail

### G6. Teacher Feedback on Answers
- **Schema**: Add `feedback String?` to Answer
- **API**: PATCH /answers/:id/feedback `{feedback}`
- Visible to student in answer review
- **Edge cases**: Answer doesn't exist → 404, not teacher's exam → 403

---

## P2

### G7. Partial Scoring (Multi-answer MCQ)
- MCQ_MULTI grading modes:
  - ALL_OR_NOTHING: all correct selected, no incorrect → full points (default)
  - PARTIAL: (correctSelected / totalCorrect) * points, minus penalty for incorrect
- **Schema**: Add `gradingMode GradingMode @default(ALL_OR_NOTHING)` to Exam

### G8. Regrade Exam
- **API**: POST /exams/:id/regrade
- Re-runs auto-grading for all attempts of this exam
- Use case: teacher fixes correct answer in snapshot, then regrades
- **Edge cases**: Only PUBLISHED exams, updates all attempt scores in transaction

### G9. Export Results
- **API**: GET /exams/:id/results/export?format=csv|xlsx
- Columns: studentName, email, score, submittedAt, per-question breakdown
- **Edge cases**: Large result sets → stream response
