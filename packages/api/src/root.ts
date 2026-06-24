import { router } from "./trpc";
import { approvalRouter } from "./routers/approval.router";
import { clientRouter } from "./routers/client.router";
import { dashboardRouter } from "./routers/dashboard.router";
import { featureRequestsRouter } from "./routers/feature-requests.router";
import { githubRouter } from "./routers/github.router";
import { healthRouter } from "./routers/health.router";
import { projectsRouter } from "./routers/projects.router";
import { qaReviewRouter } from "./routers/qa-review.router";
import { releaseReportRouter } from "./routers/release-report.router";
import { requirementEngineRouter } from "./routers/requirement-engine.router";
import { workspaceRouter } from "./routers/workspace.router";

export const appRouter = router({
  health: healthRouter,
  approval: approvalRouter,
  clients: clientRouter,
  dashboard: dashboardRouter,
  workspace: workspaceRouter,
  projects: projectsRouter,
  featureRequests: featureRequestsRouter,
  github: githubRouter,
  qaReview: qaReviewRouter,
  releaseReport: releaseReportRouter,
  requirementEngine: requirementEngineRouter
});

export type AppRouter = typeof appRouter;
