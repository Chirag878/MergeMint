import { createHmac, timingSafeEqual } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import {
  BILLING_PLANS,
  PAID_BILLING_PLAN_KEYS,
  getBillingPlan,
  type BillingPlanKey,
  type PaidBillingPlanKey
} from "@veriflow/shared";
import {
  appUsers,
  billingAdminGrants,
  billingPayments,
  db,
  organizationMembers,
  organizations,
  prCreditEvents,
  qaReviews,
  workspaceEntitlements,
  type JsonObject
} from "@veriflow/db";
import type { TRPCContext } from "../context";
import { ensureUserWorkspace } from "./workspace-bootstrap.service";

export const PR_CREDIT_EXHAUSTED_MESSAGE =
  "You've used your available PR review credits. Upgrade your plan or contact us for manual access.";

type ProtectedContext = TRPCContext & {
  user: NonNullable<TRPCContext["user"]>;
  session: NonNullable<TRPCContext["session"]>;
};

type BillingDb = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

function toBootstrapInput(ctx: ProtectedContext) {
  return {
    user: ctx.user,
    session: ctx.session
  };
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function toJsonObject(value: unknown): JsonObject {
  return JSON.parse(JSON.stringify(value)) as JsonObject;
}

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isBillingAdminEmail(email?: string | null) {
  return Boolean(email && getAdminEmails().includes(email.toLowerCase()));
}

function assertBillingAdmin(ctx: ProtectedContext) {
  if (!isBillingAdminEmail(ctx.user.email)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have access to billing admin tools."
    });
  }
}

function sanitizePayment(payment: typeof billingPayments.$inferSelect) {
  return {
    id: payment.id,
    planKey: payment.planKey,
    amount: payment.amount,
    currency: payment.currency,
    status: payment.status,
    razorpayOrderId: payment.razorpayOrderId,
    razorpayPaymentId: payment.razorpayPaymentId,
    createdAt: payment.createdAt,
    paidAt: payment.paidAt
  };
}

function summarizeEntitlement(
  entitlement: typeof workspaceEntitlements.$inferSelect
) {
  const now = new Date();
  const expired = Boolean(
    entitlement.currentPeriodEnd && entitlement.currentPeriodEnd < now
  );
  const remainingCredits = Math.max(0, entitlement.prLimit - entitlement.prUsed);
  const upgradeRequired =
    expired ||
    remainingCredits <= 0 ||
    entitlement.status === "expired" ||
    entitlement.status === "cancelled";

  return {
    ...entitlement,
    remainingCredits: expired ? 0 : remainingCredits,
    expired,
    upgradeRequired
  };
}

export async function ensureFreeEntitlement(
  organizationId: string,
  tx: BillingDb = db
) {
  const [existing] = await tx
    .select()
    .from(workspaceEntitlements)
    .where(eq(workspaceEntitlements.organizationId, organizationId))
    .limit(1);

  if (existing) {
    return existing;
  }

  const now = new Date();
  const [created] = await tx
    .insert(workspaceEntitlements)
    .values({
      organizationId,
      planKey: "free",
      status: "free",
      prLimit: BILLING_PLANS.free.credits,
      prUsed: 0,
      currentPeriodStart: now,
      currentPeriodEnd: null,
      source: "free"
    })
    .onConflictDoNothing({
      target: workspaceEntitlements.organizationId
    })
    .returning();

  if (created) {
    await tx.insert(prCreditEvents).values({
      organizationId,
      eventType: "free_credit_initialized",
      creditsDelta: BILLING_PLANS.free.credits,
      reason: "Initial free PR review credit."
    });
    return created;
  }

  const [afterConflict] = await tx
    .select()
    .from(workspaceEntitlements)
    .where(eq(workspaceEntitlements.organizationId, organizationId))
    .limit(1);

  if (!afterConflict) {
    throw new Error("Unable to initialize workspace entitlement.");
  }

  return afterConflict;
}

