# H. Analytics & Reporting

## P1

### H1. Classroom Performance
- **API**: GET /analytics/classrooms/:id
- **Returns**:
  ```json
  {
    "memberCount": 30,
    "examCount": 5,
    "avgScore": 7.2,
    "highestScore": 10.0,
    "lowestScore": 3.5,
    "completionRate": 0.85,
    "submissionRate": 0.92
  }
  ```
- Aggregated from all assignments + attempts in classroom
- **Edge cases**: No attempts yet → all 0/null

### H2. Score Distribution
- **API**: GET /analytics/exams/:id/distribution
- **Returns**: `{buckets: [{range: "0-1", count: 2}, {range: "1-2", count: 5}, ...]}` (10 buckets of 1 point each)
- **Edge cases**: No submissions → empty buckets with count 0

### H3. Completion Rate
- Per exam: `completedAttempts / totalAssignedStudents`
- Included in classroom performance endpoint

### H4. Question Accuracy
- **API**: GET /analytics/exams/:id/questions
- **Returns**: Per question: `{questionId, position, content, correctRate, totalAnswered, mostSelectedOption}`
- **Edge cases**: Questions with 0 answers → correctRate null

### H5. Most Incorrect Questions
- Same endpoint as H4, sorted by correctRate ascending
- **UI**: Highlighted in red, helps teacher identify weak areas

---

## P2

### H6. Student Ranking
- **API**: GET /analytics/exams/:id/ranking
- **Returns**: Students sorted by score descending, with rank number
- Handle ties: same rank for same score

### H7. Student Performance Over Time
- **API**: GET /analytics/students/:id/performance
- **Returns**: `{attempts: [{examTitle, score, date}]}` ordered by date
- Chart-friendly format for line graph

### H8. Export Reports
- **API**: GET /analytics/exams/:id/report?format=csv
- Includes score distribution + question accuracy in one export
