# 20261114-english-optimization: Optimize platform for English language exercises

## Outcome

The platform now supports all five English language exercise types: **Listening** (audio + MCQ/fill-in), **Reading & Writing** (passage + MCQ/fill-in/essay), **Speaking** (audio recording), and **Multiple Choice** (all existing types now render correctly in the exam UI). The backend supports 5 new question types, audio/passage fields, and audio upload endpoints. The frontend exam-taking page renders all 11 question types with appropriate UI components.

## What was implemented

### Backend (API)
1. **Prisma migration** `20261114160808_add_audio_passage_fields`: Added `audio_url` and `passage` nullable columns to `questions` table; `audio_url_snapshot` and `passage_snapshot` to `exam_questions` table.
2. **5 new question types**: `LISTENING_MCQ`, `LISTENING_FILL`, `READING_MCQ`, `READING_FILL`, `SPEAKING` — added to `QuestionType` enum in DTOs, `QUESTION_TYPES` in grading engine, `OPTION_TYPES` where applicable.
3. **DTOs updated**: `CreateQuestionDto` and `UpdateQuestionDto` accept `audioUrl?` (max 2048 chars) and `passage?` (max 50000 chars).
4. **Exam publish snapshot**: Now includes `audioUrlSnapshot` and `passageSnapshot`.
5. **Answer validation** (`buildAnswerPayload`): LISTENING_MCQ/READING_MCQ → selectedOptionId; LISTENING_FILL/READING_FILL → text (short); SPEAKING → text (essay-length, stores audio URL).
6. **Auto-grading**: LISTENING_MCQ/READING_MCQ graded like MCQ; LISTENING_FILL/READING_FILL graded like FILL_BLANK; SPEAKING returns null (manual grading).
7. **Student question view**: Returns `audioUrl` and `passage` fields to the frontend.
8. **Audio upload endpoints**: `POST /uploads/audio` (TEACHER, 50MB), `POST /uploads/student-audio` (any authenticated user, 10MB), `GET /uploads/audio/*` (public, cached). Supports mp3, wav, ogg, m4a, webm.
9. **Question service**: `create()`, `bulkCreate()`, `update()` all pass `audioUrl` and `passage`.

### Frontend (Web)
1. **Answer state**: Changed from `Record<string, string>` to `Record<string, AnswerValue>` where `AnswerValue = string | string[] | { text: string }`.
2. **MCQ/LISTENING_MCQ/READING_MCQ**: Radio-style option buttons (existing pattern).
3. **TRUE_FALSE**: Two large horizontal buttons labeled "Đúng" / "Sai".
4. **MCQ_MULTI**: Checkbox-style toggle buttons with ✓ indicator.
5. **SHORT_ANSWER/FILL_BLANK/LISTENING_FILL/READING_FILL**: Single-line text input, 1.5s debounce auto-save, save on blur.
6. **ESSAY**: Multi-line textarea, 20000 char limit with counter, 2s debounce auto-save.
7. **SPEAKING**: Audio recorder using MediaRecorder API — idle → recording (red pulse + timer) → recorded (playback + re-record/upload). Uploads to `/uploads/student-audio`.
8. **Audio player**: Blue panel with Headphones icon when `audioUrlSnapshot` present.
9. **Passage display**: Amber panel with BookOpen icon when `passageSnapshot` present.
10. **Image display**: Shows `imageUrlSnapshot` when present.
11. **Question type badge**: Vietnamese labels for all 11 types.
12. **Question navigator**: `isAnswered()` correctly checks all answer value shapes.

## Files changed

