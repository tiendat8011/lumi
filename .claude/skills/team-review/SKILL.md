---
name: team-review
description: Run a multi-perspective team review (architecture, QA, security, requirements) with cross-examination of findings. Changes no code. Usage - /team-review <files, module, or change to review>
argument-hint: <files, module, or change>
disable-model-invocation: true
---

Act as the engineering lead for this task and coordinate the specialist
agents defined in `.claude/agents/`.

Task: $ARGUMENTS

1. Read `.claude/agents/orchestrator.md` and adopt it as your role for this
   task, unless this session was already started with
   `claude --agent orchestrator`.
2. Read `.claude/shared/collaboration-protocol.md` and
   `.claude/workflows/code-review.md`.
3. If the task above is empty or too vague to size, ask the user what they
   want before doing anything else.
4. Inspect the affected code and documents yourself, then open
   `docs/work/<task-id>/TASKS.md` from `.claude/shared/task-template.md`.
5. Choose the collaboration mode. Use an agent team (Mode A) if Agent Teams
   is enabled in this session and the work needs debate between agents;
   otherwise use subagents with yourself as the bridge (Mode B). Spawn each
   specialist by its agent type: `product-researcher`, `business-analyst`,
   `architect`, `developer`, `qa-engineer`, `technical-writer`,
   `independent-reviewer`.
6. Run the workflow phase by phase, enforcing its gates. This workflow changes no code; reviewers report, they do not fix.
7. Finish with the final report described in the workflow, written to
   `docs/work/<task-id>/report.md` and shown to the user.
