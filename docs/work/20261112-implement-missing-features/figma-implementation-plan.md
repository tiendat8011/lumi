# Figma UI Implementation Plan

> Source: Figma Make file `aJjxaH9TXLH60w6XCYJqxc` (Lumi Learning Platform)
> Target: `apps/web/` — Next.js 16, React 19, Tailwind CSS 4, shadcn/ui (Base UI)

## 1. Design Analysis Summary

### Figma Design Structure
The Figma Make file is a single-file React app (Vite + Tailwind 4 + lucide-react) with **15 screens**, **2 roles** (Teacher/Student), dark/light mode, and responsive layout.

### Screens in Figma Design

| # | Screen ID | Component | Role | Description |
|---|---|---|---|---|
| 1 | `dashboard` | `Dashboard` | Teacher | Stats cards, recent activity, quick actions |
| 2 | `dashboard` | `StudentDashboard` | Student | Hero banner, upcoming assignments, recent results |
| 3 | `classes` | `ClassesPage` | Both | Class cards with member count, join code, actions |
| 4 | `questions` | `QuestionsPage` | Teacher | Question bank with tabs, search, filter, question cards |
| 5 | `exams` | `ExamsPage` | Both | Exam list with status badges, duration, question count |
| 6 | `create-exam` | `CreateExam` | Teacher | 3-step wizard (Info → Questions → Settings), question editor |
| 7 | `take-exam` | `TakeExam` | Student | Full-screen exam with timer, question navigator, MCQ UI |
| 8 | `assignments` | `AssignmentsPage` | Both | Assignment cards with deadlines, status, file upload |
| 9 | `grading` | `GradingPage` | Teacher | Grading workspace with student answer, scoring, feedback |
| 10 | `courses` | `CoursesPage` | Both | Course cards with progress bars, lessons |
| 11 | `analytics`/`progress` | `AnalyticsPage` | Both | Charts, stats, ranking, performance metrics |
| 12 | `results` | `ResultsPage` | Student | Result cards with scores, teacher feedback |
| 13 | `notifications` | `NotificationsPage` | Both | Notification list with types, timestamps |
| 14 | `settings` | `SettingsPage` | Both | Profile, theme toggle, notification preferences |
| 15 | (auth) | `AuthScreen` | Public | Login form with gradient background |

### Design Tokens (from Figma CSS)

```css
/* Light */
--primary: #2563eb    /* blue-600 */
--secondary: #4f46e5  /* indigo-600 */
--accent: #06b6d4     /* cyan-500 */
--bg: #f8fafc         /* slate-50 */
--surface: #fff
--surface-2: #f1f5f9  /* slate-100 */
--text: #0f172a       /* slate-900 */
--muted: #64748b      /* slate-500 */
--border: #e2e8f0     /* slate-200 */

/* Dark */
--bg: #08111f
--surface: #101c2d
--surface-2: #18263a
--text: #e8eef8
--muted: #94a3b8
--border: #27364b
```

### Typography
- Font: Inter (Figma) vs Geist (current web app)
- Weights: 400, 500, 600, 700, 800

### Shared Components in Figma
- `Logo` — gradient icon + "Lumi" text
- `Avatar` — initials-based circular avatar
- `Badge` — colored badges (blue, green, amber, cyan, slate)
- `Button` — primary, ghost, outline variants
- `EmptyState` — icon + text + action button
- `StatCard` — icon + title + value + trend
- `SectionHeader` — title + description + action button
- `Modal` — dialog overlay

### Navigation Structure

**Teacher sidebar:**
Tổng quan, Lớp học, Ngân hàng câu hỏi, Bài kiểm tra, Bài tập, Chấm bài, Khóa học, Phân tích

**Student sidebar:**
Tổng quan, Lớp học của tôi, Bài tập, Bài kiểm tra, Khóa học, Kết quả, Tiến độ học tập

## 2. Gap Analysis: Figma vs Current Web App

### Current web app has (15 pages):
- Login, Register, Dashboard, Classrooms, Classroom Detail, Exams, Exam Detail,
  Questions, Assignments, Take Exam, Results, My Results, Notifications, Profile, Analytics

### Figma introduces / redesigns:
| Item | Status | Action |
|---|---|---|
| **Login/Auth** | Exists but plain | Redesign to match Figma gradient style |
| **Dashboard (Teacher)** | Exists but basic | Redesign with stat cards, activity feed, quick actions |
| **Dashboard (Student)** | Exists but basic | Redesign with hero, upcoming assignments, recent results |
| **Classrooms** | Exists | Redesign card layout to match Figma |
| **Questions** | Exists | Add tabs, improved card design |
| **Exams** | Exists | Add status badges, improved list |
| **Create/Edit Exam** | Does not exist as multi-step | New: 3-step wizard |
| **Take Exam** | Exists but MCQ only | Redesign full-screen layout, add question types |
| **Assignments** | Exists but basic | Redesign with teacher/student views, file upload |
| **Grading** | Does not exist | New page: manual grading workspace |
| **Courses** | Not in scope (P3) | Skip — listed as P3 feature |
| **Analytics** | Exists but basic | Redesign with more charts and metrics |
| **Results (Student)** | Exists | Redesign card layout |
| **Notifications** | Exists | Redesign list layout |
| **Settings/Profile** | Exists as Profile | Expand to full settings page |
| **Sidebar** | Exists | Update nav items to match Figma, add role-switch display |
| **Logo** | Text only | Add gradient icon mark |
| **Dark mode** | Exists | Align colors with Figma tokens |

## 3. Implementation Strategy

