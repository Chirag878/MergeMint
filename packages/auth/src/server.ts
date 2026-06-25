import { getAuth } from "./auth";

const productionAppOrigin = "https://mergemint-eight.vercel.app";

function getOrigin(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function getForwardedRequestOrigin(request: Request) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");

  if (forwardedHost) {
    return `${forwardedProto === "http" ? "http" : "https"}://${forwardedHost}`;
  }

  return new URL(request.url).origin;
}

function matchesOrigin(envValue: string | undefined, requestOrigin: string) {
  return Boolean(envValue && getOrigin(envValue) === requestOrigin);
}

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

function getInvalidCodeMetadata(request: Request) {
  const url = new URL(request.url);
  const requestOrigin = getForwardedRequestOrigin(request);
  const provider = url.pathname.match(/\/callback\/([^/?#]+)/)?.[1] ?? null;
  const betterAuthUrl = process.env.BETTER_AUTH_URL;
  const nextPublicAppUrl = process.env.NEXT_PUBLIC_APP_URL;

  return {
    provider,
    callbackPath: url.pathname,
    requestOrigin,
    betterAuthUrlPresent: Boolean(betterAuthUrl),
    betterAuthUrlMatchesOrigin: matchesOrigin(betterAuthUrl, requestOrigin),
    nextPublicAppUrlPresent: Boolean(nextPublicAppUrl),
    nextPublicAppUrlMatchesOrigin: matchesOrigin(nextPublicAppUrl, requestOrigin),
    productionOriginMatchesRequest: requestOrigin === productionAppOrigin
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
    const response = await getAuth().handler(request);
    const location = response.headers.get("location");

    if (location) {
      const redirectURL = new URL(location, request.url);

      if (redirectURL.searchParams.get("error") === "invalid_code") {
        logAuthFailure("oauth_invalid_code", "provider_code_exchange_failed", {
          ...getInvalidCodeMetadata(request)
        });
      }
    }

    return response;
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
