# 20261114-english-optimization: Optimize platform for English language exercises

- Request: "tối ưu trang web cho bộ môn tiếng anh, các dạng bài tập tiếng anh Nghe (Listening), Đọc & Viết (Reading & Writing) và Nói (Speaking) và trắc nghiệm"
- Workflow: feature-development
- Size: L
- Collaboration mode: B (subagents, orchestrator as bridge)
- Spec: N/A (direct implementation from user request)
- Started: 2026-11-14
- Current phase: Complete

## Tasks

### T1: Backend – Schema, DTOs, snapshot, audio upload

- Objective: Add audioUrl/passage fields to Question + ExamQuestion, new question types for English exercises, audio upload endpoint, update snapshot logic
- Assigned agent: dev-english-be (developer) + orchestrator fixes
- Dependencies: none
- Status: done
- Verification evidence:
  - Migration `20261114160808_add_audio_passage_fields` adds `audio_url`, `passage` to `questions` and `audio_url_snapshot`, `passage_snapshot` to `exam_questions` (additive, no reset)
  - `CreateQuestionDto` + `UpdateQuestionDto`: audioUrl?, passage?, 5 new QuestionType values
  - `exams.service.ts:345-346`: snapshot includes audioUrlSnapshot and passageSnapshot
  - `attempts.service.ts:447-448`: LISTENING_MCQ + READING_MCQ → selectedOptionId
  - `attempts.service.ts:465-466`: LISTENING_FILL + READING_FILL → text
  - `attempts.service.ts:478`: SPEAKING → text (essay-length)
  - `grading-engine.ts:164-165,196-197,208`: all new types handled in auto-grading
  - `uploads.controller.ts`: POST /uploads/audio (TEACHER, 50MB), POST /uploads/student-audio (any auth, 10MB), GET /uploads/audio/*
  - `upload.util.ts`: MIME types + magic bytes for mp3/wav/ogg/m4a/webm
  - `npx tsc --noEmit -p apps/api/tsconfig.json` → clean
  - `npm run test:api` → 128/128 pass

### T2: Frontend – Exam-taking UI for all question types

- Objective: Update take-exam page to render all question types with audio player, passage display, text inputs, and audio recorder
- Assigned agent: dev-english-fe (developer)
- Dependencies: none
- Status: done
- Verification evidence:
  - `AnswerValue = string | string[] | { text: string }` — supports all answer shapes
  - MCQ/LISTENING_MCQ/READING_MCQ: option buttons with single-select
  - TRUE_FALSE: two large horizontal buttons (Đúng/Sai)
  - MCQ_MULTI: checkboxes with toggle behavior
  - SHORT_ANSWER/FILL_BLANK/LISTENING_FILL/READING_FILL: text input, 1.5s debounce auto-save, blur save
  - ESSAY: textarea with 20000 char limit + counter, 2s debounce
  - SPEAKING: MediaRecorder API, idle→recording→recorded states, uploads to /uploads/student-audio
  - Audio player (Headphones icon, blue panel) when audioUrlSnapshot present
  - Passage display (BookOpen icon, amber panel) when passageSnapshot present
  - Image display when imageUrlSnapshot present
  - Question type badges in Vietnamese
  - `isAnswered()` handles all AnswerValue types
  - `npx tsc --noEmit -p apps/web/tsconfig.json` → clean

## Phase gates

| Gate | Condition | Passed | Evidence |
|---|---|---|---|
| Spec approved | N/A – direct user request, clear scope | ✅ | User explicitly requested these exercise types |
| Design approved | N/A – implementation-driven | ✅ | Standard UI patterns for each question type |
| Implementation complete | Lint and build pass; deviations reported | ✅ | tsc clean for both api and web; 128/128 tests pass |
| Verified | Acceptance criteria checked by orchestrator | ✅ | Code review of all changes by orchestrator |
| Documented | N/A for this task | ✅ | N/A |

## Open questions for the user

| # | Question | Raised by | Blocking? | Answer |
|---|---|---|---|---|