### Principle: Adapt, Don't Replace
The Figma design is a **static prototype** (no API calls, no routing, no auth).
We must adapt its visual design into the existing Next.js app which already has:
- File-based routing
- Auth context + JWT tokens
- API client with error handling
- shadcn/ui component library
- Tailwind CSS 4 with theme tokens
- Protected routes

### What we reuse from the existing app:
- All routing (`app/` directory structure)
- Auth context (`lib/auth-context.tsx`)
- API client (`lib/api.ts`)
- shadcn/ui components (`components/ui/`)
- Protected route wrapper
- Theme provider (next-themes)

### What we adopt from Figma:
- Visual design language (colors, spacing, typography)
- Screen layouts and component arrangements
- Vietnamese copy and labels
- Icon choices (lucide-react — already used)
- Dark mode color scheme
- Mobile responsive patterns

## 4. Implementation Phases (Feature by Feature)

### Phase F1: Design Foundation (no new pages)
**Goal:** Align global styles, sidebar, header, shared components with Figma.

| Task | Files | Description |
|---|---|---|
| F1.1 | `globals.css` | Add Figma color tokens as CSS custom properties; map to existing shadcn vars |
| F1.2 | `components/sidebar-nav.tsx` | Update nav items to match Figma (add Grading for teacher, Results/Progress for student) |
| F1.3 | `components/ui/logo.tsx` | New: gradient logo mark component |
| F1.4 | `app/dashboard/layout.tsx` | Update sidebar header with Logo, update header styling |
| F1.5 | `components/ui/stat-card.tsx` | New: reusable stat card component |
| F1.6 | `components/ui/section-header.tsx` | New: page section header with title/description/action |
| F1.7 | `components/ui/empty-state.tsx` | New: empty state placeholder |

### Phase F2: Auth & Settings Pages
| Task | Files | Description |
|---|---|---|
| F2.1 | `app/login/page.tsx` | Redesign with Figma gradient background, card layout |
| F2.2 | `app/register/page.tsx` | Match login design style |
| F2.3 | `app/dashboard/profile/page.tsx` | Expand to full settings page matching Figma |

### Phase F3: Dashboard Pages
| Task | Files | Description |
|---|---|---|
| F3.1 | `app/dashboard/page.tsx` | Teacher dashboard: stat cards, recent activity, quick actions |
| F3.2 | `app/dashboard/page.tsx` | Student dashboard: hero banner, upcoming, recent results |

### Phase F4: Classrooms
| Task | Files | Description |
|---|---|---|
| F4.1 | `app/dashboard/classrooms/page.tsx` | Redesign with Figma card layout, join code display, member counts |
| F4.2 | `app/dashboard/classrooms/[id]/page.tsx` | Update detail page styling |

### Phase F5: Question Bank
| Task | Files | Description |
|---|---|---|
| F5.1 | `app/dashboard/questions/page.tsx` | Add tabs (Tất cả, Trắc nghiệm, etc.), redesign question cards |

### Phase F6: Exams
| Task | Files | Description |
|---|---|---|
| F6.1 | `app/dashboard/exams/page.tsx` | Redesign with status badges, improved list/cards |
| F6.2 | `app/dashboard/exams/[id]/page.tsx` | Update exam detail |
| F6.3 | `app/dashboard/exams/create/page.tsx` | New: 3-step exam creation wizard |

### Phase F7: Take Exam (Full-Screen)
| Task | Files | Description |
|---|---|---|
| F7.1 | `app/dashboard/take-exam/[examId]/page.tsx` | Redesign full-screen layout: timer, navigator, all question types |

### Phase F8: Assignments
| Task | Files | Description |
|---|---|---|
| F8.1 | `app/dashboard/assignments/page.tsx` | Redesign with teacher/student views, deadline display |

### Phase F9: Grading (New)
| Task | Files | Description |
|---|---|---|
| F9.1 | `app/dashboard/grading/page.tsx` | New: grading workspace matching Figma |

### Phase F10: Analytics & Results
| Task | Files | Description |
|---|---|---|
| F10.1 | `app/dashboard/analytics/page.tsx` | Redesign with Figma charts and metrics |
| F10.2 | `app/dashboard/my-results/page.tsx` | Redesign student results cards |
| F10.3 | `app/dashboard/results/page.tsx` | Update teacher results view |

### Phase F11: Notifications
| Task | Files | Description |
|---|---|---|
| F11.1 | `app/dashboard/notifications/page.tsx` | Redesign notification list |

## 5. Dependency Order

```
F1 (foundation) → F2 (auth) → F3 (dashboard) → F4–F11 (parallel per page)
```

F1 must go first because all pages use the shared components.
F2 is independent of F3–F11.
F3–F11 are independent of each other (each page is self-contained).

## 6. Out of Scope

- **Courses page** (`CoursesPage` in Figma): P3 feature, not in backend scope
- **Backend changes**: All API endpoints already exist from P0a/P0b and will be completed in B1–B6
- **New API endpoints**: If a page needs an endpoint that B1–B6 haven't built yet, the page uses mock data or shows an empty state with a TODO comment
- **Register returning tokens**: B1 scope, not blocking — the register page will redirect to login after success

## 7. Technical Notes

- **Font**: Keep Geist (current) rather than switching to Inter — Geist is already configured and visually similar
- **Component library**: Reuse shadcn/ui components; only add custom components where shadcn has no equivalent
- **Dark mode**: Map Figma dark tokens to existing shadcn dark theme vars in `globals.css`
- **Responsive**: Figma design uses a 252px sidebar. Current app uses 256px (w-64). Keep w-64.
- **Icons**: Both use lucide-react — direct match
- **API integration**: Every page that shows data calls the real API. Mock data only for endpoints that don't exist yet.
