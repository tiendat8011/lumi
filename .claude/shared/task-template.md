# Task Board Template

Copy this file to `docs/work/<task-id>/TASKS.md`. Only the orchestrator edits
the board.

```markdown
# <task-id>: <title>

- Request: <the user's request, quoted or closely paraphrased>
- Workflow: feature-development | bug-fixing | code-review | documentation
- Size: S | M | L
- Collaboration mode: A (agent team) | B (subagents, orchestrator as bridge)
- Spec: <path under docs/features/, if any>
- Started: <YYYY-MM-DD>
- Current phase: <phase name>

## Tasks

### T1: <short title>

- Objective: <one sentence stating the outcome>
- Assigned agent: <agent name>
- Input context: <paths to read; facts the agent cannot find itself>
- Dependencies: <task IDs that must be done first, or "none">
- Expected output: <files to write or change, or the review to return>
- Acceptance criteria:
  - <checkable statement>
  - <checkable statement>
- Status: pending | in_progress | in_review | changes_requested | done | blocked
- Verification evidence: <commands and results, review verdicts, file:line>

### T2: ...

## Phase gates

| Gate | Condition | Passed | Evidence |
|---|---|---|---|
| Spec approved | No open BLOCKING finding from architect, QA, researcher | | |
| Design approved | No open BLOCKING finding from BA, QA | | |
| Implementation complete | Lint and build pass; deviations reported | | |
| Verified | Acceptance criteria checked by QA; reviewer verdict recorded | | |
| Documented | Docs match final behavior | | |

## Open questions for the user

| # | Question | Raised by | Blocking? | Answer |
|---|---|---|---|---|
```

Rules for writing tasks:

- One task has one owner and one verifiable output.
- Tasks that touch the same file are never open at the same time.
- Input context names files and sections. The agent starts with no memory of
  the conversation, so anything not written here or in a named file is lost.
- Acceptance criteria describe an observable result, not an activity.
