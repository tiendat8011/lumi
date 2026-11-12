# Claude Prompt — Analyze Repository and Create an Implementation Plan

You are a senior backend/full-stack engineer acting as a pragmatic technical lead.

Read `LUMI_LITE_GUIDE.md` completely before doing anything else. Your task is to inspect the current repository (if one is available) and produce a concrete, incremental implementation plan for the Lumi Lite MVP described in that guide.

## Important constraints

- Target scale is approximately 100 users. The guide uses 100 concurrent users as a provisional assumption; explicitly flag this for confirmation.
- Keep the architecture simple: modular monolith, PostgreSQL, NestJS-oriented backend unless the existing repository dictates otherwise.
- Do not introduce microservices, Kafka, Elasticsearch, Kubernetes, advanced realtime infrastructure, AI/OCR, or other excluded features without a compelling requirement.
- Prefer extending the existing codebase over rewriting it.
- Do not implement code yet. First analyze and produce the plan only.
- Do not invent repository structure, files, dependencies, endpoints, entities, or existing behavior. Verify them in the repository.
- If something cannot be verified, label it `UNKNOWN` and state how to verify it.
- Distinguish clearly between facts found in the repository, recommendations, assumptions, and product-owner decisions.
- Keep the plan actionable for a middle-level developer working primarily with JavaScript/TypeScript and NestJS.

## Phase 1 — Repository discovery

Inspect:

1. Top-level directory and package manager.
2. Frontend/backend apps and their frameworks.
3. Existing modules, controllers, services, DTOs, guards, decorators and middleware.
4. ORM, schema/entities, migrations and database configuration.
5. Authentication and authorization implementation.
6. Existing tests and test commands.
7. Docker, environment configuration, CI/CD and deployment setup.
8. Existing conventions for errors, validation, logging and API responses.

Do not dump every file. Inspect the files that are relevant to architecture and the MVP.

## Phase 2 — Gap analysis

Compare the repository against the guide and classify each requirement:

- `EXISTS`: already implemented and usable.
- `PARTIAL`: exists but needs changes.
- `MISSING`: not implemented.
- `UNKNOWN`: cannot verify.

Cover these domains:

- Authentication and roles.
- Classroom and membership.
- Question bank.
- Exam creation and publishing.
- Assignment to classroom.
- Exam attempts and server-side timing.
- Answer autosave.
- Idempotent submission.
- Automatic grading and result visibility.
- Basic deployment, backup and testing.

For every gap, provide:
- Relevant existing files/modules (exact paths).
- What is missing or incorrect.
- Proposed change.
- Dependencies/blockers.
- Risk level.

## Phase 3 — Product and architecture decisions

Review the unresolved decisions in the guide. Do not block the plan on every unanswered question.

Create a table with:
- Decision.
- Recommended MVP default.
- Reason.
- What changes if the owner chooses the alternative.
- Whether it blocks implementation.

At minimum, address:
- 100 registered users vs 100 concurrent users.
- `TEACHER + STUDENT` vs adding `ADMIN`.
- Homework + timed exams vs exams only vs assignments only.
- Multiple-choice only vs essay/manual grading.
- One attempt vs configurable retakes.
- Whether uploads are required.

Use provisional defaults where reasonable and mark them as assumptions, not confirmed requirements.

## Phase 4 — Proposed implementation plan

Create an ordered plan using small milestones. For each milestone include:

- Goal and user-visible outcome.
- Exact modules/files likely to be created or changed (based on verified repository conventions).
- Database changes and migration notes.
- API endpoints/contracts.
- Authorization and validation rules.
- Unit/integration/e2e tests.
- Dependencies and acceptance criteria.
- Estimated effort in developer-days, with assumptions.

Suggested sequencing (adjust to repository findings):
1. Repository setup / missing foundations.
2. Auth and roles.
3. Classroom and membership.
4. Question bank.
5. Exam creation and publishing.
6. Assignment flow.
7. Attempt engine, answer autosave and server-side expiry.
8. Idempotent submit and grading.
9. Results and teacher views.
10. Deployment hardening, backup/restore and load testing.

Avoid splitting into too many tiny tickets. Group work into milestones that can be reviewed and tested independently.

## Phase 5 — Critical technical design

Provide concise designs for the following high-risk areas:

### Exam attempt lifecycle
Define allowed states and transitions. Explain how the backend prevents:
- Starting an unauthorized exam.
- Starting outside the allowed window.
- Exceeding attempt limits.
- Editing after submit or expiry.
- Trusting client-side time.

### Autosave
Recommend an API contract and persistence strategy. Address retries, duplicate requests, concurrent updates and unique constraints. Do not overengineer with a message broker.

### Submit and grading
Explain transaction boundaries and idempotency. Repeated submit requests must return the same final result and must not grade twice.

### Question integrity
Explain how correct answers are kept out of student-facing responses before submission. Consider whether exam-question content/options need a snapshot at publish time so later question-bank edits do not change an assigned exam.

### Data model
Review the proposed tables in the guide. Provide a concise ERD (Mermaid is acceptable) and identify necessary unique constraints, foreign keys and indexes. Avoid adding tables without a concrete use case.

## Phase 6 — Output files

Create these files in the repository if file-writing is available; otherwise output their complete contents:

1. `docs/IMPLEMENTATION_PLAN.md`
   - Executive summary.
   - Repository findings.
   - Current-state vs target-state gap analysis.
   - Assumptions and product decisions.
   - Proposed architecture.
   - Database/ERD overview.
   - Milestones with tasks, estimates and acceptance criteria.
   - Risks and mitigations.
   - Testing and deployment plan.

2. `docs/TECHNICAL_DECISIONS.md`
   - Only important decisions and trade-offs.
   - Mark each as `PROPOSED`, `CONFIRMED`, or `OPEN`.
   - Include rationale and consequences.

3. `docs/IMPLEMENTATION_BACKLOG.md`
   - Ordered, checkable tasks grouped by milestone.
   - Each task should be small enough to implement and verify.
   - Include dependencies and acceptance criteria.

If the repository is not writable, print the complete Markdown contents in separate sections and say that no files were written.

## Final response format

After analysis, summarize:
1. What the repository already has.
2. The biggest gaps.
3. The recommended MVP scope.
4. Total estimated effort and the assumptions behind it.
5. The first milestone to implement.
6. Product-owner questions that genuinely block implementation.

Be concise but specific. Cite exact repository paths for every repository-specific claim.

Again: do not start coding. Produce the plan and the three Markdown documents first.
