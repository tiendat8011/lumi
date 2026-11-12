# D. Exam Management

## P0 — Mostly Done

### D1. CRUD + Publish — Done
- Create/Read/Update exams (DRAFT only editable)
- Add/Remove questions from bank
- Publish: snapshot question content + options into ExamQuestion

### D2. Exam Instructions — P0 gap
- **UI**: Pre-exam screen showing title, description, duration, question count, attempt number
- Student must click "Bắt đầu" to start timer
- **Edge cases**: Page refresh on instructions → still shows instructions (timer not started yet)

---

## P1

### D3. Shuffle Questions
- **Schema**: Add `shuffleQuestions Boolean @default(false)` to Exam
- On attempt start, generate random order and store as `questionOrder Int[]?` on ExamAttempt
- **Edge cases**: Same student retaking → different order each time

### D4. Shuffle Answers
- **Schema**: Add `shuffleOptions Boolean @default(false)` to Exam
- On attempt start, shuffle option positions per question, store shuffled order in attempt
- **Edge cases**: TRUE_FALSE questions → don't shuffle (always Đúng/Sai order)

### D5. Exam Preview (Teacher)
- **API**: GET /exams/:id/preview — returns full exam with questions + correct answers
- Only PUBLISHED exams, owner only
- **UI**: Read-only exam view with correct answers highlighted

### D6. Start/End Time UI
- Backend schema exists (availableFrom, availableUntil)
- **UI**: DateTime pickers in exam create/edit form
- **Enforcement**: Student can't start attempt outside window
- **Edge cases**:
  - availableFrom in past → allowed (exam already started)
  - availableUntil in past → "Đã hết hạn" badge, can't start
  - In-progress attempt when availableUntil passes → still can finish (expiresAt governs)

### D7. Answer Review (Post-submission)
- **API**: GET /attempts/:id/review
- **Returns**: Each question with student's answer, correct answer, points earned
- **Controlled by**: `showResultImmediately` flag on Exam
  - true → student sees review immediately
  - false → student sees score only after teacher enables, or never
- **Edge cases**: Teacher can always see any attempt's review

---

## P2

### D8. Exam Access Code
- **Schema**: Add `accessCode String?` to Exam
- Student must enter code before starting attempt
- **API**: Validate in POST /attempts/start `{examId, accessCode?}`
- **Edge cases**: Null accessCode → no code required

### D9. Create Questions Directly in Exam
- **API**: POST /exams/:id/questions/create `{content, options[], points, position}`
- Creates a Question in the bank AND adds it as ExamQuestion in one transaction
- **Edge cases**: Exam not DRAFT → 400

### D10. Random Exam Generation
- **API**: POST /exams/generate `{title, categoryId?, difficulty?, questionCount, pointsPerQuestion, durationSeconds}`
- Creates exam + randomly selects questions from bank
- **Edge cases**: Not enough questions → 400 with count

### D11. Assign to Specific Students
- **Schema**: `ExamStudentAssignment {examId, studentId, assignedAt}`
- Alternative to classroom-wide assignment
- **API**: POST /exams/:id/assign-students `{studentIds[]}`