async function activatePlanForPayment(input: {
  organizationId: string;
  userId?: string | null;
  planKey: PaidBillingPlanKey;
  source: "razorpay" | "manual" | "demo";
  credits?: number;
  validityDays?: number;
  reason: string;
  tx?: BillingDb;
}) {
  const tx = input.tx ?? db;
  const plan = getBillingPlan(input.planKey);
  if (!plan) {
    throw new Error(`Unknown billing plan: ${input.planKey}`);
  }

  const now = new Date();
  const credits = input.credits ?? plan.credits;
  const validityDays = input.validityDays ?? plan.validityDays;
  const periodEnd = addDays(now, validityDays);

  await ensureFreeEntitlement(input.organizationId, tx);

  const [entitlement] = await tx
    .insert(workspaceEntitlements)
    .values({
      organizationId: input.organizationId,
      planKey: input.planKey,
      status: "active",
      prLimit: credits,
      prUsed: 0,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      source: input.source,
      updatedAt: now
    })
    .onConflictDoUpdate({
      target: workspaceEntitlements.organizationId,
      set: {
        planKey: input.planKey,
        status: "active",
        prLimit: credits,
        prUsed: 0,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        source: input.source,
        updatedAt: now
      }
    })
    .returning();

  await tx.insert(prCreditEvents).values({
    organizationId: input.organizationId,
    eventType: "plan_activated",
    creditsDelta: credits,
    reason: input.reason,
    createdByUserId: input.userId ?? null
  });

  if (!entitlement) {
    throw new Error("Unable to activate entitlement.");
  }

  return entitlement;
}

function assertPaidPlan(planKey: string): PaidBillingPlanKey {
  const plan = getBillingPlan(planKey);
  if (!plan || plan.key === "free" || !plan.checkoutEnabled) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Unknown or unavailable billing plan."
    });
  }

  return plan.key as PaidBillingPlanKey;
}

function verifyRazorpaySignature(input: {
  orderId: string;
  paymentId: string;
  signature: string;
  secret: string;
}) {
  const expected = createHmac("sha256", input.secret)
    .update(`${input.orderId}|${input.paymentId}`)
    .digest("hex");
  const received = Buffer.from(input.signature, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");

  return (
    received.length === expectedBuffer.length &&
    timingSafeEqual(received, expectedBuffer)
  );
}

export async function getPlans() {
  return {
    plans: PAID_BILLING_PLAN_KEYS.map((key) => BILLING_PLANS[key]),
    freePlan: BILLING_PLANS.free
  };
}

export async function getCurrentEntitlement(ctx: ProtectedContext) {
  const workspace = await ensureUserWorkspace(toBootstrapInput(ctx));
  const entitlement = await ensureFreeEntitlement(workspace.activeOrganization.id);
  return summarizeEntitlement(entitlement);
}

export async function createCheckoutOrder(
  ctx: ProtectedContext,
  input: { planKey: string }
) {
  const planKey = assertPaidPlan(input.planKey);
  const plan = BILLING_PLANS[planKey];
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Razorpay checkout is not configured yet."
    });
  }

  const workspace = await ensureUserWorkspace(toBootstrapInput(ctx));
  await ensureFreeEntitlement(workspace.activeOrganization.id);

  const receipt = `mm_${workspace.activeOrganization.id.slice(0, 8)}_${Date.now()}`;
  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString(
        "base64"
      )}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      amount: plan.checkoutAmountPaise,
      currency: "INR",
      receipt,
      notes: {
        plan_key: plan.key,
        organization_id: workspace.activeOrganization.id
      }
    })
  });

  if (!response.ok) {
    throw new TRPCError({
      code: "BAD_GATEWAY",
      message: "Could not create Razorpay order. Please try again."
    });
  }

  const order = (await response.json()) as {
    id: string;
    amount: number;
    currency: string;
  };

  await db.insert(billingPayments).values({
    organizationId: workspace.activeOrganization.id,
    userId: workspace.appUser.id,
    planKey: plan.key,
    amount: order.amount,
    currency: order.currency,
    status: "created",
    razorpayOrderId: order.id
  });

  return {
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    keyId,
    plan,
    prefill: {
      name: ctx.user.name ?? undefined,
      email: ctx.user.email
    }
  };
}

