# Web UI Phases F1–F3 Handoff

## STATUS: COMPLETE

## FILES CHANGED

### Phase F1: Foundation

| File | Action |
|---|---|
| `apps/web/src/app/globals.css` | Modified — added tone utility classes (`.tone-blue`, `.tone-violet`, `.tone-orange`, `.tone-cyan`, `.tone-green`) with dark mode support |
| `apps/web/src/components/sidebar-nav.tsx` | Rewritten — updated teacher nav (removed "Giao bài" and "Kết quả", added "Bài kiểm tra", "Bài tập", "Chấm bài", "Phân tích") and student nav (added "Bài tập", "Bài kiểm tra", "Kết quả", "Tiến độ học tập"); icons match Figma spec |
| `apps/web/src/components/ui/logo.tsx` | Created — gradient icon mark (36×36, rounded-xl, gradient from #2563eb → #4f46e5 → #06b6d4) with Sparkles icon + "Lumi" text |
| `apps/web/src/app/dashboard/layout.tsx` | Modified — replaced "Lumi Lite" text with Logo component; added user profile mini section (avatar + name + email) at bottom of sidebar |
| `apps/web/src/components/ui/section-header.tsx` | Created — title, description, action slot with flex layout |
| `apps/web/src/components/ui/stat-card.tsx` | Created — icon with tone background, label, value, change text; uses Card component as base |
| `apps/web/src/components/ui/empty-state.tsx` | Created — icon, title, text; types: empty, error, loading, success; Vietnamese defaults |

### Phase F2: Auth Pages

| File | Action |
|---|---|
| `apps/web/src/app/login/page.tsx` | Rewritten — full-height split layout; left panel: gradient background with brand messaging; right panel: login form with Logo, title "Chào mừng trở lại"; responsive (brand panel hidden on mobile, mobile Logo shown) |
| `apps/web/src/app/register/page.tsx` | Rewritten — matching split layout; role selector (Giáo viên/Học sinh) with icons; same gradient brand panel |

### Phase F3: Dashboard

| File | Action |
|---|---|
| `apps/web/src/app/dashboard/page.tsx` | Rewritten — teacher view: welcome row with date, 4 StatCards (Lớp học, Câu hỏi, Bài kiểm tra, Bài tập), quick actions grid, recent activity card; student view: hero banner with streak, 4 StatCards, "Cần hoàn thành" and "Kết quả gần đây" sections; API calls to fetch real counts from `/classrooms`, `/questions`, `/exams`, `/assignments` |

## EVIDENCE

### Build
```
$ npm run build:web
✓ Compiled successfully in 529ms
✓ Generating static pages (19/19) in 270ms
```

### Lint
All lint warnings/errors in my changed files: none remaining (removed unused `TrendingUp` import from dashboard/page.tsx). Pre-existing lint errors in other files (API e2e test parsing, other web pages) are untouched.

## DEVIATIONS

1. **Auth page: simplified from Figma** — The Figma AuthScreen has a role toggle (Giáo viên/Học sinh) on the login page. Since the existing auth context's `login()` takes only email/password (role comes from the server), I omitted the role toggle from login but kept it on register where it's actually used.

2. **Dashboard data: graceful fallback** — API endpoints may not exist yet or may return different shapes. The dashboard uses `Promise.allSettled` so each stat card degrades to "0" if its endpoint fails. It tries both `total` and `items.length` for count extraction.

3. **Dashboard: placeholder content** — The "Hoạt động gần đây" (teacher) and "Cần hoàn thành" / "Kết quả gần đây" (student) sections show placeholder text since there's no dedicated "recent activity" API endpoint. These can be populated when the relevant endpoints exist.

4. **Student dashboard hero** — Used a gradient card with decorative circle (matching Figma's `.student-hero`) instead of a progress ring, since the progress ring requires real weekly data that isn't available from current APIs.

## NOT TESTED

- Running the app live at localhost:3000 (no dev server was started)
- Actual API responses (endpoints may not all exist; the UI gracefully handles failures)
- Dark mode appearance (tokens exist and are referenced correctly)
- Mobile responsive behavior (Tailwind breakpoints are used but not visually verified)
