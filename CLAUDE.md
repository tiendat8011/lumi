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

Jest is configured for the API but the repository has no test files yet. The
web app has no test framework. There is no CI.

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
