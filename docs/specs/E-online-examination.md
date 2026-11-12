# E. Online Examination

## P0 — Done

### E1. Start Exam — Done
- POST /attempts/start → creates attempt, sets expiresAt
- Returns existing in-progress attempt if one exists
- Validates: exam published, within availability window, under max attempts

### E2. Countdown Timer — Done
- Client-side countdown from expiresAt
- Visual: MM:SS badge, turns red under 60s

### E3. Question Navigator — Done
- Grid of question numbers, colored by answered/unanswered
- Click to scroll to question

### E4. Autosave — Done
- POST /attempts/:id/answer on each option click
- Upsert: new answer creates, existing answer updates

### E5. Auto-submit on Timeout — Done
- Client: calls submit when timer hits 0
- Server: lazy expiry check on any attempt access (belt + suspenders)
- Grading runs in transaction

### E6. Manual Submit — Done
- POST /attempts/:id/submit
- Idempotent: already submitted → return existing result

### E7. Submission Status — Done
- Attempt status: IN_PROGRESS | SUBMITTED
- Frontend shows status badge

---

## P1

### E8. Exam Instructions Screen
- **UI**: Interstitial page before timer starts
- Shows: exam title, description, duration, question count, rules
- "Bắt đầu làm bài" button → POST /attempts/start
- **Edge cases**: Back button → returns to instructions (attempt not created yet)

### E9. Configurable Result Visibility
- `showResultImmediately` on Exam model (exists)
- **UI logic**:
  - true → show score + answer review on submit
  - false → show "Bài đã được nộp. Chờ giáo viên công bố kết quả."
- **Teacher**: POST /exams/:id/release-results → makes results visible for all attempts
- **Schema**: Add `resultsReleased Boolean @default(false)` to Exam

---

## P2

### E10. Resume After Connection Loss
- Already partially supported: answers persisted server-side, re-start returns existing attempt
- **Enhancement**: Client detects offline → queue answers in localStorage → sync on reconnect
- **Edge cases**:
  - Timer expires while offline → server auto-submits on next request
  - LocalStorage full → degrade gracefully (show warning)

### E11. Attempt History
- **API**: GET /attempts/my — Done
- **UI Enhancement**: Show list of all past attempts with exam name, date, score, status
- Link to review page for each submitted attempt
