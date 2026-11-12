# Collaboration Protocol

Every agent in `.claude/agents/` reads this file before starting work. It is a
plain reference document: Claude Code does not execute it. It takes effect
because each agent's prompt tells the agent to follow it.

## 1. The team

| Agent | Owns | May write |
|---|---|---|
| `orchestrator` | The task, the plan, final decisions, the final report | `docs/work/<task-id>/TASKS.md`, `decisions.md`, `reviews.md`, `report.md` |
| `product-researcher` | Evidence about users, Azota and comparable products | `docs/work/<task-id>/research.md`, `docs/research/**` |
| `business-analyst` | The feature specification | `docs/features/<module>/<feature>.md` |
| `architect` | The technical design | `docs/work/<task-id>/design.md` |
| `developer` | Production code and its unit tests | `apps/**` (except QA-owned test files), Prisma schema and migrations |
| `qa-engineer` | Test plan, acceptance and regression tests, test evidence | `docs/work/<task-id>/test-plan.md`, `test-report.md`, `apps/api/test/**`, test files it creates |
| `technical-writer` | Durable documentation | `docs/**` except specs and `docs/work/**`, `README` files, `.env.example` comments |
| `independent-reviewer` | An independent verdict | Nothing. Read-only by tool restriction; returns its review as a message |

One owner per file. If you need a change in a file you do not own, ask its
owner (or the orchestrator); do not edit it. Two agents never edit the same
file at the same time.

## 2. Shared source of truth

Files are the record. Conversation is not. Anything another agent needs later
must be in a file.

Each task gets a work folder, `docs/work/<task-id>/`, where `<task-id>` is
`YYYYMMDD-short-slug` (for example `20261112-exam-access-code`):

```text
docs/work/<task-id>/
├── TASKS.md        task board (orchestrator only)
├── research.md     product research (product-researcher)
├── design.md       technical design (architect)
├── test-plan.md    test plan (qa-engineer)
├── test-report.md  executed tests and evidence (qa-engineer)
├── reviews.md      every review, appended verbatim (orchestrator)
├── decisions.md    disagreements and rulings (orchestrator)
└── report.md       final report (orchestrator)
```

Create only the files the task needs. The feature specification itself lives
in `docs/features/<module>/<feature>.md`, not in the work folder, because it
outlives the task.

Lasting project facts go to the durable docs through the technical writer:
`docs/TECHNICAL_DECISIONS.md`, `docs/FEATURE_STATUS.md`, `docs/FEATURE_GAPS.md`,
`docs/FEATURE_OPEN_QUESTIONS.md`, `docs/FEATURE_DOCUMENTATION_INDEX.md`.

## 3. Two collaboration modes

The orchestrator chooses the mode at the start of a task and records it in
`TASKS.md`.

### Mode A: Agent Team (direct messaging)

Available only when `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` and the session is
interactive. The orchestrator is the team lead and spawns each teammate from
its agent type with a name. Teammates message each other directly and share
the built-in task list.

- Send review findings directly to the author, and copy the lead.
- Claim a task before working on it; mark it complete only with evidence.
- The built-in task list is a working aid. `TASKS.md` stays the record,
  because team state is removed when the session ends.
- Known limits: a team cannot be resumed after the session ends, teammates
  cannot spawn their own teammates, there is one team per session, and the
  `skills` field of an agent definition is not applied to teammates.

Use Mode A when the work needs back-and-forth: specification review, design
debate, bug hypotheses that compete.

### Mode B: Subagents with the orchestrator as bridge

Works everywhere, including headless runs. Each agent is a subagent that
reports only to the orchestrator. Subagents cannot see each other, so the
orchestrator carries the conversation:

1. It gives each agent the paths of the artifacts to read, never a summary in
   place of the artifact.
2. It appends each review verbatim to `reviews.md`.
3. It sends the findings back to the author with the reviewer named, and asks
   for a response to each one: accepted and fixed, or rejected with evidence.
