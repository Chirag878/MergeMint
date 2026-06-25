import { getAuth } from "./auth";

function getRequestMetadata(request: Request) {
  const url = new URL(request.url);

  return {
    method: request.method,
    path: url.pathname,
    host: request.headers.get("host"),
    hasOrigin: request.headers.has("origin"),
    hasCookie: request.headers.has("cookie")
  };
}

function logAuthFailure(
  event: string,
  error: unknown,
  metadata?: Record<string, string | number | boolean | null | undefined>
) {
  const message = error instanceof Error ? error.message : String(error);

  console.error("[auth]", event, {
    ...metadata,
    message
  });
}

export async function handleAuthRequest(request: Request) {
  try {
    return await getAuth().handler(request);
  } catch (error) {
    logAuthFailure("handler_failed", error, getRequestMetadata(request));
    throw error;
  }
}

export type AuthSession = Awaited<ReturnType<typeof getSessionFromHeaders>>;
export type AuthUser = NonNullable<AuthSession>["user"];

export async function getSessionFromHeaders(headers: Headers) {
  try {
    return await getAuth().api.getSession({
      headers
    });
  } catch (error) {
    logAuthFailure("session_read_failed", error, {
      host: headers.get("host"),
      hasCookie: headers.has("cookie")
    });
    throw error;
  }
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
