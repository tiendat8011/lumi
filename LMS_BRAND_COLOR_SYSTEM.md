# LMS Brand Color System & UI Rules

> Source of truth for the LMS brand palette, semantic colors, light/dark themes, and UI color rules.
>
> **Brand direction:** Trustworthy Blue — Modern SaaS, trustworthy, clear, reliable, and approachable.
> **Audience:** Teachers and students.

Claude and developers should read this file before making frontend UI changes. Do not invent brand colors or use arbitrary HEX values in feature components.

## 1. Brand principles

The LMS should feel like a modern SaaS product with an education focus:
- Trustworthy for exams, grades, submissions, and learning records.
- Clear and easy to understand.
- Modern and polished, not like a traditional school website.
- Friendly enough for students and professional enough for teachers.

Use neutral surfaces and reserve brand colors for actions and meaningful emphasis. Keep exam screens calm and distraction-free. Never use color as the only way to communicate status.

## 2. Core brand palette

| Token | HEX | Purpose |
|---|---|---|
| `brand-primary` | `#2563EB` | Main identity, primary buttons, active navigation, links, selected controls |
| `brand-primary-hover` | `#1D4ED8` | Primary button hover in light mode |
| `brand-secondary` | `#4F46E5` | Supporting hierarchy, secondary highlights, selected tabs |
| `brand-accent` | `#06B6D4` | Progress indicators, analytics, small accents |
| `brand-navy` | `#0F172A` | Strong headings and high-emphasis text in light mode |

Rules:
- Primary Blue is the dominant brand color.
- Indigo is secondary; use it sparingly.
- Cyan is an accent, not another primary. Prefer it for progress and charts.
- Do not give Blue, Indigo, and Cyan equal visual weight on the same screen.
- Avoid large saturated color blocks and decorative gradients unless explicitly designed.
- Do not use `#06B6D4` for small text on white; contrast may be insufficient.

## 3. Neutral palette

| Token | Light mode | Dark mode | Usage |
|---|---|---|---|
| `background` | `#F8FAFC` | `#020617` | App/page background |
| `surface` | `#FFFFFF` | `#0F172A` | Cards, dialogs, menus, panels |
| `surface-secondary` | `#F1F5F9` | `#1E293B` | Subtle sections, grouped content, hover backgrounds |
| `border` | `#E2E8F0` | `#334155` | Dividers and card borders |
| `input-border` | `#CBD5E1` | `#475569` | Input and select outlines |
| `foreground` | `#0F172A` | `#F8FAFC` | Main text and headings |
| `text-secondary` | `#475569` | `#CBD5E1` | Supporting text |
| `text-muted` | `#94A3B8` | `#64748B` | Low-priority metadata and placeholders |
| `focus-ring` | `#2563EB` | `#60A5FA` | Keyboard focus |

Neutral usage:
- Use `background` for the application canvas and `surface` for cards/interactive containers.
- Use `surface-secondary` to group content without adding unnecessary borders.
- Use `text-muted` only for low-priority information, never essential instructions.
- Prefer spacing and hierarchy over outlining every element.

## 4. Semantic colors

| State | Light foreground | Light background | Dark foreground | Dark background | Meaning |
|---|---|---|---|---|---|
| Success | `#16A34A` | `#F0FDF4` | `#4ADE80` | `#052E16` | Completed, successful, submitted |
| Warning | `#D97706` | `#FFFBEB` | `#FBBF24` | `#451A03` | Attention required, time nearly over |
| Error | `#DC2626` | `#FEF2F2` | `#F87171` | `#450A0A` | Invalid, failed, overdue, destructive |
| Info | `#0284C7` | `#F0F9FF` | `#38BDF8` | `#082F49` | Guidance and informational messages |

Rules:
- Green = completed/successful; amber = warning/deadline; red = error/overdue/destructive; info blue = neutral guidance.
- Pair every semantic color with a label, icon, or clear message.
- Do not reveal correct answers during an active exam unless exam settings explicitly allow it.
- Do not use success green to imply correctness before submission/grading.

## 5. Theme tokens