4. It repeats until every blocking finding is closed or ruled on.

Use Mode B for sequential work, small tasks, and whenever Mode A is
unavailable.

In both modes the same rules below apply.

## 4. Delegated tasks

Every delegated task is written to `TASKS.md` using
`.claude/shared/task-template.md` and carries: task ID, objective, assigned
agent, input context, dependencies, expected output, acceptance criteria,
status, verification evidence.

Statuses: `pending`, `in_progress`, `in_review`, `changes_requested`, `done`,
`blocked`. A task is `done` only when its verification evidence is filled in
and the reviews required by the workflow have no open blocking finding.

## 5. Handoffs

When you finish a task, report to the orchestrator in this shape:

```text
TASK: <task id>
STATUS: done | blocked | needs-decision
ARTIFACTS: <paths written or changed>
SUMMARY: <what was done, in a few lines>
EVIDENCE: <commands run and their result, file:line references, source links>
DEVIATIONS: <anything done differently from the spec or design, and why>
OPEN ISSUES: <questions, risks, things not verified>
```

State plainly what you did not verify. "Not run" is an acceptable answer;
a claim without evidence is not.

## 6. Reviews

Reviewing means looking for what is wrong, not confirming what is there.
Every review answers these questions about the work under review:

1. Which assumptions are unsupported?
2. Which scenarios are missing?
3. What can fail in production?
4. What could create inconsistent data?
5. What is more complicated than it needs to be?
6. What does not match what users expect?
7. What is not supported by the existing codebase?

Write each finding like this:

```text
[B1] BLOCKING | MAJOR | MINOR | QUESTION
Where: <file:line, or spec section>
Finding: <what is wrong>
Evidence: <code, test output, document quote, or source link>
Suggested fix: <concrete change>
```

- BLOCKING: the next phase must not start until this is fixed or ruled on.
- MAJOR: must be fixed before the task closes.
- MINOR: fix if cheap, otherwise record.
- QUESTION: the reviewer cannot tell; the author must answer.

End every review with a verdict: `APPROVE`, `APPROVE WITH CHANGES`, or
`REJECT`. A review with no findings must say what was checked and how, so the
reader can tell an approval from a skim.

The author answers every finding by ID: fixed (where), or rejected (evidence).
Silence on a finding is not allowed.

## 7. Disagreements

When two agents disagree and neither yields after one exchange:

1. Either agent records it in the handoff as `needs-decision`.
2. The orchestrator opens an entry in `decisions.md` using
   `.claude/shared/decision-template.md`.
3. Each side gives its evidence: code, documentation, tests, research.
4. Each side states the trade-offs and a recommended decision.
5. The orchestrator rules, and records the ruling and the reason.
6. If the ruling changes product behavior, scope, or a confirmed decision in
   `docs/TECHNICAL_DECISIONS.md`, the orchestrator asks the user instead of
   ruling alone.
7. Lasting rulings are copied to `docs/TECHNICAL_DECISIONS.md` by the
   technical writer.

A conflicting recommendation is never dropped silently. If it loses, the
record says why.

## 8. Ground rules for every agent

- Read the affected code before you write about it or change it. The existing
  docs describe intent; the code is what runs.
- Mark every statement as a verified fact, an assumption, or a
  recommendation when the difference matters.
- Stay inside your task. Report unrelated problems; do not fix them.
- Never change a business rule silently. Report it as a deviation.
- Prefer the simplest design that meets the requirement. This project targets
  about 100 concurrent users on a modular monolith; do not add queues,
  search clusters, or new services without a demonstrated need.
- Ask the orchestrator when a requirement is ambiguous. Do not guess on
  anything that affects grading, exam timing, or permissions.
- Destructive or outward-facing actions (dropping data, resetting the
  database, force-pushing, deploying) need the user's confirmation, through
  the orchestrator.
