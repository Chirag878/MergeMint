import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TRPCContext } from "./context";

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof Error && error.name === "ZodError"
            ? error.message
            : null
      }
    };
  }
});

const timingMiddleware = t.middleware(async ({ next, path }) => {
  const start = Date.now();

  const result = await next();

  const durationMs = Date.now() - start;

  if (process.env.NODE_ENV === "development" && durationMs > 700) {
    console.warn(`[tRPC slow] ${path} completed in ${durationMs}ms`);
  }

  return result;
});

export const router = t.router;
export const publicProcedure = t.procedure.use(timingMiddleware);

const authMiddleware = t.middleware(async ({ ctx, next }) => {
  if (!ctx.session || !ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in to perform this action."
    });
  }

  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
      user: ctx.user
    }
  });
});

export const protectedProcedure = t.procedure
  .use(timingMiddleware)
  .use(authMiddleware);
