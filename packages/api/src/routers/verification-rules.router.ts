import { z } from "zod";
import {
  createVerificationRule,
  deleteVerificationRule,
  listVerificationRules,
  toggleVerificationRule,
  updateVerificationRule
} from "../services/verification-rules.service";
import { protectedProcedure, router } from "../trpc";

const severity = z.enum(["blocking", "warning", "info"]);
const appliesTo = z.enum([
  "all",
  "frontend",
  "backend",
  "db",
  "auth",
  "billing",
  "api",
  "docs",
  "github",
  "ai"
]);

const ruleInput = z.object({
  title: z.string().min(3).max(160),
  description: z.string().min(8).max(2_000),
  severity,
  appliesTo,
  enabled: z.boolean().optional()
});

export const verificationRulesRouter = router({
  listVerificationRules: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(({ ctx, input }) => listVerificationRules(ctx, input.projectId)),

  createVerificationRule: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        rule: ruleInput
      })
    )
    .mutation(({ ctx, input }) =>
      createVerificationRule(ctx, input.projectId, input.rule)
    ),

  updateVerificationRule: protectedProcedure
    .input(
      z.object({
        ruleId: z.string().uuid(),
        rule: ruleInput.partial()
      })
    )
    .mutation(({ ctx, input }) =>
      updateVerificationRule(ctx, input.ruleId, input.rule)
    ),

  deleteVerificationRule: protectedProcedure
    .input(z.object({ ruleId: z.string().uuid() }))
    .mutation(({ ctx, input }) => deleteVerificationRule(ctx, input.ruleId)),

  toggleVerificationRule: protectedProcedure
    .input(z.object({ ruleId: z.string().uuid() }))
    .mutation(({ ctx, input }) => toggleVerificationRule(ctx, input.ruleId))
});

