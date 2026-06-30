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

Key implemented surfaces include projects, feature requests, requirement clarification, PRD generation, engineering tasks, GitHub repo/PR linking, PR snapshots, AI QA review, human approval, release board, release reports, public report sharing, billing, admin manual access, and the GitHub Proof Gate.

## AI Features

- Requirement clarification
- PRD generation
- Engineering task generation
- Repository intelligence summaries
- QA review against PRD requirements, tasks, PR files, and diff evidence
- Requirement coverage mapping
- Developer fix pack generation from latest QA evidence
- Release readiness and report shaping

## GitHub Integration

MergeMint uses the GitHub App installation-token path when available. It can connect repositories, link real pull requests, refresh PR snapshots, read changed file metadata, and publish proof back to GitHub.

The GitHub Proof Gate publishes one sticky `MergeMint Verification` PR comment per feature/PR and creates a commit status named `MergeMint Verification`. Publishing proof does not rerun AI and does not consume PR review credits.

## Billing

Billing is workspace-based. Free workspaces receive 1 verified PR review credit. Paid checkout happens only inside protected `/app/billing`; public pricing and landing pages link to `/app/billing?checkoutPlan=<planKey>` and must not open Razorpay or create payment rows.

Only successful AI QA Review creation consumes credits. Failed AI calls, report sharing, GitHub proof publishing, team invites, onboarding previews, CLI preview, and admin actions do not consume PR review credits.

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
3. Create a feature request.
4. Answer requirement clarification questions.
5. Generate the PRD.
6. Generate engineering tasks.
7. Link a real GitHub PR and refresh its snapshot.
8. Run AI QA Review.
9. Show the Requirement Coverage Map, Developer Fix Pack, readiness score, and merge recommendation.
10. Publish GitHub proof and confirm the sticky PR comment/status.
11. Record human approval.
12. Generate and open the release report.
13. Show billing credits and admin/manual access safety.

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
- AI Agent Quality: requirement agent, PRD agent, task agent, repo analysis, QA review, coverage map, fix pack, release readiness.
- GitHub Integration: GitHub App, repo connect, PR tracking, snapshots, proof comment, commit status.
- Review Loop & Human Approval: blocking/non-blocking findings, re-review flow, approval decisions, release reports.
- tRPC Monorepo & Engineering Quality: typed routers/services, Drizzle schema/migrations, package boundaries, workspace isolation, idempotent billing/proof behavior.
- SaaS Product Experience: auth, dashboard, projects, billing, legal pages, CLI preview, report sharing, onboarding/workflow guidance.
