# Decision Record Template

Append one entry per disagreement or significant choice to
`docs/work/<task-id>/decisions.md`. Only the orchestrator edits that file.

```markdown
## D<n>: <the question being decided>

- Date: <YYYY-MM-DD>
- Raised by: <agent>
- Related tasks: <task IDs>
- Status: open | decided | escalated to user

### Positions

**<agent A>** recommends: <position>
- Evidence: <file:line, test output, document quote, source link>
- Trade-offs: <what this costs>

**<agent B>** recommends: <position>
- Evidence: <...>
- Trade-offs: <...>

### Decision

<what was decided>

- Decided by: orchestrator | user
- Reason: <why this option, in terms of the evidence above>
- Rejected option and why: <one or two lines>
- Consequences: <files, specs, tests that must change>
- Copy to docs/TECHNICAL_DECISIONS.md: yes | no
```

Escalate to the user instead of deciding when the choice changes product
behavior or scope, contradicts a CONFIRMED entry in
`docs/TECHNICAL_DECISIONS.md`, or answers an entry in
`docs/FEATURE_OPEN_QUESTIONS.md`.
