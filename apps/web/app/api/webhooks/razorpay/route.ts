import { processRazorpayWebhook } from "@veriflow/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const signature = request.headers.get("x-razorpay-signature");
  const rawBody = Buffer.from(await request.arrayBuffer());
  const result = await processRazorpayWebhook({
    rawBody,
    signature
  });

  return Response.json(result.body, { status: result.status });
}
