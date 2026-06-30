# MergeMint

MergeMint is our implementation of the ShipFlow AI challenge.

AI can help teams write code faster, but speed alone does not prove the shipped pull request actually satisfies the original feature request. MergeMint closes that gap by turning a product request into an auditable delivery chain: requirements, PRD, engineering tasks, GitHub PR evidence, AI QA review, human approval, client report, and GitHub proof.

**GitHub shows what changed. MergeMint shows whether it is actually done.**

Production URL placeholder: `https://mergemint-eight.vercel.app`

## Project Overview

MergeMint is an AI Product Delivery Pipeline SaaS for founders, CTOs, product teams, and engineers who need proof that implementation matches intent.

The core workflow is:

```text
Feature Request -> Requirement Review -> PRD -> Engineering Tasks -> GitHub PR -> AI QA Review -> Developer Fix Pack -> Re-review -> Human Approval -> Client Release Report -> GitHub Proof
```

Instead of treating a merged PR as the finish line, MergeMint checks whether the PR covers the original promise, highlights gaps, guides the fix loop, and produces shareable release evidence.

## Hackathon Scoring Coverage

| Rubric category | Points | MergeMint coverage |
| --- | ---: | --- |
| Core Workflow Implementation | 20 | Implemented the full request-to-proof pipeline: feature intake, Requirement Review, PRD generation, engineering tasks, GitHub PR linking, AI QA Review, fix loop, approval, reports, and GitHub Proof. |
| AI Agent Quality | 20 | Includes requirement clarification, Product Discovery verdicts, PRD generation, task generation, repository intelligence, AI QA review, requirement coverage, verification rules, and Developer Fix Pack generation. |
| GitHub Integration | 15 | Supports GitHub App repository connection, installation-token access, PR linking/tracking, snapshot refresh, webhook handling, PR evidence, sticky proof comments, and commit statuses. |
| Review Loop & Human Approval | 15 | AI QA produces blocking/non-blocking findings, coverage evidence, merge recommendations, fix guidance, re-review support, and human approval/rejection states. |
| tRPC Monorepo & Engineering Quality | 15 | pnpm monorepo with typed tRPC routers, service boundaries, Drizzle schema/migrations, workspace isolation, idempotent webhook/payment/proof paths, and package separation. |
| SaaS Product Experience | 10 | Protected app, onboarding/demo flow, dashboard, projects, release board, billing, settings, reports, share links, legal pages, and premium dark SaaS UI direction. |
| Demo & Documentation | 5 | README, demo checklist, deployment notes, env table, demo script, and honest limitations are documented for judges and future maintainers. |

## Features Implemented

- Feature request intake
- Product Discovery verdict: Proceed to PRD, Needs clarification, Already exists, Duplicate request, Not worth building now, Out of scope
- Requirement clarification and inline Requirement Review
- PRD generation
- Engineering task generation
- Kanban/release board
- GitHub repository connection through GitHub App
- Pull request linking and tracking
- PR snapshot and diff evidence capture
- AI QA review against requirements, PRD, tasks, verification rules, and PR evidence
- Blocking and non-blocking findings
- Requirement coverage map
- Developer Fix Pack
- Re-review loop
- Human approval/rejection flow
- Client, developer, and internal release reports
- Public report sharing through share tokens
- GitHub Proof publishing with sticky PR comment and commit status
- Project-level Verification Rules
- Billing with Razorpay
- AI review credits
- Workspace and multi-tenant structure
- Guided demo/sample project flow
- Inngest async workflow integration

## Tech Stack

| Layer | Technology |
| --- | --- |
| Web app | Next.js, React, TypeScript |
| API | tRPC, TypeScript |
| Database | Drizzle ORM, PostgreSQL/Neon |
| Auth | BetterAuth |
| AI | AI SDK/OpenAI |
| GitHub | GitHub App, Octokit, GitHub Webhooks |
| Billing | Razorpay checkout and webhooks |
| Async workflows | Inngest |
| Deployment | Vercel |
| Monorepo | pnpm workspaces |

## Monorepo Architecture

```text
apps/web          Next.js application, protected app, public pages, API routes, Inngest route
packages/api      tRPC routers, product services, billing, reports, GitHub proof, workflow orchestration
packages/db       Drizzle schema, migrations, database client
packages/ai       AI agents and prompt logic for requirements, PRD, tasks, and QA
packages/github   GitHub App and Octokit integration utilities
packages/env      Environment validation and shared config helpers
packages/shared   Shared plan definitions, types, constants, and cross-package helpers
docs              Demo, deployment, and product readiness documentation
```

## System Architecture

MergeMint is organized around a typed service layer:

