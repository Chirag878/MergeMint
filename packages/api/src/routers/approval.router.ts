import { z } from "zod";
import {
  createApprovalDecision,
  getApprovalDecisionById,
  getLatestApprovalDecision
} from "../services/approval.service";
import { protectedProcedure, router } from "../trpc";

const approvalDecisionSchema = z.enum([
  "approved",
  "approved_with_risk",
  "changes_requested",
  "rejected"
]);

export const approvalRouter = router({
  createDecision: protectedProcedure
    .input(
      z.object({
        featureRequestId: z.string().uuid(),
        decision: approvalDecisionSchema,
        note: z.string().max(4_000).optional(),
        remainingRisks: z.array(z.string().min(1).max(500)).max(50).optional()
      })
    )
    .mutation(({ ctx, input }) => createApprovalDecision(ctx, input)),

  getLatest: protectedProcedure
    .input(
      z.object({
        featureRequestId: z.string().uuid()
      })
    )
    .query(({ ctx, input }) =>
      getLatestApprovalDecision(ctx, input.featureRequestId)
    ),

  getById: protectedProcedure
    .input(
      z.object({
        approvalId: z.string().uuid()
      })
    )
    .query(({ ctx, input }) => getApprovalDecisionById(ctx, input.approvalId))
});
