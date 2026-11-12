# Workflow C: Team Code Review

A reference procedure for the orchestrator. Claude Code does not execute this
file; the `/team-review` skill and the orchestrator agent load and follow it.
Rules for reviews and disagreements are in
`.claude/shared/collaboration-protocol.md`.

This is a multi-perspective review of existing code or a pending change. It
changes no code. For a quick single-reviewer pass, use Claude Code's built-in
`/code-review` instead.

| Step | Agent | Lens | Output |
|---|---|---|---|
| 1. Define the scope: files, module, or diff, and the spec it should satisfy. Open `docs/work/<task-id>/TASKS.md` | orchestrator | | Task board |
| 2a. Review | architect | Design consistency, transactions, concurrency, schema, performance | Review |
| 2b. Review | qa-engineer | Test coverage against acceptance criteria; runs the existing tests | Review with test results |
| 2c. Review | independent-reviewer | Security, authorization, data integrity, complexity | Review |
| 2d. Review, when a spec exists | business-analyst | Behavior against each business rule | Review |
| 3. Cross-examination | all reviewers | Each reads the others' findings and confirms, disputes, or extends them | Updated findings |
| 4. Consolidate: merge duplicates, rule on disputes, order by severity | orchestrator | `reviews.md`, `decisions.md`, `report.md` |

Notes:

- Step 2 runs in parallel; reviewers write no files. In Mode B the
  orchestrator files each review in `reviews.md`.
- Step 3 is what makes this a team review. In Mode A the reviewers debate
  directly. In Mode B the orchestrator sends each reviewer the others'
  findings and asks which it can confirm with evidence and which it disputes.
  A finding confirmed by a second reviewer is marked confirmed; a disputed
  one becomes a decision record.
- Choose reviewers by scope. A web-only styling change does not need the
  architect; anything touching auth, grading, or attempts needs the
  independent reviewer.
- The repository may have no commits. If `git diff` shows nothing useful,
  scope the review by file list.

The report lists findings by severity with file:line, evidence, who raised
and who confirmed each one, the suggested fix, and what was not reviewed. To
act on the findings, start the feature or bug workflow with the report as
input.
