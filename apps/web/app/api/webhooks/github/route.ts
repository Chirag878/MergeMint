import { createHmac, timingSafeEqual } from "node:crypto";
import { processGitHubWebhook } from "@veriflow/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonResponse(body: unknown, init?: ResponseInit) {
  return Response.json(body, init);
}

function verifyGitHubSignature(input: {
  body: Buffer;
  signature: string | null;
  secret: string | undefined;
}) {
  if (!input.secret) {
    if (process.env.NODE_ENV === "production") {
      console.warn(
        "GitHub webhook received but GITHUB_WEBHOOK_SECRET is not configured."
      );
    }
    return false;
  }

  if (!input.signature?.startsWith("sha256=")) {
    return false;
  }

  const expectedSignature = `sha256=${createHmac("sha256", input.secret)
    .update(input.body)
    .digest("hex")}`;

  const received = Buffer.from(input.signature, "utf8");
  const expected = Buffer.from(expectedSignature, "utf8");

  return received.length === expected.length && timingSafeEqual(received, expected);
}

export async function POST(request: Request) {
  const eventName = request.headers.get("x-github-event");
  const deliveryId = request.headers.get("x-github-delivery");
  const signature = request.headers.get("x-hub-signature-256");
  const rawBody = Buffer.from(await request.arrayBuffer());

  if (
    !verifyGitHubSignature({
      body: rawBody,
      signature,
      secret: process.env.GITHUB_WEBHOOK_SECRET
    })
  ) {
    return jsonResponse({ ok: false }, { status: 401 });
  }

  if (!eventName || !deliveryId) {
    return jsonResponse({ ok: false, error: "Missing GitHub headers." }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON payload." }, { status: 400 });
  }

  const result = await processGitHubWebhook(
    {
      eventName,
      deliveryId
    },
    payload
  );

  return jsonResponse(result);
}
