import { NextResponse, type NextRequest } from "next/server";

function getLocalCanonicalHost() {
  const configuredUrl = process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL;

  if (!configuredUrl) {
    return null;
  }

  try {
    const url = new URL(configuredUrl);
    return url.hostname === "localhost" ? url.host : null;
  } catch {
    return null;
  }
}

export function proxy(request: NextRequest) {
  const localCanonicalHost = getLocalCanonicalHost();
  const requestHost = request.nextUrl.host;
  const requestHostname = request.nextUrl.hostname;

  if (
    localCanonicalHost &&
    (requestHostname === "127.0.0.1" || requestHostname === "::1") &&
    requestHost !== localCanonicalHost
  ) {
    const url = request.nextUrl.clone();
    url.host = localCanonicalHost;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
