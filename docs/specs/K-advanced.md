# K. Advanced Features

## P2

### K1. Screen Exit Monitoring
- **Frontend**: `visibilitychange` + `blur` event listeners during exam
- Track exits: `{attemptId, exitedAt, returnedAt}`
- **Schema**: `ExamExitLog {id, attemptId, exitedAt, returnedAt?}`
- **API**: POST /attempts/:id/exit-log `{exitedAt}`
- **Teacher view**: GET /attempts/:id/exit-logs → list of exits
- **Edge cases**:
  - Mobile: switching apps triggers blur → only count if >3 seconds
  - Accidental tab switch → logged but not punitive
  - Teacher sees "Rời khỏi trang 3 lần" in results

### K2. Classroom Archive/Restore
- See B11 in classrooms spec

### K3. Import/Export Student Lists
- See B10 in classrooms spec

---

## P3 — Out of Scope

### K4. OCR Question Import — too complex for current stage
### K5. AI Question Generation — requires LLM integration
### K6. AI Question Classification — requires ML pipeline
### K7. Duplicate Question Detection — requires similarity search
### K8. Exam Matrix — advanced scheduling feature
### K9. Offline Examination — requires service worker + sync
### K10. OMR/Scan-based Grading — requires image processing
### K11. Exam Proctoring — requires webcam + ML
### K12. Live Classroom — requires WebRTC/WebSocket
### K13. Organization Management — multi-tenant architecture
### K14. Advanced RBAC — current role system sufficient
### K15. Parent Portal — different user type
### K16. Content Marketplace — e-commerce platform
### K17. Paid Exams/Courses — payment integration
