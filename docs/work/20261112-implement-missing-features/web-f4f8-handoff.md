# Web UI Phases F4–F8 Handoff

## STATUS: COMPLETE

## Build: `npm run build:web` passes (19/19 pages)

## FILES CHANGED

### Phase F4: Classrooms

| File | Action |
|---|---|
| `apps/web/src/app/dashboard/classrooms/page.tsx` | Rewritten — SectionHeader with role-aware title/description; search filter; grid/list view toggle; colored cover cards (blue/violet/cyan rotation) with GraduationCap icon, class code, member avatar stack, progress bar; keep Create/Join dialogs unchanged |

### Phase F5: Question Bank

| File | Action |
|---|---|
| `apps/web/src/app/dashboard/questions/page.tsx` | Rewritten — SectionHeader; 3 StatCards (Tổng câu hỏi, Thư mục, Đã sử dụng); Tabs for type filtering (Tất cả, Trắc nghiệm, Đúng/Sai, Tự luận, Điền khuyết); table-like question rows with number, content, category, type/difficulty badges; pagination; keep CreateQuestionDialog and CreateCategoryDialog |

### Phase F6: Exams

| File | Action |
|---|---|
| `apps/web/src/app/dashboard/exams/page.tsx` | Rewritten — SectionHeader; role-aware views; Tab status filtering (Tất cả, Sắp diễn ra, Đang diễn ra, Đã kết thúc); student active exam callout card; table-like rows with colored ClipboardCheck icons, exam info, status badges; keep CreateExamDialog |

### Phase F7: Take Exam

| File | Action |
|---|---|
| `apps/web/src/app/dashboard/take-exam/[examId]/page.tsx` | Rewritten — full-screen `fixed inset-0 z-50` layout; top bar with Logo, exam title, autosave label, timer (styled, low-time warning); left sidebar with question navigator grid (5 cols), legend (current/answered/unanswered), progress bar, submit button; main area with single question + styled option cards (A/B/C/D labels); prev/next navigation; submit success screen with checkmark, badge, score, summary grid; all existing API calls preserved (start, answer, submit, visibility tracking) |

### Phase F8: Assignments

| File | Action |
|---|---|
| `apps/web/src/app/dashboard/assignments/page.tsx` | Rewritten — SectionHeader; split layout: left list (colored FileText icons, selected state, status badges, due dates) + right detail panel (badge, title, description, file attachment chip, submission stats for teacher, upload zone for student); classroom tab selector; keep CreateAssignmentDialog |

## Verification

- Build: 19/19 pages passed
- All existing API calls preserved
- All dialogs use `render` prop convention
- All text is Vietnamese
- Shared components (SectionHeader, StatCard, EmptyState) used throughout
- Mobile responsive (flex-col on mobile for multi-column layouts)

## Deviations from Figma

1. **Classroom cover area**: Uses CSS background tones instead of full image covers (API doesn't provide cover images)
2. **Teacher name**: Shows placeholder "GV. Giáo viên" (classroom API doesn't return teacher displayName on list endpoint)
3. **Progress bar on classrooms**: Shows static 75% (API doesn't return classroom progress)
4. **Exam callout for student**: Shows static placeholder data (no real-time exam session tracking on the list endpoint yet)
5. **Assignment file upload**: Upload zone is visual only (actual upload API is B5 scope)
6. **Take exam single-question view**: Shows one question at a time with navigation instead of the all-questions scroll view — matches Figma's question navigator design
