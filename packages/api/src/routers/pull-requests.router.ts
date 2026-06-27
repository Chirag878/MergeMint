import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { listPullRequestsForRepository } from "@veriflow/github";
import {
  db,
  featureRequests,
  projectGithubRepositories,
  projects,
  repositories
} from "@veriflow/db";
import { assertRoleCan } from "../authz";
import { linkSelectedPullRequestToFeatureRequest } from "../services/github-pr-linking.service";
import { ensureUserWorkspace } from "../services/workspace-bootstrap.service";
import { protectedProcedure, router } from "../trpc";

function toBootstrapInput(ctx: {
  user: {
    id: string;
    email: string;
    name?: string | null;
    image?: string | null;
  };
  session: {
    id: string;
  };
}) {
  return {
    user: ctx.user,
    session: ctx.session
  };
}

async function getProjectRepositoryOrThrow(input: {
  organizationId: string;
  projectId: string;
}) {
  const [row] = await db
    .select({
      project: projects,
      repository: repositories
    })
    .from(projects)
    .innerJoin(
      projectGithubRepositories,
      eq(projectGithubRepositories.projectId, projects.id)
    )
    .innerJoin(
      repositories,
      eq(projectGithubRepositories.repositoryId, repositories.id)
    )
    .where(
      and(
        eq(projects.id, input.projectId),
        eq(projects.organizationId, input.organizationId),
        eq(projectGithubRepositories.organizationId, input.organizationId),
        eq(repositories.organizationId, input.organizationId)
      )
    )
    .limit(1);

  if (!row) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Connect a GitHub repository to this project before selecting PRs."
    });
  }

  return row;
}

export const pullRequestsRouter = router({
  listForProjectRepository: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        state: z.enum(["open", "closed", "all"]).optional(),
        search: z.string().max(120).optional(),
        limit: z.number().int().min(1).max(100).optional()
      })
    )
    .query(async ({ ctx, input }) => {
      const workspace = await ensureUserWorkspace(toBootstrapInput(ctx));
      assertRoleCan(workspace.membership.role, "project:read");

      const { repository } = await getProjectRepositoryOrThrow({
        organizationId: workspace.activeOrganization.id,
        projectId: input.projectId
      });
      const pullRequests = await listPullRequestsForRepository({
        owner: repository.owner,
        repo: repository.name,
        installationId: repository.githubAppInstallationId,
        state: input.state ?? "open",
        limit: input.limit ?? 30
      });
      const search = input.search?.trim().toLowerCase();

      return {
        repository: {
          id: repository.id,
          fullName: repository.fullName,
          owner: repository.owner,
          name: repository.name,
          defaultBranch: repository.defaultBranch
        },
        pullRequests: search
          ? pullRequests.filter((pullRequest) =>
              [
                String(pullRequest.number),
                pullRequest.title,
                pullRequest.authorLogin ?? "",
                pullRequest.headBranch,
                pullRequest.baseBranch
              ]
                .join(" ")
                .toLowerCase()
                .includes(search)
            )
          : pullRequests
      };
    }),

  linkSelectedPullRequest: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        featureRequestId: z.string().uuid(),
        prNumber: z.number().int().positive()
      })
    )
    .mutation(async ({ ctx, input }) => {
      const workspace = await ensureUserWorkspace(toBootstrapInput(ctx));
      assertRoleCan(workspace.membership.role, "create_feature_request");

      const [feature] = await db
        .select()
        .from(featureRequests)
        .where(
          and(
            eq(featureRequests.id, input.featureRequestId),
            eq(featureRequests.projectId, input.projectId),
            eq(featureRequests.organizationId, workspace.activeOrganization.id)
          )
        )
        .limit(1);

      if (!feature) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Feature request not found for this project."
        });
      }

      return linkSelectedPullRequestToFeatureRequest(ctx, input);
    })
});