1. The Next.js web app renders the landing page, protected app, billing, reports, and workflow UI.
2. The tRPC API exposes typed product operations for projects, features, PRDs, tasks, PRs, QA, reports, proof, billing, and settings.
3. Drizzle maps the workspace, product workflow, GitHub, QA, report, billing, and proof data into PostgreSQL/Neon.
4. AI services generate requirement questions, PRDs, engineering tasks, QA findings, coverage maps, and fix guidance.
5. GitHub App integration connects repositories, reads PR evidence, receives webhooks, and publishes proof.
6. Billing and credit services enforce AI QA Review credits while keeping non-QA workflows open.
7. Inngest functions provide async workflow coverage for long-running jobs.
8. Report sharing creates client-safe release links.
9. GitHub Proof publishing posts one manual sticky verification comment/status per feature/PR.

## AI Agents

| AI capability | What it does |
| --- | --- |
| Requirement clarification agent | Finds missing product context and generates required or optional clarification questions. |
| Product Discovery verdict | Helps decide whether a request should proceed, needs clarification, already exists, is duplicate, is out of scope, or should be deferred. |
| PRD generation agent | Converts the feature request and clarification answers into a structured PRD with requirements and acceptance criteria. |
| Engineering task generation agent | Converts PRD requirements into implementation tasks, suggested files/modules, verification notes, and acceptance checklists. |
| QA review agent | Compares PR evidence against PRD requirements, tasks, verification rules, and repository context. |
| Release readiness/checklist | Summarizes delivery progress, evidence quality, risks, and next best action. |
| Developer Fix Pack generation | Produces remediation guidance when QA finds missing requirements or risky implementation gaps. |

## Inngest Workflows

MergeMint includes real Inngest SDK integration in the web app:

- Client: `apps/web/inngest/client.ts`
- Functions: `apps/web/inngest/functions.ts`
- Handler: `apps/web/app/api/inngest/route.ts`
- Endpoint: `/api/inngest`

Functions:

| Event | Purpose |
| --- | --- |
| `mergemint/prd.generate` | Generate PRD using the existing PRD service. |
| `mergemint/engineering-tasks.generate` | Generate engineering tasks using the existing task service. |
| `mergemint/qa-review.run` | Run AI QA Review using the existing QA service. |
| `mergemint/release-readiness.check` | Run the release readiness/checklist workflow surface. |

Required hosted Inngest environment variables:

- `INNGEST_EVENT_KEY`
- `INNGEST_SIGNING_KEY`

The current product UI still keeps the existing tRPC mutations for demo safety. The Inngest functions wrap the same backend services so async execution can be enabled without rewriting product logic.

## GitHub Integration Setup

MergeMint is designed for the GitHub App flow, not user-provided tokens.

Recommended GitHub App setup:

1. Create a GitHub App for MergeMint.
2. Set homepage/callback URLs to the deployed app, for example `https://mergemint-eight.vercel.app`.
3. Configure the installation callback route in the app.
4. Set webhook URL to:

```text
https://mergemint-eight.vercel.app/api/webhooks/github
```

Required capabilities:

- Repository metadata/read access
- Pull request read access
- Commit status write access
- Issue/PR comment write access
- Webhook events for installation/repository access changes and PR activity

Supported GitHub behavior:

- User installs GitHub App.
- User selects repository access.
- MergeMint stores installation/repository mapping.
- User links or selects a PR.
- MergeMint fetches PR metadata, files, and diff evidence.
- AI QA Review uses the PR snapshot as evidence.
- GitHub Proof publishing remains manual-only.
- Proof publishing updates one sticky `MergeMint Verification` PR comment.
- Proof publishing creates/updates a commit status for the PR head SHA.

`GITHUB_TOKEN` is only a local/dev/admin fallback and is not the normal SaaS path.

## Razorpay Billing Setup

Billing is workspace-based. Public pricing must not open Razorpay directly.

Billing rules:

- Public pricing buttons link only to `/app/billing?checkoutPlan=<planKey>`.
- Checkout is protected and starts only after login.
- Razorpay order creation happens server-side.
- Direct checkout verification validates `razorpay_order_id`, `razorpay_payment_id`, and `razorpay_signature`.
- Webhooks are a fallback activation path.
- AI QA Review credits are activated after successful payment verification.
- Duplicate verification/webhook paths are idempotent.
- If activation verification ever fails after payment success, the UI shows a pending manual verification message and tells the user not to pay again.

Webhook route:

```text
https://mergemint-eight.vercel.app/api/webhooks/razorpay
```

Webhook events:

- `order.paid`
- `payment.captured`

Required billing/admin variables:

- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `NEXT_PUBLIC_RAZORPAY_KEY_ID`
- `RAZORPAY_WEBHOOK_SECRET`
- `ADMIN_EMAILS`

