import { z } from "zod";
import {
  getPullRequestForFeatureRequest,
  linkPullRequestToFeatureRequest,
  refreshPullRequestSnapshot
} from "../services/github-pr-linking.service";
import { protectedProcedure, router } from "../trpc";

export const githubRouter = router({
  linkPullRequest: protectedProcedure
    .input(
      z.object({
        featureRequestId: z.string().uuid(),
        prUrl: z.string().url()
      })
    )
    .mutation(({ ctx, input }) => linkPullRequestToFeatureRequest(ctx, input)),

  getFeaturePullRequest: protectedProcedure
    .input(
      z.object({
        featureRequestId: z.string().uuid()
      })
    )
    .query(({ ctx, input }) =>
      getPullRequestForFeatureRequest(ctx, input.featureRequestId)
    ),

  refreshSnapshot: protectedProcedure
    .input(
      z.object({
        pullRequestId: z.string().uuid()
      })
    )
    .mutation(({ ctx, input }) =>
      refreshPullRequestSnapshot(ctx, input.pullRequestId)
    )
});