Use centralized CSS variables (or the equivalent token mechanism in the existing project). Components must use semantic tokens, not hardcoded theme-specific HEX values.

### Light theme

```css
:root {
  color-scheme: light;

  --brand-primary: #2563EB;
  --brand-primary-hover: #1D4ED8;
  --brand-secondary: #4F46E5;
  --brand-accent: #06B6D4;
  --brand-navy: #0F172A;

  --background: #F8FAFC;
  --surface: #FFFFFF;
  --surface-secondary: #F1F5F9;

  --foreground: #0F172A;
  --text-secondary: #475569;
  --text-muted: #94A3B8;

  --border: #E2E8F0;
  --input-border: #CBD5E1;
  --focus-ring: #2563EB;

  --success: #16A34A;
  --success-background: #F0FDF4;
  --warning: #D97706;
  --warning-background: #FFFBEB;
  --error: #DC2626;
  --error-background: #FEF2F2;
  --info: #0284C7;
  --info-background: #F0F9FF;
}
```

### Dark theme

```css
.dark {
  color-scheme: dark;

  --brand-primary: #3B82F6;
  --brand-primary-hover: #60A5FA;
  --brand-secondary: #818CF8;
  --brand-accent: #22D3EE;
  --brand-navy: #F8FAFC;

  --background: #020617;
  --surface: #0F172A;
  --surface-secondary: #1E293B;

  --foreground: #F8FAFC;
  --text-secondary: #CBD5E1;
  --text-muted: #64748B;

  --border: #334155;
  --input-border: #475569;
  --focus-ring: #60A5FA;

  --success: #4ADE80;
  --success-background: #052E16;
  --warning: #FBBF24;
  --warning-background: #451A03;
  --error: #F87171;
  --error-background: #450A0A;
  --info: #38BDF8;
  --info-background: #082F49;
}
```

Theme behavior:
- Light mode is the default unless the product already has a theme preference.
- Support dark mode with the dark tokens above; do not simply invert colors.
- Prefer a saved user preference; otherwise use system preference if theme selection is implemented.
- Verify hover, active, selected, disabled, focus, loading, and validation states in both themes.

## 6. Component-level color rules

| Component/state | Recommended treatment |
|---|---|
| Primary button | `brand-primary` background, white text |
| Primary button hover | `brand-primary-hover` background |
| Secondary button | `surface` background, `border` outline, `foreground` text |
| Ghost button | Transparent background; primary text when appropriate |
| Destructive button | `error` treatment |
| Text link | `brand-primary`, with visible hover/focus |
| Active sidebar item | Subtle blue-tinted background + primary icon/text |
| Inactive sidebar item | `text-secondary` |
| Card | `surface`, optional subtle `border` |
| Page | `background` |
| Input | `surface`, `input-border`, `foreground` |
| Input focus | `focus-ring` |
| Disabled control | Muted neutral treatment; do not rely on opacity alone |
| Badge | Semantic or neutral background with readable matching text |
| Progress bar | Primary Blue; Cyan may be a secondary chart series |
| Table header | `surface-secondary` + `text-secondary` |
| Selected answer | Subtle primary tint + primary border + selected indicator |
| Correct answer after grading | Success color + text/icon |
| Incorrect answer after grading | Error color + text/icon |
| Exam warning timer | Warning treatment |
| Expired exam/submission error | Error treatment |

Selected-answer states:
- Unselected: neutral surface and border.
- Hover: subtle secondary surface or primary tint.
- Selected: light blue tint, primary border, and a clear radio/check indicator.
- Dark mode: dark blue-tinted surface and visible blue border.
- Do not saturate the entire question card.

## 7. Product-specific guidance

### Teacher dashboard
- Primary Blue for Create class, Create exam, Create assignment.
- Neutral surfaces for tables, student lists, and management cards.
- Indigo sparingly for categories or analytics.
- Cyan for progress and charts, not default actions.
- Semantic colors for submission and grading states.

### Student dashboard
- Primary Blue for Join class, Continue learning, Start assignment.
- Progress indicators show course/assignment completion.
- Success only when work is actually completed or submitted.
- Keep course cards calm and readable; avoid overly colorful cards.

