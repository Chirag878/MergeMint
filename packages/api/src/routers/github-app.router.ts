import { z } from "zod";
import {
  connectGitHubRepositoryToProject,
  disconnectGitHubRepositoryFromProject,
  getGitHubAppInstallLink,
  getGitHubAppInstallations,
  getProjectGitHubIntegration,
  listGitHubAppInstallationRepositories,
  syncGitHubAppInstallationRepositories
} from "../services/github-app.service";
import { protectedProcedure, router } from "../trpc";

export const githubAppRouter = router({
  getInstallLink: protectedProcedure.query(({ ctx }) =>
    getGitHubAppInstallLink(ctx)
  ),

  getInstallations: protectedProcedure.query(({ ctx }) =>
    getGitHubAppInstallations(ctx)
  ),

  syncInstallationRepositories: protectedProcedure
    .input(
      z.object({
        installationId: z.number().int().positive()
      })
    )
    .mutation(({ ctx, input }) =>
      syncGitHubAppInstallationRepositories(ctx, input)
    ),

  listInstallationRepositories: protectedProcedure
    .input(
      z.object({
        installationId: z.number().int().positive()
      })
    )
    .query(({ ctx, input }) =>
      listGitHubAppInstallationRepositories(ctx, input)
    ),

  getProjectIntegration: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid()
      })
    )
    .query(({ ctx, input }) => getProjectGitHubIntegration(ctx, input)),

  connectRepositoryToProject: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        repositoryId: z.string().uuid()
      })
    )
    .mutation(({ ctx, input }) =>
      connectGitHubRepositoryToProject(ctx, input)
    ),

  disconnectRepositoryFromProject: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid()
      })
    )
    .mutation(({ ctx, input }) =>
      disconnectGitHubRepositoryFromProject(ctx, input)
    )
});
