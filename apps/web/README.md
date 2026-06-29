This is the MergeMint Next.js web app.

## Getting Started

Run the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy on Vercel

Deploy the web app on Vercel and set the server/client environment variables
from the workspace `.env.example`.

For the production MergeMint domain, set these without a trailing slash:

```text
BETTER_AUTH_URL=https://mergemint-eight.vercel.app
NEXT_PUBLIC_APP_URL=https://mergemint-eight.vercel.app
```

Run the pricing checkout flow on the same production domain configured in
Better Auth. Testing OAuth on a Vercel preview URL while `BETTER_AUTH_URL`
points at production can make the post-login session appear missing.

## GitHub Webhook Setup

MergeMint accepts GitHub webhook events at:

```text
https://your-domain.com/api/webhooks/github
```

Production webhook URL:

```text
https://mergemint-eight.vercel.app/api/webhooks/github
```

Configure the webhook in GitHub with:

- Content type: `application/json`
- Secret: the same value as `GITHUB_WEBHOOK_SECRET`
- Events: `Ping`, `Pull requests`, `Installation`, and `Installation repositories`

Handled pull request actions:

- `opened`
- `reopened`
- `synchronize`
- `ready_for_review`
- `closed`

`GITHUB_WEBHOOK_SECRET` is server-only and must not be exposed with a
`NEXT_PUBLIC_` prefix. It is optional for local boot, but the webhook endpoint
rejects signed delivery attempts until the secret is configured.

PR metadata, files, commits, and status checks are fetched through the existing
GitHub snapshot service. In production SaaS, install the GitHub App on selected
repositories and connect a repository to each project. `GITHUB_TOKEN` remains a
fallback for local development only.

To test:

1. Set `GITHUB_WEBHOOK_SECRET` in the app environment and deploy.
2. Add the webhook URL in GitHub and click **Send ping**.
3. Link a PR to a MergeMint feature request.
4. Push a new commit to that linked PR. GitHub sends a `pull_request`
   `synchronize` event, MergeMint refreshes the PR snapshot, and the feature
   shows `Re-review required` without automatically running AI QA.

## GitHub App Setup

Create a GitHub App for MergeMint with:

- Homepage URL: `https://your-domain.com`
- Setup URL: `https://mergemint-eight.vercel.app/api/github/installations/callback`
- Webhook URL: `https://mergemint-eight.vercel.app/api/webhooks/github`
- Webhook secret: same value as `GITHUB_WEBHOOK_SECRET`

The Setup URL is where GitHub redirects users after app installation:

```text
https://mergemint-eight.vercel.app/api/github/installations/callback
```

This is different from the webhook URL, which receives signed GitHub events:

```text
https://mergemint-eight.vercel.app/api/webhooks/github
```

Required permissions:

- Metadata: Read
- Contents: Read
- Pull requests: Read
- Checks: Read
- Commit statuses: Read

Subscribe to these events:

- Pull request
- Installation
- Installation repositories

Generate a private key in the GitHub App settings and store it base64 encoded:

```bash
base64 -w 0 mergemint.private-key.pem
```

On macOS, use:

```bash
base64 -i mergemint.private-key.pem
```

Required server environment variables:

```text
GITHUB_APP_ID=""
GITHUB_APP_SLUG=""
GITHUB_APP_PRIVATE_KEY_BASE64=""
GITHUB_WEBHOOK_SECRET=""
```

Optional OAuth fields, only if you later add GitHub App OAuth flows:

```text
GITHUB_APP_CLIENT_ID=""
GITHUB_APP_CLIENT_SECRET=""
```

Repository connection flow:

1. Open **Settings > GitHub** in MergeMint.
2. Click **Install GitHub App** and choose selected repositories in GitHub.
3. After callback, click **Sync repositories** on the GitHub settings page.
4. Create a project from a synced GitHub repository, or create a project
   manually and connect a repository later.
5. On feature detail, select a PR from the connected project repository.
   MergeMint uses the installation access token first and falls back to
   `GITHUB_TOKEN` only when the GitHub App is not configured.

## Project Creation and PR Selection

Projects can start in two ways:

- **Create from GitHub repo**: select a synced repository, add a project name,
  brief, and optional client ledger. The repository is connected immediately.
- **Create manually**: add project details first, then connect a repository from
  the project setup panel later.

After a GitHub-backed project is created, the normal next actions are analyze
repository, create a feature request, or verify an existing PR. Features remain
scoped to their selected project and must not appear under unrelated projects.

The PR Evidence tab uses a GitHub PR picker for the project-connected
repository. Manual PR URL paste remains available only under
**Advanced: paste PR URL manually** for fallback cases where the PR is outside
the connected repository or GitHub App access is unavailable.

## Guided Release Workflow

MergeMint guides setup and delivery at three levels:

1. **Dashboard** shows the next best workspace action: connect GitHub, sync
   repositories, create a project, connect a project repository, link a PR, run
   QA, approve, or share a report.
