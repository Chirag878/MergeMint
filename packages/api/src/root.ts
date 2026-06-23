import { router } from "./trpc";
import { featureRequestsRouter } from "./routers/feature-requests.router";
import { healthRouter } from "./routers/health.router";
import { projectsRouter } from "./routers/projects.router";
import { requirementEngineRouter } from "./routers/requirement-engine.router";
import { workspaceRouter } from "./routers/workspace.router";

export const appRouter = router({
  health: healthRouter,
  workspace: workspaceRouter,
  projects: projectsRouter,
  featureRequests: featureRequestsRouter,
  requirementEngine: requirementEngineRouter
});

export type AppRouter = typeof appRouter;
