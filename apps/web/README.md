This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## GitHub Webhook Setup

MergeMint accepts GitHub webhook events at:

```text
https://your-domain.com/api/webhooks/github
```

Configure the webhook in GitHub with:

- Content type: `application/json`
- Secret: the same value as `GITHUB_WEBHOOK_SECRET`
- Events: `Ping` and `Pull requests`

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
GitHub snapshot service. Set `GITHUB_TOKEN` for private repositories or higher
rate limits. The token needs read access to repository pull requests, contents,
commits, and commit statuses for the repositories you link.

To test:

1. Set `GITHUB_WEBHOOK_SECRET` in the app environment and deploy.
2. Add the webhook URL in GitHub and click **Send ping**. The endpoint should
   return `{ "ok": true }`.
3. Link a PR to a MergeMint feature request.
4. Push a new commit to that linked PR. GitHub sends a `pull_request`
   `synchronize` event, MergeMint refreshes the PR snapshot, and the feature
   shows “Re-review required” without automatically running AI QA.
