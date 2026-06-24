import { getDashboardSummary } from "../services/dashboard.service";
import { protectedProcedure, router } from "../trpc";

export const dashboardRouter = router({
  getSummary: protectedProcedure.query(({ ctx }) => getDashboardSummary(ctx))
});
