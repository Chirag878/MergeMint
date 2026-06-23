import { getSessionFromHeaders } from "@veriflow/auth/server";

export type CreateTRPCContextOptions = {
  req: Request;
};

export async function createTRPCContext(opts: CreateTRPCContextOptions) {
  const authSession = await getSessionFromHeaders(opts.req.headers);

  return {
    req: opts.req,
    requestId: crypto.randomUUID(),
    session: authSession?.session ?? null,
    user: authSession?.user ?? null
  };
}

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;
