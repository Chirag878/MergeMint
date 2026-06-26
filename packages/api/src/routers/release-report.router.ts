import { z } from "zod";
import {
  generateDeveloperFixReport,
  generateInternalReleaseReport,
  generateReleaseReport,
  getLatestReleaseReportForFeature,
  getReleaseReportById,
  getReleaseReportByShareToken
} from "../services/release-report.service";
import { protectedProcedure, publicProcedure, router } from "../trpc";

export const releaseReportRouter = router({
  generate: protectedProcedure
    .input(
      z.object({
        featureRequestId: z.string().uuid()
      })
    )
    .mutation(({ ctx, input }) => generateReleaseReport(ctx, input)),

  generateDeveloperFix: protectedProcedure
    .input(
      z.object({
        featureRequestId: z.string().uuid()
      })
    )
    .mutation(({ ctx, input }) => generateDeveloperFixReport(ctx, input)),

  generateInternalRelease: protectedProcedure
    .input(
      z.object({
        featureRequestId: z.string().uuid()
      })
    )
    .mutation(({ ctx, input }) => generateInternalReleaseReport(ctx, input)),

  getLatestForFeature: protectedProcedure
    .input(
      z.object({
        featureRequestId: z.string().uuid(),
        reportType: z
          .enum(["client_delivery", "developer_fix", "internal_release"])
          .optional()
      })
    )
    .query(({ ctx, input }) =>
      getLatestReleaseReportForFeature(ctx, input.featureRequestId, input.reportType)
    ),

  getById: protectedProcedure
    .input(
      z.object({
        releaseReportId: z.string().uuid()
      })
    )
    .query(({ ctx, input }) => getReleaseReportById(ctx, input.releaseReportId)),

  getByShareToken: publicProcedure
    .input(
      z.object({
        shareToken: z.string().min(16).max(200)
      })
    )
    .query(({ input }) => getReleaseReportByShareToken(input.shareToken))
});
