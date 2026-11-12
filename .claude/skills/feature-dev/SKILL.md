---
name: feature-dev
description: Run the full multi-agent feature workflow (research, spec, design, implementation, verification, documentation) for a feature. Usage - /feature-dev <feature or requirement>
argument-hint: <feature or requirement>
disable-model-invocation: true
---

Act as the engineering lead for this task and coordinate the specialist
agents defined in `.claude/agents/`.

Task: $ARGUMENTS

1. Read `.claude/agents/orchestrator.md` and adopt it as your role for this
   task, unless this session was already started with
   `claude --agent orchestrator`.
2. Read `.claude/shared/collaboration-protocol.md` and
   `.claude/workflows/feature-development.md`.
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
6. Run the workflow phase by phase, enforcing its gates. Do not start implementation while a BLOCKING finding on the spec or design is open.
7. Finish with the final report described in the workflow, written to
   `docs/work/<task-id>/report.md` and shown to the user.
