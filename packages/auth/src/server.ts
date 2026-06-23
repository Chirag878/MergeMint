import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "./auth";

export async function handleAuthRequest(request: Request) {
  return getAuth().handler(request);
}

export type AuthSession = Awaited<ReturnType<typeof getSessionFromHeaders>>;
export type AuthUser = NonNullable<AuthSession>["user"];

export async function getSessionFromHeaders(headers: Headers) {
  return getAuth().api.getSession({
    headers
  });
}

export function isSafeInternalRedirect(path: string | null | undefined) {
  return Boolean(path?.startsWith("/") && !path.startsWith("//"));
}

export function getSafeRedirectPath(
  path: string | null | undefined,
  fallback = "/dashboard"
) {
  return isSafeInternalRedirect(path) ? path : fallback;
}