export async function verifyCheckoutPayment(
  ctx: ProtectedContext,
  input: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }
) {
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Razorpay verification is not configured yet."
    });
  }

  if (
    !verifyRazorpaySignature({
      orderId: input.razorpayOrderId,
      paymentId: input.razorpayPaymentId,
      signature: input.razorpaySignature,
      secret: keySecret
    })
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Payment verification failed."
    });
  }

  const workspace = await ensureUserWorkspace(toBootstrapInput(ctx));

  return db.transaction(async (tx) => {
    const [payment] = await tx
      .select()
      .from(billingPayments)
      .where(
        and(
          eq(billingPayments.razorpayOrderId, input.razorpayOrderId),
          eq(billingPayments.organizationId, workspace.activeOrganization.id)
        )
      )
      .limit(1);

    if (!payment) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Payment order not found."
      });
    }

    if (payment.status === "paid") {
      return {
        payment: sanitizePayment(payment),
        entitlement: summarizeEntitlement(
          await ensureFreeEntitlement(payment.organizationId, tx)
        )
      };
    }

    const planKey = assertPaidPlan(payment.planKey);
    const now = new Date();

    const [updatedPayment] = await tx
      .update(billingPayments)
      .set({
        status: "paid",
        razorpayPaymentId: input.razorpayPaymentId,
        razorpaySignature: input.razorpaySignature,
        paidAt: now,
        updatedAt: now
      })
      .where(eq(billingPayments.id, payment.id))
      .returning();

    const entitlement = await activatePlanForPayment({
      organizationId: payment.organizationId,
      userId: workspace.appUser.id,
      planKey,
      source: "razorpay",
      reason: `Razorpay payment verified for ${BILLING_PLANS[planKey].displayName}.`,
      tx
    });

    return {
      payment: sanitizePayment(updatedPayment ?? payment),
      entitlement: summarizeEntitlement(entitlement)
    };
  });
}

export async function getPaymentHistory(ctx: ProtectedContext) {
  const workspace = await ensureUserWorkspace(toBootstrapInput(ctx));

  const payments = await db
    .select()
    .from(billingPayments)
    .where(eq(billingPayments.organizationId, workspace.activeOrganization.id))
    .orderBy(desc(billingPayments.createdAt))
    .limit(50);

  return payments.map(sanitizePayment);
}

export async function getCreditEvents(ctx: ProtectedContext) {
  const workspace = await ensureUserWorkspace(toBootstrapInput(ctx));
  await ensureFreeEntitlement(workspace.activeOrganization.id);

  return db
    .select()
    .from(prCreditEvents)
    .where(eq(prCreditEvents.organizationId, workspace.activeOrganization.id))
    .orderBy(desc(prCreditEvents.createdAt))
    .limit(100);
}

export async function adminLookupCustomer(
  ctx: ProtectedContext,
  input: { email: string }
) {
  assertBillingAdmin(ctx);
  const query = `%${input.email.trim()}%`;

  const rows = await db
    .select({
      appUser: appUsers,
      membership: organizationMembers,
      organization: organizations,
      entitlement: workspaceEntitlements
    })
    .from(appUsers)
    .leftJoin(organizationMembers, eq(organizationMembers.userId, appUsers.id))
    .leftJoin(organizations, eq(organizations.id, organizationMembers.organizationId))
    .leftJoin(
      workspaceEntitlements,
      eq(workspaceEntitlements.organizationId, organizations.id)
    )
    .where(or(ilike(appUsers.email, query), ilike(organizations.name, query)))
    .orderBy(appUsers.email)
    .limit(20);

  return rows.map((row) => ({
    user: {
      id: row.appUser.id,
      email: row.appUser.email,
      name: row.appUser.name
    },
    organization: row.organization
      ? {
          id: row.organization.id,
          name: row.organization.name,
          slug: row.organization.slug
        }
      : null,
    membership: row.membership
      ? {
          role: row.membership.role
        }
      : null,
    entitlement: row.entitlement ? summarizeEntitlement(row.entitlement) : null
  }));
}

