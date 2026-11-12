# Workflow B: Bug Investigation and Fixing

A reference procedure for the orchestrator. Claude Code does not execute this
file; the `/bug-fix` skill and the orchestrator agent load and follow it.
Rules for handoffs, reviews and disagreements are in
`.claude/shared/collaboration-protocol.md`.

| Step | Agent | Output |
|---|---|---|
| 1. Gather reproduction steps, expected and actual behavior, and evidence; open `docs/work/<task-id>/TASKS.md` | orchestrator | Task board with the bug statement |
| 2. Investigate the code and find the root cause | developer | Cause with file:line, and how it explains each symptom |
| 3. Review the root cause when it involves concurrency, data integrity, authorization, or the schema, or when the developer is unsure | architect | Review; whether sibling modules share the flaw |
| 4. Write a test that reproduces the bug and fails | qa-engineer | Failing test, or exact manual steps if it cannot be automated |
| 5. Implement the fix | developer | Fix, handoff with files changed |
| 6. Verify the fix and regression behavior | qa-engineer | `test-report.md`: the reproducing test now passes; regression set results |
| 7. Review risky fixes | independent-reviewer | Review and verdict |
| 8. Update docs if behavior, a gap, or a known limitation changed | technical-writer | `docs/FEATURE_GAPS.md` and related docs |
| 9. Report | orchestrator | `report.md` |

Notes:

- Steps 2 and 4 can run in parallel: the developer reads code while QA
  builds the reproduction from the reported behavior.
- When the cause is unclear, give two agents competing hypotheses, for
  example the developer on the API and the architect on the data model, and
  have each try to disprove the other's. This is a good use of Mode A.
- Step 3 may be skipped for a plainly local bug. Record that it was skipped.
- A fix is risky, and step 7 is required, when it touches authentication or
  authorization, grading or scoring, exam timing or submission, a
  transaction or lock, or the schema.
- If the "bug" is behavior the spec does not define, it is a requirements
  question. Send it to the business analyst and, if it changes product
  behavior, to the user.
- The fix is done when the reproducing test passed after failing before, the
  regression set passed, and required reviews have no open BLOCKING finding.
- If the bug cannot be reproduced, say so in the report with what was tried.
  Do not ship a speculative fix as a confirmed one.

The final report states: the symptom, the root cause, the fix, files changed,
tests run and results, other places with the same flaw, and anything not
verified.
