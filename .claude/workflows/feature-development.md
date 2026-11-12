# Workflow A: Full Feature Development

A reference procedure for the orchestrator. Claude Code does not execute this
file; the `/feature-dev` skill and the orchestrator agent load and follow it.
Rules for handoffs, reviews and disagreements are in
`.claude/shared/collaboration-protocol.md`.

Scale the workflow to the task. For a size S task, skip Phase 1 research and
run Phases 2 to 6 with the smaller team named in the orchestrator's sizing
rule. Record what was skipped and why in `TASKS.md`.

## Phase 1: Discovery

Goal: enough shared understanding to write a spec.

| Step | Agent | Output | Parallel |
|---|---|---|---|
| 1.1 Analyze the request, inspect the code, open `docs/work/<task-id>/TASKS.md` | orchestrator | Task board | first |
| 1.2 Research UX and comparable products | product-researcher | `research.md` | yes |
| 1.3 Inspect the codebase and outline the technical constraints | architect | "Current state" and "Risks" sections of `design.md` | yes |
| 1.4 List the edge cases and risks the requirement implies | qa-engineer | Review-format list, filed in `reviews.md` | yes |
| 1.5 Identify requirements and business rules | business-analyst | Draft spec in `docs/features/` | after 1.2 to 1.4, which are its inputs |

Gate: the orchestrator has read every output and the blocking open questions
are either answered by the user or have an agreed provisional default.

## Phase 2: Specification review

Goal: a spec and a design the whole team has tried to break.

| Step | Agent | Output |
|---|---|---|
| 2.1 Complete the spec | business-analyst | Spec, status "in review" |
| 2.2 Review technical feasibility | architect | Review |
| 2.3 Review edge cases and acceptance criteria | qa-engineer | Review |
| 2.4 Review UX consistency | product-researcher | Review |
| 2.5 Answer every finding; revise the spec | business-analyst | Revised spec, point-by-point answers |
| 2.6 Write the technical design | architect | `design.md` |
| 2.7 Review the design against the spec | business-analyst, qa-engineer | Reviews |
| 2.8 Rule on disagreements; approve | orchestrator | `decisions.md`, gates marked |

Steps 2.2 to 2.4 run in parallel; they read the same file and write none. In
Mode A, reviewers send findings straight to the analyst and debate there. In
Mode B, the orchestrator relays.

Gate: no open BLOCKING finding on the spec or the design. Implementation does
not start before this gate. If the gate cannot be passed without a product
decision, ask the user.

## Phase 3: Implementation

| Step | Agent | Output | Parallel |
|---|---|---|---|
| 3.1 Implement in the design's order | developer | Code, unit tests, handoff with deviations | yes |
| 3.2 Write the test plan and acceptance tests from the spec and API contract | qa-engineer | `test-plan.md`, tests in `apps/api/test/` | yes, different files |
| 3.3 Review major technical decisions and any deviation | architect | Review | after 3.1, or at a checkpoint for large work |

If the developer finds a new requirement or an infeasible rule, work on that
part stops and the question goes to the orchestrator, then back through the
analyst or architect. The spec is updated before the code diverges from it.

Split large implementations into tasks that touch different files, for
example schema and API first, then the web page. Do not run two developer
tasks on the same module at once.

Gate: lint and build pass, the developer's handoff lists files changed and
deviations, and the orchestrator has read the diff.

## Phase 4: Verification

| Step | Agent | Output | Parallel |
|---|---|---|---|
| 4.1 Run tests; verify each acceptance criterion | qa-engineer | `test-report.md` | yes |
| 4.2 Independent review of spec, code and tests | independent-reviewer | Review, filed in `reviews.md` | yes |
| 4.3 Triage: confirm or reject each bug and finding | orchestrator, with architect when the cause is unclear | Updated board | |
| 4.4 Fix confirmed issues | developer | Fix and handoff | |
| 4.5 Rerun failed cases and the regression set | qa-engineer | Updated `test-report.md` | |
| 4.6 Re-review if a BLOCKING finding was fixed | independent-reviewer | Updated verdict | |

Repeat 4.3 to 4.6 until no Critical or High bug and no BLOCKING finding is
open. Anything left open is listed in the final report with its severity. If
the loop has run three times without converging, stop and report to the user.

Gate: every acceptance criterion is marked verified, failed, or not verified
with a reason; the reviewer's verdict is recorded.

## Phase 5: Documentation

| Step | Agent | Output |
|---|---|---|
| 5.1 Update the spec to the final behavior | business-analyst | Spec, status updated |
| 5.2 Update durable docs from the verified implementation | technical-writer | Status, gaps, questions, index, decisions, configuration |
| 5.3 Check technical accuracy | architect | Review |
| 5.4 Check the docs match final behavior | orchestrator | Gate marked |

Steps 5.1 and 5.2 run in parallel; they write different files.

## Phase 6: Final report

The orchestrator writes `docs/work/<task-id>/report.md` and reports to the
user:

- What was implemented
- Files changed
- Tests executed and their results
- Known limitations
- Remaining bugs
- Documentation updated
- Technical decisions made
- Outstanding questions
