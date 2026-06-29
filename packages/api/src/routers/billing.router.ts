import { z } from "zod";
import {
  adminGrantAccess,
  adminLookupCustomer,
  createCheckoutOrder,
  getCreditEvents,
  getCurrentEntitlement,
  getPaymentHistory,
  getPlans,
  verifyCheckoutPayment
} from "../services/billing.service";
import { protectedProcedure, publicProcedure, router } from "../trpc";

export const billingRouter = router({
  getPlans: publicProcedure.query(() => getPlans()),

  getCurrentEntitlement: protectedProcedure.query(({ ctx }) =>
    getCurrentEntitlement(ctx)
  ),

  createCheckoutOrder: protectedProcedure
    .input(
      z.object({
        planKey: z.string().min(1)
      })
    )
    .mutation(({ ctx, input }) => createCheckoutOrder(ctx, input)),

  verifyCheckoutPayment: protectedProcedure
    .input(
      z.object({
        razorpayOrderId: z.string().min(1),
        razorpayPaymentId: z.string().min(1),
        razorpaySignature: z.string().min(1)
      })
    )
    .mutation(({ ctx, input }) => verifyCheckoutPayment(ctx, input)),

  getPaymentHistory: protectedProcedure.query(({ ctx }) =>
    getPaymentHistory(ctx)
  ),

  getCreditEvents: protectedProcedure.query(({ ctx }) => getCreditEvents(ctx)),

  adminLookupCustomer: protectedProcedure
    .input(
      z.object({
        email: z.string().min(1)
      })
    )
    .query(({ ctx, input }) => adminLookupCustomer(ctx, input)),

  adminGrantAccess: protectedProcedure
    .input(
      z.object({
        customerEmail: z.string().email(),
        planKey: z.string().min(1),
        prCreditAmount: z.number().int().min(0),
        validityDays: z.number().int().min(0).max(730),
        note: z.string().max(1000).optional(),
        source: z.enum(["manual", "demo"])
      })
    )
    .mutation(({ ctx, input }) => adminGrantAccess(ctx, input))
});