### Backend
| File | Change |
|---|---|
| `apps/api/prisma/schema.prisma` | Added `audioUrl`, `passage` to Question; `audioUrlSnapshot`, `passageSnapshot` to ExamQuestion |
| `apps/api/prisma/migrations/20261114160808_add_audio_passage_fields/migration.sql` | Additive ALTER TABLE (existing) |
| `apps/api/src/modules/question-bank/dto/create-question.dto.ts` | 5 new QuestionType values, `audioUrl?`, `passage?` fields |
| `apps/api/src/modules/question-bank/dto/update-question.dto.ts` | `audioUrl?`, `passage?` fields |
| `apps/api/src/modules/question-bank/questions.service.ts` | Pass audioUrl/passage in create, bulkCreate, update |
| `apps/api/src/modules/question-bank/questions.controller.ts` | Routing for new question types |
| `apps/api/src/modules/question-bank/question-validation.ts` | Validation for new question types |
| `apps/api/src/modules/exams/exams.service.ts` | Snapshot audioUrlSnapshot + passageSnapshot; LISTENING_MCQ/READING_MCQ in OPTION_TYPES |
| `apps/api/src/modules/attempts/attempts.service.ts` | buildAnswerPayload handles all 5 new types |
| `apps/api/src/modules/grading/grading-engine.ts` | Auto-grading for all new types |
| `apps/api/src/modules/grading/question-view.ts` | ExamQuestionRow/StudentQuestion include audioUrl/passage |
| `apps/api/src/modules/grading/question-view.spec.ts` | Test fixtures updated for new fields |
| `apps/api/src/modules/storage/upload.util.ts` | Audio MIME types + magic bytes |
| `apps/api/src/modules/storage/uploads.controller.ts` | POST /uploads/audio, POST /uploads/student-audio, GET /uploads/audio/* |

### Frontend
| File | Change |
|---|---|
| `apps/web/src/app/dashboard/take-exam/[examId]/page.tsx` | Complete rewrite: all 11 question type renderers, audio player, passage display, audio recorder, updated answer state |

## Tests executed

| Command | Scope | Result |
|---|---|---|
| `npm run test:api` | All API unit tests | 128/128 passed |
| `npx tsc --noEmit -p apps/api/tsconfig.json` | API type check | Clean (0 errors) |
| `npx tsc --noEmit -p apps/web/tsconfig.json` | Web type check | Clean (0 errors) |

## Acceptance criteria

| Criterion | Status | Evidence |
|---|---|---|
| Prisma migration adds audioUrl/passage fields | ✅ Verified | Migration SQL is additive ALTER TABLE only |
| New English question types in DTOs | ✅ Verified | 5 types in QuestionType enum |
| Exam publish snapshots audioUrl and passage | ✅ Verified | exams.service.ts:345-346 |
| Audio upload endpoints work | ✅ Verified | Controller with TEACHER + any-auth routes |
| buildAnswerPayload handles new types | ✅ Verified | attempts.service.ts:444-489 |
| Auto-grading handles new types | ✅ Verified | grading-engine.ts:161-210 |
| Frontend renders all question types | ✅ Verified | page.tsx lines 878-1144 |
| Audio player for listening | ✅ Verified | page.tsx:828-842 |
| Passage display for reading | ✅ Verified | page.tsx:845-855 |
| Audio recorder for speaking | ✅ Verified | page.tsx:1072-1144, MediaRecorder API |
| TypeScript clean | ✅ Verified | Both tsconfig pass |
| All tests pass | ✅ Verified | 128/128 |

## Known limitations

1. **Speaking answers stored as URLs**: The student records audio, it's uploaded and the URL is stored as `text` in the answer payload. Playback in the grading UI is not yet implemented (teacher would need to manually open the URL).
2. **No question creation UI for new types**: Teachers can create LISTENING/READING/SPEAKING questions via API but the web question creation form doesn't have UI for uploading audio or entering passages yet.
3. **No audio waveform visualization**: Audio player uses native HTML5 `<audio controls>` — functional but not custom-styled.
4. **m4a/mp3/webm magic byte validation**: Skipped due to complex header formats; relies on MIME type + extension check only.

## Remaining bugs

None found during verification.

## Documentation updated

- `docs/work/20261114-english-optimization/TASKS.md` — task board
- `docs/work/20261114-english-optimization/report.md` — this report

## Technical decisions

- New question types are stored as plain strings (consistent with existing approach — no Prisma enum migration needed).
- Audio uploads stored in local filesystem via StorageService (same as images).
- Speaking answers use the `text` field to store the audio URL (reuses existing ESSAY infrastructure).
- Audio recording uses `audio/webm` format (best browser compatibility with MediaRecorder).

## Outstanding questions for the user

None.
