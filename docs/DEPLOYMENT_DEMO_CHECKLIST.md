# Veriflow Deployment and Demo Checklist

Use this checklist before deploying Veriflow to Vercel or running a founding-pilot sales demo.

## 1. Local Preflight

Run from the monorepo root:

```powershell
pnpm.cmd --filter @veriflow/db typecheck
pnpm.cmd --filter @veriflow/ai typecheck
pnpm.cmd --filter @veriflow/api typecheck
pnpm.cmd --filter web typecheck
pnpm.cmd --filter web build
git status
```

Expected production routes:

- `/` landing page
- `/pricing` founding pilot offer
- `/login` auth entry
- `/app` post-login dashboard
- `/app/clients`
- `/app/projects`
- `/app/features`
- `/app/features/[featureRequestId]`
- `/reports/[shareToken]` public release report

Private app pages call the web session guard and should redirect unauthenticated users to `/login`. Public release reports are intentionally share-token based and should remain accessible without login.

## 2. Database Migration Commands

Current migrations include:

- `0002_free_reptil.sql`: client ledger/client-project relationship work
- `0003_workspace_persona.sql`: workspace use-case/persona and owner foundation
- `meta/_journal.json`: journal entries through migration index `3`

Commands:

```powershell
pnpm.cmd --filter @veriflow/db db:generate
pnpm.cmd --filter @veriflow/db db:push
pnpm.cmd --filter @veriflow/db db:studio
```

Deployment steps for Neon/PostgreSQL:

1. Inspect generated SQL before applying it.
2. Confirm `DATABASE_URL` points to the intended production Neon branch.
3. Run `db:push` only after reviewing the diff.
4. Avoid destructive pushes during demo prep. If Drizzle reports drops or data loss, stop and inspect first.
5. Use `db:studio` for a quick sanity check of organizations, projects, clients, feature requests, QA reviews, approvals, and release reports.

## 3. Vercel Setup

Recommended Vercel project settings:

- Monorepo root: repository root
- App root directory: `apps/web`
- Framework preset: Next.js
- Install command: `pnpm install --frozen-lockfile`
- Build command: `pnpm build`
- Output behavior: Vercel-managed Next.js output, `.next`
- Node version: use Vercel default compatible with Next.js 16, or pin a current Node LTS if needed

If Vercel is configured from the repository root instead of `apps/web`, use:

```text
Build Command: pnpm --filter web build
```

Prefer the `apps/web` root-directory setup because it lets Vercel detect the Next.js app and output behavior cleanly.

## 4. Environment Variables

Required for a real production demo:

- `DATABASE_URL`: production Neon/PostgreSQL URL
- `BETTER_AUTH_SECRET`: at least 32 characters
- `BETTER_AUTH_URL`: production domain, for example `https://your-domain.vercel.app`
- `GITHUB_CLIENT_ID`: production OAuth app client ID
- `GITHUB_CLIENT_SECRET`: production OAuth app client secret
- `GOOGLE_CLIENT_ID`: production OAuth app client ID
- `GOOGLE_CLIENT_SECRET`: production OAuth app client secret
- `NEXT_PUBLIC_APP_URL`: production domain, same origin as the app
- `OPENAI_API_KEY`: real OpenAI key for non-mock AI
- `OPENAI_MODEL`: selected model, currently defaults to `gpt-4.1-mini`
- `AI_MOCK_MODE`: set to `false` for real demo and sales usage
- `GITHUB_TOKEN`: GitHub token for private PR access and higher rate limits

Optional:

- `NEXT_PUBLIC_PAYMENT_LINK`: payment or checkout link for the pilot CTA
- `NEXT_PUBLIC_SAMPLE_REPORT_URL`: public sample release report URL for landing-page CTA

Rules:

- Do not expose server secrets through `NEXT_PUBLIC_` variables.
- Do not log secrets.
- `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL` must match the production domain.
- OAuth callback URLs must use the production domain.
- `AI_MOCK_MODE=false` requires a valid `OPENAI_API_KEY`.

## 5. OAuth Callback Setup

Configure callbacks in the GitHub and Google OAuth provider dashboards for the production domain.

Use the BetterAuth route mounted by the Next app:

```text
https://your-domain.example/api/auth/callback/github
https://your-domain.example/api/auth/callback/google
```

Also keep local callbacks for development:

```text
http://localhost:3000/api/auth/callback/github
http://localhost:3000/api/auth/callback/google
```

## 6. Demo Data Setup

Recommended demo persona:

- Agency for client-ledger demos
- Product Team for internal release-control demos

Recommended demo entities:

- Client: `Acme Automation Studio`
- Project: `Client Delivery Portal`
- Feature: `Build a shareable release verification report page that summarizes PR requirement coverage, AI QA findings, approval decision, and remaining release risks.`
- Matching PR: `Add release verification report generation`

Avoid mismatched demos where the feature request and PR are unrelated. The strongest demo shows the same report-generation feature across request, PRD, PR, QA review, approval, and public report.

## 7. Golden Path Test

1. Log in.
2. Choose workspace persona.
3. Create a client or project.
4. Add a feature request with title, description, business goal, expected behavior, acceptance criteria, and priority.
5. Generate clarification questions.
6. Answer required clarification questions.
7. Generate PRD.
8. Generate engineering tasks.
9. Link the matching GitHub PR.
10. Refresh PR snapshot.
11. Run AI QA review.
12. Submit approval decision.
13. Generate release report.
14. Open public report.
15. Return to Release Control Room and confirm status, next action, guided feature stepper, and Trust Timeline.
16. Return to Dashboard and confirm the next best action card points to the next incomplete release step.
17. Return to Client Delivery Ledger and confirm ledger, risks, approval, and report archive.

## 8. Sample Report Setup

After generating a clean demo report:

1. Open `/reports/[shareToken]`.
2. Confirm the page works in an unauthenticated/private browser session.
3. Confirm the title, final decision, AI verdict, coverage evidence, findings, approval note, and remaining risks are client-readable.
4. Confirm no raw prompts, organization IDs, BetterAuth IDs, private audit logs, or secret-like values appear.
5. Use the browser print dialog to verify print/save as PDF.
6. Copy the public URL into `NEXT_PUBLIC_SAMPLE_REPORT_URL`.
7. Redeploy so the landing page shows `Sample report` and `View sample report` links.

## 9. Known Limitations

- GitHub App installation flow is available at `https://mergemint-eight.vercel.app/api/github/installations/callback`; production testing requires GitHub App env vars and setup URL configuration.
- GitHub webhooks are available at `https://mergemint-eight.vercel.app/api/webhooks/github`; production testing requires `GITHUB_WEBHOOK_SECRET`.
- Guided release workflow state is derived from existing GitHub App, project repository, feature, PR, QA, approval, and report records.
- No team invites or full role-management UI yet.
- No client portal permissions yet.
- No billing system beyond external/payment-link CTA.
- Veriflow does not merge PRs. GitHub remains the source of truth for merging.
- PR refresh is manual for now.

## 10. Go/No-Go Before Outreach

Go only if:

- Production build passes.
- Production database has migrations applied.
- OAuth login works on the production domain.
- `AI_MOCK_MODE=false` and OpenAI calls succeed.
- GitHub PR linking works for the demo PR.
- Public report URL opens without login.
- Landing CTA links go to payment link or login intentionally.
- Sample report URL is configured or the landing page gracefully falls back to `See how it works`.
- No secrets or internal IDs appear in public reports.
- Demo data is coherent from feature request through PR and report.