export async function adminGrantAccess(
  ctx: ProtectedContext,
  input: {
    customerEmail: string;
    planKey: string;
    prCreditAmount: number;
    validityDays: number;
    note?: string;
    source: "manual" | "demo";
  }
) {
  assertBillingAdmin(ctx);
  const adminWorkspace = await ensureUserWorkspace(toBootstrapInput(ctx));
  const planKey = input.planKey as BillingPlanKey;
  const plan = getBillingPlan(planKey);
  if (!plan) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Unknown plan key."
    });
  }

  const [target] = await db
    .select({
      appUser: appUsers,
      organization: organizations
    })
    .from(appUsers)
    .innerJoin(organizationMembers, eq(organizationMembers.userId, appUsers.id))
    .innerJoin(organizations, eq(organizations.id, organizationMembers.organizationId))
    .where(eq(appUsers.email, input.customerEmail.trim().toLowerCase()))
    .limit(1);

  if (!target) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "No workspace found for that customer email."
    });
  }

  return db.transaction(async (tx) => {
    const now = new Date();
    const periodEnd = addDays(now, input.validityDays);
    await ensureFreeEntitlement(target.organization.id, tx);

    const [entitlement] = await tx
      .update(workspaceEntitlements)
      .set({
        planKey,
        status: planKey === "free" ? "free" : "active",
        prLimit: input.prCreditAmount,
        prUsed: 0,
        currentPeriodStart: now,
        currentPeriodEnd: planKey === "free" ? null : periodEnd,
        source: input.source,
        updatedAt: now
      })
      .where(eq(workspaceEntitlements.organizationId, target.organization.id))
      .returning();

    await tx.insert(billingAdminGrants).values({
      organizationId: target.organization.id,
      customerEmail: target.appUser.email,
      planKey,
      creditsGranted: input.prCreditAmount,
      validityDays: input.validityDays,
      note: input.note ?? null,
      source: input.source,
      grantedByUserId: adminWorkspace.appUser.id
    });

    await tx.insert(prCreditEvents).values({
      organizationId: target.organization.id,
      eventType: "manual_adjustment",
      creditsDelta: input.prCreditAmount,
      reason: input.note || `${input.source} access granted by admin.`,
      createdByUserId: adminWorkspace.appUser.id
    });

    return {
      organization: target.organization,
      entitlement: summarizeEntitlement(
        entitlement ?? (await ensureFreeEntitlement(target.organization.id, tx))
      )
    };
  });
}

export async function assertQaReviewCreditAvailable(input: {
  organizationId: string;
}) {
  const entitlement = await ensureFreeEntitlement(input.organizationId);
  const summary = summarizeEntitlement(entitlement);

  if (summary.upgradeRequired) {
    throw new TRPCError({
      code: "PAYMENT_REQUIRED",
      message: PR_CREDIT_EXHAUSTED_MESSAGE
    });
  }

  return summary;
}

export async function hasSuccessfulQaReviewForFeaturePr(input: {
  organizationId: string;
  featureRequestId: string;
  pullRequestId: string;
}) {
  const [existing] = await db
    .select({ id: qaReviews.id })
    .from(qaReviews)
    .where(
      and(
        eq(qaReviews.organizationId, input.organizationId),
        eq(qaReviews.featureRequestId, input.featureRequestId),
        eq(qaReviews.pullRequestId, input.pullRequestId)
      )
    )
    .limit(1);

  return Boolean(existing);
}

export async function consumeQaReviewCredit(input: {
  organizationId: string;
  featureRequestId: string;
  pullRequestId: string;
  qaReviewId: string;
  createdByUserId: string;
}) {
  return db.transaction(async (tx) => {
    const [existingConsumption] = await tx
      .select({ id: prCreditEvents.id })
      .from(prCreditEvents)
      .where(
        and(
          eq(prCreditEvents.organizationId, input.organizationId),
          eq(prCreditEvents.featureRequestId, input.featureRequestId),
          eq(prCreditEvents.pullRequestId, input.pullRequestId),
          eq(prCreditEvents.eventType, "credit_consumed")
        )
      )
      .limit(1);

    if (existingConsumption) {
      return { consumed: false };
    }

    const [successfulReview] = await tx
      .select({ id: qaReviews.id })
      .from(qaReviews)
      .where(
        and(
          eq(qaReviews.organizationId, input.organizationId),
          eq(qaReviews.featureRequestId, input.featureRequestId),
          eq(qaReviews.pullRequestId, input.pullRequestId)
        )
      )
      .limit(1);

    if (successfulReview && successfulReview.id !== input.qaReviewId) {
      return { consumed: false };
    }

    await tx
      .update(workspaceEntitlements)
      .set({
        prUsed: sql`${workspaceEntitlements.prUsed} + 1`,
        updatedAt: new Date()
      })
      .where(eq(workspaceEntitlements.organizationId, input.organizationId));

    await tx.insert(prCreditEvents).values({
      organizationId: input.organizationId,
      featureRequestId: input.featureRequestId,
      pullRequestId: input.pullRequestId,
      qaReviewId: input.qaReviewId,
      eventType: "credit_consumed",
      creditsDelta: -1,
      reason: "Verified PR review completed.",
      createdByUserId: input.createdByUserId
    });

    return { consumed: true };
  });
}

