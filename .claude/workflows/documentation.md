# Workflow D: Documentation

A reference procedure for the orchestrator. Claude Code does not execute this
file; the `/docs-sync` skill and the orchestrator agent load and follow it.
Rules for handoffs and reviews are in
`.claude/shared/collaboration-protocol.md`.

Use it to write a new specification, or to bring existing documentation back
in line with the code. It changes no production code.

## D1: New or revised feature specification

| Step | Agent | Output |
|---|---|---|
| 1. Define the feature and scope; open `docs/work/<task-id>/TASKS.md` | orchestrator | Task board |
| 2. Research, if the behavior is not already settled | product-researcher | `research.md` |
| 3. Write or revise the spec | business-analyst | Spec in `docs/features/` |
| 4. Review, in parallel | architect (feasibility, accuracy against code), qa-engineer (edge cases, testable criteria), product-researcher (UX) | Reviews |
| 5. Answer findings; revise | business-analyst | Revised spec |
| 6. Update the index, gaps and open questions | technical-writer | Durable docs |
| 7. Report | orchestrator | `report.md` |

## D2: Documentation audit and sync

| Step | Agent | Output |
|---|---|---|
| 1. Define which documents and which code are in scope | orchestrator | Task board |
| 2. Compare docs with the code and list every mismatch | technical-writer | Mismatch list: doc location, code location, which appears correct |
| 3. Check the technical mismatches | architect | Review |
| 4. Rule on each mismatch: fix the doc, or report the code as a bug | orchestrator | `decisions.md` |
| 5. Fix the documents | technical-writer for durable docs, business-analyst for specs | Updated docs |
| 6. Spot-check the result against the code | independent-reviewer | Review |
| 7. Report | orchestrator | `report.md` |

Notes:

- When a document and the code disagree, the document is not automatically
  the one that is wrong. If the code violates a business rule, it is a bug:
  record it in `docs/FEATURE_GAPS.md` and leave the rule in the spec.
- Split step 5 by file so that no two agents edit the same document.
- Status words must reflect the code as checked today: Existing, Partial,
  Proposed, Not Implemented.

The report lists documents changed, mismatches found and how each was
resolved, code defects discovered, and documents not checked.
