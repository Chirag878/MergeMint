import { router } from "./trpc";
import { approvalRouter } from "./routers/approval.router";
import { asyncWorkflowRouter } from "./routers/async-workflow.router";
import { billingRouter } from "./routers/billing.router";
import { clientRouter } from "./routers/client.router";
import { dashboardRouter } from "./routers/dashboard.router";
import { engineeringTasksRouter } from "./routers/engineering-tasks.router";
import { featureRequestsRouter } from "./routers/feature-requests.router";
import { githubAppRouter } from "./routers/github-app.router";
import { githubRouter } from "./routers/github.router";
import { guidedWorkflowRouter } from "./routers/guided-workflow.router";
import { healthRouter } from "./routers/health.router";
import { projectsRouter } from "./routers/projects.router";
import { proofGateRouter } from "./routers/proof-gate.router";
import { pullRequestsRouter } from "./routers/pull-requests.router";
import { qaReviewRouter } from "./routers/qa-review.router";
import { releaseReportRouter } from "./routers/release-report.router";
import { releaseBoardRouter } from "./routers/release-board.router";
import { repositoryIntelligenceRouter } from "./routers/repository-intelligence.router";
import { requirementEngineRouter } from "./routers/requirement-engine.router";
import { verificationRulesRouter } from "./routers/verification-rules.router";
import { workspaceRouter } from "./routers/workspace.router";

export const appRouter = router({
  health: healthRouter,
  approval: approvalRouter,
  asyncWorkflow: asyncWorkflowRouter,
  billing: billingRouter,
  clients: clientRouter,
  dashboard: dashboardRouter,
  engineeringTasks: engineeringTasksRouter,
  workspace: workspaceRouter,
  projects: projectsRouter,
  pullRequests: pullRequestsRouter,
  featureRequests: featureRequestsRouter,
  githubApp: githubAppRouter,
  github: githubRouter,
  guidedWorkflow: guidedWorkflowRouter,
  repositoryIntelligence: repositoryIntelligenceRouter,
  proofGate: proofGateRouter,
  qaReview: qaReviewRouter,
  releaseBoard: releaseBoardRouter,
  releaseReport: releaseReportRouter,
  requirementEngine: requirementEngineRouter,
  verificationRules: verificationRulesRouter
});

export type AppRouter = typeof appRouter;
