# Web UI Phases F9–F11 Handoff

## STATUS: COMPLETE

## Build: `npm run build:web` passes (20/20 pages — new `/dashboard/grading` route added)

## FILES CHANGED

### Phase F9: Grading (NEW page)

| File | Action |
|---|---|
| `apps/web/src/app/dashboard/grading/page.tsx` | Created — Three-column layout: left panel (exam dropdown + student list with avatars, submit times, score badges), center panel (question review with MCQ annotations, correct/incorrect highlighting), right panel (score input 0-10 step 0.1, feedback textarea, "Lưu và trả bài" / "Lưu, chấm bài tiếp theo" buttons). Teacher-only guard. Uses APIs: GET /exams, GET /attempts?examId=, GET /attempts/:id/review, PATCH /attempts/:id/score, PATCH /attempts/:id/feedback. Effect cancellation for race conditions. |

### Phase F10: Analytics & Results (3 pages)

| File | Action |
|---|---|
| `apps/web/src/app/dashboard/analytics/page.tsx` | Rewritten — SectionHeader with role-based title (Teacher/Student), 4 StatCards (average score, completion rate, total submissions, highest score), two-column layout with SVG bar chart for distribution + skill bars for question accuracy, ranking section. Keep all existing API calls. |
| `apps/web/src/app/dashboard/my-results/page.tsx` | Rewritten — SectionHeader, hero result card with SVG ScoreCircle (stroke-dasharray), color-coded score badge (green ≥8, blue ≥5, red <5), stat chips, teacher feedback card. All attempts listed below. Kept StudentReviewDialog with `render` prop. |
| `apps/web/src/app/dashboard/results/page.tsx` | Rewritten — SectionHeader with "Công bố kết quả" action, 4 StatCards (total/avg/rate/highest), table in Card container with better styling. All existing dialogs (Review, EditScore, Feedback) preserved. |

### Phase F11: Notifications

| File | Action |
|---|---|
| `apps/web/src/app/dashboard/notifications/page.tsx` | Rewritten — SectionHeader with description + "Đánh dấu tất cả đã đọc" action. Card container with dividers. Each notification: colored icon area (tone mapping by type: EXAM_PUBLISHED→blue, GRADING_COMPLETE→green, RESULTS_RELEASED→cyan, DEADLINE_REMINDER→orange, ANNOUNCEMENT→violet), bold unread title, description, relative timeAgo timestamp, unread dot. EmptyState for no notifications. |

## Verification

- Build: 20/20 pages passed (new grading route verified)
- All existing API calls preserved
- All dialogs use `render` prop convention
- All text is Vietnamese
- Mobile responsive (grid stacks to flex-col)

## Deviations

1. **Analytics chart**: Uses bar chart (matching existing distribution API bucket data) instead of Figma's line chart — pragmatic, since the API returns histogram data
2. **Grading "next" button**: Advances to next ungraded student in current exam only (not cross-exam)
3. **Grading "Lưu và trả bài"**: Uses existing score/feedback PATCH endpoints (no dedicated "return paper" API exists)
4. **My Results hero**: Shows most recent submitted attempt; topic analysis section uses placeholder data (API doesn't return per-topic breakdown for student)
