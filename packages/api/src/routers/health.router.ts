import { z } from "zod";
import { APP_NAME } from "@veriflow/shared";
import { publicProcedure, router } from "../trpc";

export const healthRouter = router({
  ping: publicProcedure.query(() => {
    return {
      status: "ok" as const,
      service: APP_NAME,
      timestamp: new Date().toISOString()
    };
  }),

  echo: publicProcedure
    .input(
      z.object({
        text: z.string().min(1).max(500)
      })
    )
    .mutation(({ input }) => {
      return {
        echo: input.text,
        timestamp: new Date().toISOString()
      };
    })
});