### Online examination
- Use neutral background and surface for the question workspace.
- Primary Blue for current question, selected answer, and main submission action.
- Cyan only for secondary progress visualization.
- Warning for low-time states, with a textual countdown warning.
- Error for expired exams, submission failures, and validation problems.
- Do not expose answer correctness during an active attempt unless explicitly allowed.
- Avoid gradients, animated color effects, and decorative color blocks.
- Distinguish question navigation states with labels/icons/patterns as well as color.

## 8. Brand color proportions

The 60 / 20 / 20 guideline applies only to relative use of brand accents when they are needed:
- 60% Primary Blue
- 20% Secondary Indigo
- 20% Accent Cyan

This does **not** mean 60% of the screen should be blue. Neutral colors should occupy most of the interface. A typical screen is neutral-first, with Blue for the main action, and Indigo/Cyan as supporting accents.

## 9. Accessibility

- Target WCAG 2.1 AA contrast: at least **4.5:1** for normal text and **3:1** for large text and meaningful UI components/indicators where applicable.
- Verify actual foreground/background combinations in both themes.
- Do not assume every brand color works as text on every background. Cyan should generally be an accent/graphic on white, not small text.
- Never use color alone to communicate selected, correct, incorrect, overdue, or warning states.
- Provide visible keyboard focus indicators.
- Do not reduce text contrast for aesthetic reasons.

## 10. Implementation rules for Claude and developers

1. Inspect the repository first: identify styling system, component library, theme implementation, and existing token conventions.
2. Reuse existing project conventions. Do not introduce a second styling system just to apply this palette.
3. Centralize all color definitions in the existing theme/token location.
4. Use semantic names in components, e.g. `bg-primary`, `text-foreground`, `bg-card`, `border-border`, `text-success`, or the project's equivalent.
5. Avoid hardcoded HEX values in feature components. HEX values belong in the central token/theme definition, except documented cases such as chart libraries that require explicit colors.
6. Do not invent new brand colors. If a new color is genuinely required, explain the use case and update this document and tokens consistently.
7. Do not use brand colors to represent semantic states.
8. Implement and verify both light and dark themes.
9. Check default, hover, active, focus-visible, selected, disabled, loading, error, and success states as relevant.
10. Preserve accessibility and verify contrast.
11. Keep exam UI restrained; readability and exam integrity take priority over decoration.
12. Do not redesign unrelated UI or change product behavior as part of a color-system task.

### Acceptance checklist

- [ ] Brand, neutral, and semantic tokens are centralized.
- [ ] Light theme uses the specified light values.
- [ ] Dark theme uses the specified dark values.
- [ ] Feature components use semantic tokens instead of arbitrary HEX values.
- [ ] Primary, secondary, accent, and semantic colors have consistent meanings.
- [ ] Buttons, inputs, cards, navigation, badges, tables, and modals are checked.
- [ ] Teacher and student dashboards are visually consistent.
- [ ] Exam screen is calm, readable, and distraction-free.
- [ ] Text and controls meet contrast requirements.
- [ ] Statuses are not communicated by color alone.

## 11. Instruction to Claude

Read this document before implementing or changing frontend UI. Treat it as the source of truth for brand colors and color usage. First inspect the repository's existing styling and component architecture. Implement the palette through centralized semantic design tokens and support both light and dark themes. Reuse existing conventions and components. Do not hardcode arbitrary HEX values in feature components, invent additional brand colors, or change product behavior as part of a visual styling task. Check interaction states and accessibility in both themes. If the existing architecture conflicts with this specification, explain the conflict and propose the smallest compatible change before making broad refactors.

## 12. Final reference

- **Brand:** Trustworthy Blue
- **Direction:** Modern SaaS, trustworthy, approachable
- **Audience:** Teachers and students
- **Primary:** `#2563EB`
- **Secondary:** `#4F46E5`
- **Accent:** `#06B6D4`
- **Core rule:** Neutral-first UI, Blue for primary actions, Indigo for supporting hierarchy, Cyan for accents/progress, semantic colors for system states.
