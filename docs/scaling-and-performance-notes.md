# Scaling and Performance Notes

This pass prepares MergeMint's release workflow architecture for scale. It does
not claim that the app has been load-tested for 10 lakh users.

## Optimized In This Pass

- Requirement Review answer saving now uses one bulk mutation instead of one
  mutation per answer from the client.
- Requirement Review, Guided Workflow, and Release Control Room share a clearer
  completion model based on clarification AI runs and required unanswered
  questions.
- Release Control Room no longer treats rejected approvals as completed
  approvals.
- GitHub Proof access from the top of Feature Detail uses a compact jump card
  and does not fetch full proof details until the QA/proof panel is opened.
- Engineering task generation navigates to the Engineering Tasks tab after
  success and shows a view action when tasks already exist.

## Existing Pagination and Limits

- Project, feature, billing, and PR picker routes use workspace-scoped filters
  and bounded limits where implemented.
- PR picker fetches recent PR metadata only when the PR step is active.
- Full PR diff snapshots are stored server-side and are not loaded by top-level
  feature lists.

## Indexing Approach

Existing schema has indexes for common workspace-scoped lookup paths such as:

- organization/workspace ids
- project ids
- feature request ids
- pull request ids
- repository ids
- GitHub installation ids
- created/updated timestamps used for ordering

Future schema changes should continue adding targeted indexes only for observed
query patterns.

## GitHub API Call Reduction

- PR list fetching is lazy and bounded.
- Full PR snapshot fetching remains tied to explicit link/refresh/QA flows.
- GitHub Proof publishing reuses stored linked PR and repository metadata, then
  uses the GitHub App installation token for the selected repository.

## Idempotency Notes

- Razorpay activation remains idempotent through billing payment credit events.
- GitHub proof publication remains sticky per feature/PR and updates the same
  MergeMint comment when possible.
- Engineering task generation returns existing tasks if they already exist.

## Recommended Future Work

- Add cursor pagination to every large history/report/activity view.
- Add request timing metrics to server logs or an APM tool.
- Move expensive AI/GitHub workflows to background jobs with retries.
- Add database query analysis under production-like data volume.
- Add load tests before making any 10 lakh user capacity claim.
