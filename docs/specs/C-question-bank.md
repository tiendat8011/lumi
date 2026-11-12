# C. Question Bank

## P0 — Done

### C1. CRUD Questions — Done
- MCQ single-answer with options, explanation
- Validation: min 2 options, exactly 1 correct
- Owner-scoped (teacher sees only their own)

---

## P1

### C2. Question Categories / Subjects
- **Schema**: `QuestionCategory {id, ownerId, name, parentId?}`
- Add `categoryId?` to Question model
- **API**: CRUD /categories, filter /questions?categoryId=
- Hierarchical: Subject → Topic → Chapter via parentId
- **Edge cases**: Delete category → set questions' categoryId to null (don't cascade delete questions)

### C3. Difficulty Levels
- **Schema**: Add `difficulty Difficulty?` enum (EASY, MEDIUM, HARD) to Question
- **API**: Filter /questions?difficulty=MEDIUM
- Default: null (unset)

### C4. True/False Questions
- **Schema**: Question.type enum expand: 'MCQ' | 'TRUE_FALSE'
- TRUE_FALSE: exactly 2 options ("Đúng", "Sai"), exactly 1 correct
- Reuse existing option infrastructure
- **Edge cases**: Trying to add >2 options for TRUE_FALSE → 400

### C5. Multiple Choice — Multiple Answers
- **Schema**: Question.type expand: 'MCQ_MULTI'
- Validation: at least 1 correct, at least 1 incorrect
- Grading: all-or-nothing by default (P2: partial scoring)
- **Answer payload**: `{selectedOptionIds: string[]}` (array instead of single)
- **Edge cases**: No correct options selected → 0 points, all correct → full points

### C6. Question Images
- **Storage**: MinIO (S3-compatible) or local uploads dir
- **Schema**: Add `imageUrl String?` to Question
- **API**: POST /upload/image (multipart) → returns URL, then pass URL in question create/edit
- **Constraints**: Max 5MB, jpeg/png/webp only
- **Edge cases**: Unsupported format → 400, oversized → 413

### C7. Search & Filter Questions
- **API**: GET /questions?search=keyword&categoryId=&difficulty=&type=&page=&limit=
- Search: ILIKE on content field
- Combine filters with AND
- **Edge cases**: Empty search → return all, no results → empty array (not 404)

---

## P2

### C8. Short Answer Questions
- **Schema**: Question.type: 'SHORT_ANSWER'
- No options. `correctAnswer String?` field on Question.
- Grading: exact match (case-insensitive, trimmed) or teacher manual review
- **Edge cases**: Multiple acceptable answers → comma-separated in correctAnswer, match any

### C9. Fill in the Blank
- **Schema**: Question.type: 'FILL_BLANK'
- Content contains `___` placeholder(s)
- correctAnswer stores expected text
- Same grading as short answer

### C10. Essay / Free Text
- **Schema**: Question.type: 'ESSAY'
- No auto-grading. Teacher manually grades.
- **Answer payload**: `{text: string}`, max 10000 chars
- **Edge cases**: Empty submission → allowed (0 points unless teacher overrides)

### C11. Import/Export Questions
- **API**: POST /questions/import (JSON/CSV), GET /questions/export?format=json|csv
- **JSON format**: `[{content, type, difficulty?, options: [{content, isCorrect}], explanation?}]`
- **Edge cases**: Partial import failure → return `{imported: N, failed: [{index, reason}]}`

### C12. Question Groups
- **Schema**: `QuestionGroup {id, ownerId, name}`
- Many-to-many: `QuestionGroupItem {groupId, questionId}`
- Use for organizing related questions (e.g., "Chương 1 - Đại số")

### C13. Random Question Selection
- **API**: POST /exams/:id/add-random `{categoryId?, difficulty?, count}`
- Randomly selects N questions from bank matching filters, adds to exam
- **Edge cases**: Not enough matching questions → 400 with available count
