# MergeMint

MergeMint is an AI Product Delivery Pipeline SaaS. It connects the original feature request to requirement review, PRD, engineering tasks, GitHub PR evidence, AI QA review, human approval, release reports, and GitHub proof.

GitHub shows what changed. MergeMint shows whether it is actually done.

## Tech Stack

- Next.js app in `apps/web`
- tRPC API in `packages/api`
- Drizzle/PostgreSQL schema and migrations in `packages/db`
- AI SDK/OpenAI prompt and agent logic in `packages/ai`
- GitHub App/Octokit integration in `packages/github`
- Environment validation/types in `packages/env`
- BetterAuth authentication
- Razorpay checkout and webhooks
- Vercel deployment target

## Core Workflow

Feature Request -> Requirement Review -> PRD -> Engineering Tasks -> GitHub PR -> AI QA Review -> Fix Loop -> Human Approval -> Release Report -> GitHub Proof.

Key implemented surfaces include projects, project-level Verification Rules, feature requests, requirement clarification, PRD generation, engineering tasks, GitHub repo/PR linking, PR snapshots, AI QA review, human approval, release board, client/developer/internal release reports, public report sharing, billing, admin manual access, Terminal Mode preview, and the GitHub Proof Gate.

MergeMint is the ShipFlow AI implementation for proof-led delivery: it turns product intent into an auditable release chain and shows whether a PR delivered the original promise.

## Async Workflow Coverage

Long-running product actions have a lightweight Inngest-ready async workflow layer in `packages/api/src/services/async-workflow.service.ts`.

Covered jobs:

- PRD generation
- Engineering task generation
- AI QA review / re-review
- Release readiness check placeholder

Each job exposes `queued`, `running`, `completed`, or `failed` status through the `asyncWorkflow` tRPC router. The current implementation keeps the queue minimal and reuses existing services; it can be swapped for hosted Inngest events without changing the product services.

## AI Features

- Requirement clarification
- Product Discovery verdict: Proceed to PRD, Needs clarification, Already exists, Duplicate request, Not worth building now, Out of scope
- PRD generation
- Engineering task generation
- Repository intelligence summaries
- QA review against PRD requirements, tasks, project Verification Rules, PR files, and diff evidence
- Requirement coverage mapping
- Developer fix pack generation from latest QA evidence
- Release readiness and report shaping

Verification Rules are project-scoped QA guardrails such as “Billing changes must include regression tests” or “GitHub integration changes must mention permissions/webhook behavior.” Enabled rules are included inside the normal AI QA Review context and do not consume extra credits beyond the QA review itself.

## GitHub Integration

MergeMint uses the GitHub App installation-token path when available. It can connect repositories, link real pull requests, refresh PR snapshots, read changed file metadata, and publish proof back to GitHub.

The GitHub Proof Gate publishes one sticky `MergeMint Verification` PR comment per feature/PR and creates a commit status named `MergeMint Verification`. Publishing proof is manual-only, does not rerun AI, and does not consume PR review credits.

## Reports And Sharing

MergeMint has three report types:

- Client Delivery Report: client-safe delivery evidence with promised vs shipped, requirement coverage, approval, known risks, final sign-off, share link, and GitHub Proof status. It avoids raw diffs, private repo internals, secrets, tokens, and developer-only fix instructions.
- Developer Fix Report: technical remediation view with blocking/non-blocking issues, missing requirements, suggested tests, copyable fix prompt, re-review checklist, and verification rule failures.
- Internal Release Report: operational view with PRD summary, engineering tasks, linked PR, QA evidence, requirement coverage, verification rule results, approval timeline, GitHub Proof status, known risks, final decision, and release checklist.

Share-token report access remains the current client-safe sharing model. Future role-based `client_viewer` access can layer on top without changing report safety rules.

## Terminal Mode Preview

Feature Detail includes a Terminal Mode preview panel with copyable examples for future CLI, report, rules, and GitHub Action workflows. Today, GitHub App + web dashboard is the supported path. The preview does not publish an npm package, call fake backend endpoints, or consume credits.

## Billing

Billing is workspace-based. Free workspaces receive 1 verified PR review credit. Paid checkout happens only inside protected `/app/billing`; public pricing and landing pages link to `/app/billing?checkoutPlan=<planKey>` and must not open Razorpay or create payment rows.

Only successful AI QA Review creation consumes credits. Verification Rules, failed AI calls, report sharing, GitHub proof publishing, Terminal Mode preview, team invites, onboarding previews, CLI preview, and admin actions do not consume PR review credits.

Required Razorpay variables:

- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
- `NEXT_PUBLIC_RAZORPAY_KEY_ID`

## Environment Variables

Common local variables include:

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `NEXT_PUBLIC_APP_URL`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `GITHUB_APP_ID`
- `GITHUB_APP_PRIVATE_KEY` or `GITHUB_APP_PRIVATE_KEY_BASE64`
- `GITHUB_APP_WEBHOOK_SECRET`
- `GITHUB_APP_SLUG`
- `GITHUB_TOKEN` only as an existing safe fallback
- Razorpay variables listed above
- `ADMIN_EMAILS`

Do not commit real secrets.

## Local Setup

```bash
pnpm install
pnpm --filter @veriflow/db db:generate
pnpm --filter web dev
```

Run validation:

```bash
pnpm.cmd --filter @veriflow/db typecheck
pnpm.cmd --filter @veriflow/api typecheck
pnpm.cmd --filter @veriflow/ai typecheck
pnpm.cmd --filter web typecheck
pnpm.cmd --filter web build
git diff --check
```

## Five-Minute Demo Script

1. Create or select a project.
2. Connect the GitHub App and pick a repository.
3. Add a project Verification Rule.
4. Create a feature request.
5. Answer requirement clarification questions.
6. Generate the PRD.
7. Generate engineering tasks.
8. Link a real GitHub PR and refresh its snapshot.
9. Run AI QA Review.
10. Show the Requirement Coverage Map, rule results, Developer Fix Pack, readiness score, and merge recommendation.
11. Open Terminal Mode preview.
12. Publish GitHub proof manually and confirm the sticky PR comment/status.
13. Record human approval.
14. Generate and open client/developer/internal reports as appropriate.
15. Show billing credits and admin/manual access safety.

For a tighter judging flow, use `docs/DEMO_READINESS_CHECKLIST.md`.

## Scaling And Reliability Notes

- Workspace isolation is enforced in protected tRPC services.
- GitHub and Razorpay webhooks use idempotency records.
- Billing activation is idempotent through payment-linked credit events.
- List APIs use workspace filters and limits.
- PR proof publishing updates one sticky comment instead of spamming PR threads.
- Large PR diffs are snapshotted with truncation guards.
- Future async processing can move expensive AI/GitHub work into background jobs.

## Rubric Mapping

- Core Workflow Implementation: intake, requirement review, PRD, tasks, PR, QA review, approval, reports, GitHub proof.
- AI Agent Quality: requirement agent, PRD agent, task agent, repo analysis, QA review, Verification Rules, coverage map, fix pack, release readiness.
- GitHub Integration: GitHub App, repo connect, PR tracking, snapshots, proof comment, commit status.
- Review Loop & Human Approval: blocking/non-blocking findings, verification rule failures, re-review flow, approval decisions, client/developer/internal release reports.
- tRPC Monorepo & Engineering Quality: typed routers/services, Drizzle schema/migrations, package boundaries, workspace isolation, idempotent billing/proof behavior.
- SaaS Product Experience: auth, dashboard, projects, billing, legal pages, Terminal Mode preview, report sharing, report safety, onboarding/workflow guidance.