2. **Settings > GitHub** is the workspace-level GitHub App control surface for
   installation status, selected repository sync, and repository visibility.
3. **Projects** maps a synced GitHub repository to a project before feature
   work begins.
4. **Feature detail** shows the release stepper for the selected feature:
   request, PRD and tasks, pull request, QA review, approval, and report.

Feature workflow states are derived from existing records and persisted board
stage fields. Current release board stages are:

- `pending`: no PRD yet, clarification needed, or waiting to start.
- `ongoing`: PRD/tasks ready, in development, awaiting PR, or PR linked.
- `completing`: QA pending, QA needs changes, approval pending, or report work.
- `shipped`: approved and reported releases.

Open **Release Board** at `/app/board` to filter by project or client and move
features between safe stages. Marking a feature shipped warns if approval/report
evidence is missing.

Projects can be marked completed and reopened. Completion is non-destructive:
reports and features remain accessible, while completed projects are omitted
from active dashboard attention by default. If unresolved release items remain,
MergeMint asks for confirmation before completing the project.

## Repo Intelligence

Repo Intelligence builds a reusable, safe codebase snapshot for a connected
GitHub repository. After GitHub is connected and a synced repository is mapped to
a project, open **Projects** and click **Analyze repository**.

The analyzer uses the GitHub App installation token when available and falls
back to `GITHUB_TOKEN` only when no installation token is available. It indexes
safe repository metadata and selected architecture files, skips secret-looking
paths such as `.env` and private keys, avoids binary/generated assets, applies
file and prompt-size limits, and stores compact summaries instead of exposing raw
file contents publicly.

Repo Intelligence improves:

- clarification questions, by asking about repo-specific architecture and risk
  areas when useful;
- PRD generation, by referencing relevant modules, routes, APIs, auth, database,
  and deployment constraints;
- engineering tasks, by suggesting likely modules/files in task descriptions and
  checklists;
- AI QA review, by comparing the requirement, PRD, tasks, PR diff, and safe repo
  context together.

Demo flow:

1. Connect GitHub.
2. Sync selected repositories.
3. Select a repository for a project.
4. Analyze repository.
5. Create feature.
6. Generate PRD and engineering tasks.
7. Link PR and run QA.
8. Approve and generate report.

## Engineering Tasks Command Center

Feature detail includes an **Engineering Tasks** tab between Requirements and PR
Evidence. It turns generated tasks into a build-plan command center with:

- task totals, done count, blocked count, high-risk count, and repo-aware status;
- status groups for to do, in progress, blocked, done, and skipped;
- task cards with type, priority, risk level, requirement IDs, suggested
  files/modules, implementation notes, verification notes, and acceptance
  checklists;
- actions to regenerate tasks, copy a developer brief, or copy a structured
  payload for an AI coding agent.

Task generation uses the latest PRD, requirements, acceptance criteria, and safe
Repo Intelligence summary when available. QA review also receives the task plan
and returns compact task coverage evidence. Reports summarize engineering scope
without exposing prompts, tokens, raw repo files, or internal errors.

## Billing and Razorpay Checkout

MergeMint bills by verified PR reviews, not developer seats. A verified PR
review is counted only when AI QA Review successfully runs against a linked
GitHub PR, PRD, REQ IDs, acceptance criteria, engineering tasks, and repository
context.

Required billing environment variables:

```text
RAZORPAY_KEY_ID=""
RAZORPAY_KEY_SECRET=""
RAZORPAY_WEBHOOK_SECRET=""
NEXT_PUBLIC_RAZORPAY_KEY_ID=""
ADMIN_EMAILS="founder@example.com"
```

`RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` are server-only. Never expose
them in frontend code. `ADMIN_EMAILS` is a comma-separated allowlist of signed-in
user emails that can use `/app/admin/access` to manually grant pilot credits.

Razorpay webhook URL:

```text
https://your-domain.com/api/webhooks/razorpay
```

Configure the webhook secret in Razorpay and subscribe to payment/order events
such as `payment.captured` and `order.paid`. The webhook verifies the
`x-razorpay-signature`, stores only a safe event summary, marks matching
payments paid idempotently, and activates the workspace entitlement.

Manual billing tests:

1. Set `ADMIN_EMAILS` to your signed-in email.
2. Open `/app/admin/access`.
3. Search for a customer email.
4. Select the customer and grant `Launch Pack`, `Pilot`, or a demo/manual credit
   amount.
5. Open `/app/billing` as the customer and confirm entitlement and credit event
   history.

Free-credit and exhausted-credit tests:

1. Create or sign into a fresh workspace.
2. Open `/app/billing`; a free entitlement with 1 PR review credit should be
   initialized.
3. Complete a feature through PRD, tasks, PR link, and PR snapshot.
4. Run AI QA Review once. The credit should be consumed only after success.
5. Try a new feature + PR after the free credit is exhausted. Only AI QA Review
   should be blocked with an upgrade message; project, repo, PRD, task, PR link,
   approval, and report surfaces should remain accessible where otherwise valid.