function verifyWebhookSignature(input: {
  rawBody: Buffer;
  signature: string | null;
  secret: string | undefined;
}) {
  if (!input.secret || !input.signature) {
    return false;
  }

  const expected = createHmac("sha256", input.secret)
    .update(input.rawBody)
    .digest("hex");
  const received = Buffer.from(input.signature, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");

  return (
    received.length === expectedBuffer.length &&
    timingSafeEqual(received, expectedBuffer)
  );
}

function safeRazorpaySummary(payload: unknown): JsonObject {
  const record = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const event = typeof record.event === "string" ? record.event : "unknown";
  const paymentEntity =
    record.payload &&
    typeof record.payload === "object" &&
    "payment" in record.payload &&
    typeof (record.payload as Record<string, unknown>).payment === "object"
      ? ((record.payload as Record<string, unknown>).payment as Record<string, unknown>)
      : undefined;
  const orderEntity =
    record.payload &&
    typeof record.payload === "object" &&
    "order" in record.payload &&
    typeof (record.payload as Record<string, unknown>).order === "object"
      ? ((record.payload as Record<string, unknown>).order as Record<string, unknown>)
      : undefined;
  const payment = paymentEntity?.entity as Record<string, unknown> | undefined;
  const order = orderEntity?.entity as Record<string, unknown> | undefined;

  return toJsonObject({
    event,
    paymentId: typeof payment?.id === "string" ? payment.id : undefined,
    orderId:
      typeof payment?.order_id === "string"
        ? payment.order_id
        : typeof order?.id === "string"
          ? order.id
          : undefined,
    status:
      typeof payment?.status === "string"
        ? payment.status
        : typeof order?.status === "string"
          ? order.status
          : undefined,
    amount:
      typeof payment?.amount === "number"
        ? payment.amount
        : typeof order?.amount === "number"
          ? order.amount
          : undefined,
    currency:
      typeof payment?.currency === "string"
        ? payment.currency
        : typeof order?.currency === "string"
          ? order.currency
          : undefined
  });
}

export async function processRazorpayWebhook(input: {
  rawBody: Buffer;
  signature: string | null;
}) {
  if (
    !verifyWebhookSignature({
      rawBody: input.rawBody,
      signature: input.signature,
      secret: process.env.RAZORPAY_WEBHOOK_SECRET
    })
  ) {
    return { ok: false, status: 401, body: { ok: false } };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(input.rawBody.toString("utf8"));
  } catch {
    return { ok: false, status: 400, body: { ok: false, error: "Invalid JSON." } };
  }

  const summary = safeRazorpaySummary(payload);
  const event = summary.event as string | undefined;
  if (event !== "payment.captured" && event !== "order.paid") {
    return { ok: true, status: 200, body: { ok: true, ignored: true } };
  }

  const orderId = summary.orderId as string | undefined;
  const paymentId = summary.paymentId as string | undefined;
  if (!orderId) {
    return { ok: true, status: 200, body: { ok: true, ignored: true } };
  }

  await db.transaction(async (tx) => {
    const [payment] = await tx
      .select()
      .from(billingPayments)
      .where(eq(billingPayments.razorpayOrderId, orderId))
      .limit(1);

    if (!payment || payment.status === "paid") {
      return;
    }

    const planKey = assertPaidPlan(payment.planKey);
    const now = new Date();
    await tx
      .update(billingPayments)
      .set({
        status: "paid",
        razorpayPaymentId: paymentId ?? payment.razorpayPaymentId,
        safeEventSummary: summary,
        paidAt: now,
        updatedAt: now
      })
      .where(eq(billingPayments.id, payment.id));

    await activatePlanForPayment({
      organizationId: payment.organizationId,
      userId: payment.userId,
      planKey,
      source: "razorpay",
      reason: `Razorpay webhook activated ${BILLING_PLANS[planKey].displayName}.`,
      tx
    });
  });

  return { ok: true, status: 200, body: { ok: true } };
}
