# Lumi Lite

Lightweight LMS and online examination platform, modelled on Azota, for about
100 concurrent users. Roles: TEACHER and STUDENT (ADMIN is reserved).

## Stack

- npm workspaces: `apps/api` and `apps/web`. Node 20 or later.
- API: NestJS 11 on Fastify, Prisma 6, PostgreSQL 16, JWT auth with refresh
  rotation. Global prefix `/api`.
- Web: Next.js 16, React 19, TypeScript, Tailwind CSS 4, shadcn/ui on Base UI.
- Local services: `docker-compose.yml` (postgres, api, web, nginx).
  Configuration: `.env.example`.

## Commands

Run from the repository root.

| Purpose | Command |
|---|---|
| API dev server | `npm run dev:api` |
| Web dev server | `npm run dev:web` |
| Build | `npm run build:api`, `npm run build:web` |
| Lint | `npm run lint` |
| Format | `npm run format` |
| API unit tests (`*.spec.ts` in `apps/api/src`) | `npm run test:api` |
| API e2e tests (`apps/api/test`, needs the database) | `npm run test:e2e:api` |
| Prisma migration | `npm run prisma:migrate:dev --workspace=apps/api` |

The API has Jest unit tests. The web app has no test framework, so nothing
catches a web regression automatically. There is no CI, which is why the check
below is not optional.

## Verification before handing work back

No change is done until the checks have been run and their real output read.
There is no CI to catch what you skip, so a claim that something passes counts
for nothing without the command's output.

Run the checks through the `qa-engineer` agent rather than by hand, and give it
the diff to verify against. A fresh agent re-runs the commands and reads the
output instead of trusting the author's summary, which is the whole point: the
author is the least reliable judge of their own change.

| Check | Command | Applies to |
|---|---|---|
| Lint | `npm run lint` | every change |
| API unit tests | `npm run test:api` | every API change |
| API build | `npm run build:api` | every API change |
| Web build | `npm run build:web` | every web change |
| API e2e | `npm run test:e2e:api` | auth, grading, attempts (needs the DB) |

Rules:

- Compare against the state before your change. A pre-existing failure is not
  yours to claim as broken, and not yours to silently inherit either: say which
  failures existed before and which your change introduced, with file and line.
- Never silence a check to make it pass — no `eslint-disable` to clear a real
  finding, no skipped test, no `--no-verify`. If a rule genuinely does not
  apply, say why in the reply and in a comment at the site.
- A web change needs more than a green build: the build does not run the page.
  Say which screens you actually exercised and how.
- `apps/web/src/app/dashboard/take-exam/` and the grading and auth modules have
  no automated coverage and carry exam integrity. Changes there get a named
  manual check per behaviour touched, plus `npm run test:e2e:api`.
- Report failures and unverified items as plainly as successes. "Lint passes"
  when it was never run is the failure mode this section exists to prevent.

## Conventions

- API responses: `{success, data, meta}`; errors:
  `{success: false, error: {code, message}}`.
- `JwtAuthGuard` and `RolesGuard` are global. Use `@Public()` and `@Roles()`,
  and check ownership or membership in the service.
- Validate input with DTOs and class-validator.
- shadcn/ui triggers take a `render` prop, not `asChild`.
- All user-facing text is Vietnamese. Colors come from
  `LMS_BRAND_COLOR_SYSTEM.md`.
- Before writing Next.js code, read `apps/web/AGENTS.md`; this version
  differs from older Next.js.
- Formatting: `.prettierrc` and `.editorconfig`.
- Exam timing is server-authoritative, expiry is evaluated lazily on request
  (no scheduler), and exam content is snapshotted at publish. See
  `docs/TECHNICAL_DECISIONS.md` before changing any of these.

## Documentation

- Product scope: `LUMI_LITE_GUIDE.md`
- Decisions: `docs/TECHNICAL_DECISIONS.md`
- Feature specs: `docs/features/`, indexed in
  `docs/FEATURE_DOCUMENTATION_INDEX.md`
- Status, gaps, open questions: `docs/FEATURE_STATUS.md`,
  `docs/FEATURE_GAPS.md`, `docs/FEATURE_OPEN_QUESTIONS.md`

## Multi-agent team

Eight agents are defined in `.claude/agents/`: `orchestrator`,
`product-researcher`, `business-analyst`, `architect`, `developer`,
`qa-engineer`, `technical-writer`, `independent-reviewer`.

Start a coordinated task with a skill:

| Skill | Workflow |
|---|---|
| `/feature-dev <feature>` | Research, spec, design, implementation, verification, docs |
| `/bug-fix <symptom and steps>` | Reproduce, root cause, failing test, fix, verify |
| `/team-review <scope>` | Multi-perspective review with cross-examination; no code changes |
| `/docs-sync <feature or docs>` | Write a spec, or audit docs against code |

Or run a whole session as the lead: `claude --agent orchestrator`.

How it fits together:

- `.claude/shared/collaboration-protocol.md` holds the rules every agent
  follows: file ownership, handoffs, review format, disagreements.
- `.claude/workflows/*.md` are the procedures the orchestrator follows. They
  are reference documents; nothing executes them automatically.
- Each task keeps its board, reviews, decisions and report in
  `docs/work/<task-id>/`.
- With Agent Teams enabled (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`,
  experimental, interactive sessions only) the agents message each other
  directly. Otherwise they run as subagents and the orchestrator relays
  findings between them.

For a single-role job, ask for the agent directly, for example "use the
independent-reviewer agent on apps/api/src/modules/attempts".
