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
4. Open **Projects**, select a project and repository, then click **Connect repo**.
5. Link PRs from that connected repository. MergeMint uses the installation
   access token first and falls back to `GITHUB_TOKEN` only when the GitHub App
   is not configured.

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

Feature workflow states are derived from existing records rather than stored in
new columns. Current states include `clarification_needed`, `draft_request`,
`prd_ready`, `tasks_ready`, `pr_linked`, `qa_ready`, `qa_needs_changes`,
`approved`, `rejected`, `report_ready`, and `shipped`.

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
