# Hackathon Rubric Map

## Core Workflow Implementation - 20

Implemented:

- Feature intake
- Requirement clarification
- PRD generation
- Engineering task generation
- GitHub PR linking and snapshots
- AI QA review
- Requirement coverage map
- Developer fix pack
- Human approval decisions
- Release reports
- GitHub proof comment/status

## AI Agent Quality - 20

Implemented:

- Requirement agent
- PRD agent
- Task agent
- Repository analysis agent
- QA agent
- Release readiness shaping
- Requirement coverage mapping from stored QA evidence
- Developer fix pack with suggested fixes, tests, and coding-agent prompt

Future improvement:

- Project-level verification rule CRUD and direct QA prompt injection.
- AI review chat grounded only in current feature/workspace context.

## GitHub Integration - 15

Implemented:

- GitHub App installation model
- Repository connection
- GitHub webhook event records
- PR selection/linking
- Changed file/diff snapshot fetch
- QA review against PR evidence
- Sticky GitHub proof comment
- Commit status signal named `MergeMint Verification`

## Review Loop & Human Approval - 15

Implemented:

- Blocking and non-blocking findings
- Missing/partial/covered requirement evidence
- Re-review path after PR changes
- Approval and changes-requested decisions
- Release reports
- Release evidence graph in the proof gate panel

## tRPC Monorepo & Engineering Quality - 15

Implemented:

- tRPC routers and protected procedures
- Backend business logic in `packages/api/src/services`
- Drizzle schema and migrations in `packages/db`
- GitHub primitives in `packages/github`
- AI prompts/agents in `packages/ai`
- Workspace-scoped resource access
- Idempotent Razorpay activation
- Sticky GitHub proof publication record

## SaaS Product Experience - 10

Implemented:

- Landing page
- Auth
- Dashboard
- Projects
- Billing
- Admin manual access
- Report sharing
- Guided workflow surfaces
- CLI preview page
- Terms, privacy, and refund pages
- Public pricing checkout safety

## Known Gaps

- Team invite acceptance and role-specific client viewer experiences are not fully implemented in this pass.
- Verification Rules CRUD and prompt injection remain the next highest-value backend foundation.
- CLI and GitHub Action are preview/future surfaces, not published packages.
