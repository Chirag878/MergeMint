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
- Setup URL: `https://your-domain.com/api/github/installations/callback`
- Webhook URL: `https://your-domain.com/api/webhooks/github`
- Webhook secret: same value as `GITHUB_WEBHOOK_SECRET`

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

1. Open **Projects** in MergeMint.
2. Click **Install GitHub App** and choose selected repositories in GitHub.
3. After callback, click **Sync repositories** in the GitHub Integration panel.
4. Select a project and repository, then click **Connect repo**.
5. Link PRs from that connected repository. MergeMint uses the installation
   access token first and falls back to `GITHUB_TOKEN` only when the GitHub App
   is not configured.