## Environment Variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL/Neon connection string. |
| `BETTER_AUTH_SECRET` | BetterAuth signing secret. |
| `BETTER_AUTH_URL` | Canonical auth URL for the deployed/local app. |
| `NEXT_PUBLIC_APP_URL` | Public app URL used by client-side links and callbacks. |
| `GOOGLE_CLIENT_ID` | Google OAuth client id, if enabled. |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret, if enabled. |
| `GITHUB_CLIENT_ID` | GitHub OAuth client id, if enabled. |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth client secret, if enabled. |
| `OPENAI_API_KEY` | OpenAI API key for AI agents. |
| `OPENAI_MODEL` | Model used by AI services. |
| `AI_MOCK_MODE` | Enables safe mocked AI behavior for local/demo testing when configured. |
| `GITHUB_WEBHOOK_SECRET` | Legacy/general GitHub webhook secret if used. |
| `GITHUB_APP_ID` | GitHub App id. |
| `GITHUB_APP_SLUG` | GitHub App slug for install/update links. |
| `GITHUB_APP_PRIVATE_KEY_BASE64` | Base64 encoded GitHub App private key. |
| `RAZORPAY_KEY_ID` | Server-side Razorpay key id. |
| `RAZORPAY_KEY_SECRET` | Server-side Razorpay key secret. |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Browser-safe Razorpay key id. Must match the same mode as server keys. |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay webhook signing secret. |
| `INNGEST_EVENT_KEY` | Inngest event key for hosted execution. |
| `INNGEST_SIGNING_KEY` | Inngest signing key for the `/api/inngest` endpoint. |
| `ADMIN_EMAILS` | Comma-separated billing/admin allowlist. |

Do not commit real secrets.

## Local Setup

Install dependencies:

```bash
pnpm install
```

Apply database schema:

```bash
pnpm.cmd --filter @veriflow/db db:push
```

Run the web app:

```bash
pnpm.cmd --filter web dev
```

Validation commands:

```bash
pnpm.cmd --filter web typecheck
pnpm.cmd --filter @veriflow/api typecheck
pnpm.cmd --filter @veriflow/db typecheck
pnpm.cmd --filter web build
git diff --check
```

Windows build fallback if memory is tight:

```powershell
$env:NODE_OPTIONS="--max-old-space-size=4096"
pnpm.cmd --filter web build
```

## Deployment Setup

Recommended Vercel setup:

| Setting | Value |
| --- | --- |
| Root Directory | `apps/web` |
| Install Command | `pnpm install` |
| Build Command | `pnpm build` or `pnpm.cmd --filter web build` depending on Vercel workspace setup |
| Output Directory | Next.js default (`.next`) |

Deployment checklist:

1. Add all required environment variables in Vercel.
2. Configure database connection.
3. Configure BetterAuth URLs to match the deployed domain.
4. Configure GitHub App callback/webhook URLs.
5. Configure Razorpay webhook URL and secrets.
6. Configure Inngest keys if hosted async execution is enabled.
7. Redeploy after every environment change.

## Judge Demo Script

1. Open the landing page and state the core line: GitHub shows what changed; MergeMint shows whether it is actually done.
2. Log in.
3. Start the guided demo/sample project or select an existing project.
4. Create a feature request.
5. Open the Release Control Room.
6. Start Requirement Review.
7. Show the Product Discovery verdict.
8. Answer clarification questions.
9. Generate the PRD.
10. Generate engineering tasks.
11. Open the Kanban/release board.
12. Connect or show the GitHub App repository connection.
13. Link/select a GitHub PR.
14. Refresh/show PR evidence.
15. Run AI QA Review.
16. Show blocking/non-blocking findings, requirement coverage, verification rules, readiness score, and merge recommendation.
17. Show the Developer Fix Pack.
18. Explain the re-review loop after fixes.
19. Submit human approval or rejection.
20. Generate a client release report.
21. Manually publish GitHub Proof.
22. Show the sticky PR comment/commit status if using a real connected PR.
23. Show billing/credits and explain that only successful AI QA Review consumes credits.

## Demo Readiness Checklist

Use `docs/DEMO_READINESS_CHECKLIST.md` for the compact runbook:

- Feature request
- Requirement Review
- PRD
- Engineering tasks
- GitHub PR
- AI QA Review
- Developer Fix Pack
- Human approval
- Report
- GitHub Proof

## Known Limitations And Honest Notes

- GitHub Proof is manual-only by design. MergeMint should not auto-post proof without the user choosing to publish it.
- AI review credits are consumed only after a successful AI QA Review.
- Public pricing links to protected billing and does not open Razorpay directly.
- Payment activation has a pending manual verification fallback if verification ever fails after a successful Razorpay payment.
- Some async workflow execution is prepared through real Inngest functions, while the product UI keeps existing tRPC mutations for demo stability.
- Hosted Inngest execution requires production `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY`.
- GitHub Proof requires the GitHub App to be installed with repository access and required PR comment/status permissions.
- Sample/demo data is labeled as sample data and should not be presented as real GitHub proof.

## Why MergeMint Matters

Modern teams can generate code quickly, but delivery still fails when nobody can prove that the final PR matches the original user need. MergeMint gives teams a proof-led release workflow: product intent, engineering execution, QA evidence, human approval, and client-facing proof in one place.

That is the goal of MergeMint: make software delivery faster without losing accountability.
