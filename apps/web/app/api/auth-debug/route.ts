import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getAuthDebugDiagnostics } from "@veriflow/api";

function isEnabled() {
  return process.env.NODE_ENV !== "production" || process.env.DEBUG_AUTH === "true";
}

export async function GET() {
  if (!isEnabled()) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  const requestHeaders = await headers();
  const diagnostics = await getAuthDebugDiagnostics(requestHeaders);

  return NextResponse.json(diagnostics);
}
