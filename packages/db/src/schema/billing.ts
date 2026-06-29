import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";

import {
  paymentStatusEnum,
  planEnum,
  subscriptionStatusEnum
} from "./enums";
import { appUsers } from "./auth";
import { featureRequests } from "./feature-requests";
import { pullRequests } from "./github";
import { organizations } from "./organizations";
import { qaReviews } from "./qa";
import type { JsonObject } from "./types";

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    plan: planEnum("plan").notNull().default("free"),
    status: subscriptionStatusEnum("status").notNull().default("trialing"),
    razorpayCustomerId: text("razorpay_customer_id").notNull(),
    razorpaySubscriptionId: text("razorpay_subscription_id"),
    currentPeriodStart: timestamp("current_period_start", {
      withTimezone: true
    }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [
    uniqueIndex("subscriptions_organization_id_unique").on(
      table.organizationId
    ),
    uniqueIndex("subscriptions_razorpay_subscription_id_unique").on(
      table.razorpaySubscriptionId
    ),
    index("subscriptions_plan_idx").on(table.plan),
    index("subscriptions_status_idx").on(table.status),
    index("subscriptions_current_period_end_idx").on(table.currentPeriodEnd),
    index("subscriptions_created_at_idx").on(table.createdAt)
  ]
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull().default("INR"),
    status: paymentStatusEnum("status").notNull(),
    plan: planEnum("plan").notNull(),
    razorpayPaymentId: text("razorpay_payment_id").notNull(),
    razorpayOrderId: text("razorpay_order_id").notNull(),
    razorpaySignature: text("razorpay_signature"),
    metadata: jsonb("metadata").$type<JsonObject>().default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [
    uniqueIndex("payments_razorpay_payment_id_unique").on(
      table.razorpayPaymentId
    ),
    uniqueIndex("payments_razorpay_order_id_unique").on(table.razorpayOrderId),
    index("payments_organization_id_idx").on(table.organizationId),
    index("payments_status_idx").on(table.status),
    index("payments_plan_idx").on(table.plan),
    index("payments_created_at_idx").on(table.createdAt)
  ]
);

export const workspaceEntitlements = pgTable(
  "workspace_entitlements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    planKey: text("plan_key").notNull().default("free"),
    status: text("status").notNull().default("free"),
    prLimit: integer("pr_limit").notNull().default(1),
    prUsed: integer("pr_used").notNull().default(0),
    currentPeriodStart: timestamp("current_period_start", {
      withTimezone: true
    }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    source: text("source").notNull().default("free"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [
    uniqueIndex("workspace_entitlements_organization_id_unique").on(
      table.organizationId
    ),
    index("workspace_entitlements_plan_key_idx").on(table.planKey),
    index("workspace_entitlements_status_idx").on(table.status),
    index("workspace_entitlements_source_idx").on(table.source),
    index("workspace_entitlements_period_end_idx").on(table.currentPeriodEnd),
    index("workspace_entitlements_created_at_idx").on(table.createdAt)
  ]
);

export const billingPayments = pgTable(
  "billing_payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => appUsers.id, {
      onDelete: "set null"
    }),
    planKey: text("plan_key").notNull(),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull().default("INR"),
    status: text("status").notNull().default("created"),
    razorpayOrderId: text("razorpay_order_id").notNull(),
    razorpayPaymentId: text("razorpay_payment_id"),
    razorpaySignature: text("razorpay_signature"),
    safeEventSummary: jsonb("safe_event_summary").$type<JsonObject>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [
    uniqueIndex("billing_payments_razorpay_order_id_unique").on(
      table.razorpayOrderId
    ),
    uniqueIndex("billing_payments_razorpay_payment_id_unique").on(
      table.razorpayPaymentId
    ),
    index("billing_payments_organization_id_idx").on(table.organizationId),
    index("billing_payments_user_id_idx").on(table.userId),
    index("billing_payments_plan_key_idx").on(table.planKey),
    index("billing_payments_status_idx").on(table.status),
    index("billing_payments_created_at_idx").on(table.createdAt)
  ]
);

export const prCreditEvents = pgTable(
  "pr_credit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    featureRequestId: uuid("feature_request_id").references(
      () => featureRequests.id,
      { onDelete: "set null" }
    ),
    pullRequestId: uuid("pull_request_id").references(() => pullRequests.id, {
      onDelete: "set null"
    }),
    qaReviewId: uuid("qa_review_id").references(() => qaReviews.id, {
      onDelete: "set null"
    }),
    billingPaymentId: uuid("billing_payment_id").references(
      () => billingPayments.id,
      { onDelete: "set null" }
    ),
    eventType: text("event_type").notNull(),
    creditsDelta: integer("credits_delta").notNull(),
    reason: text("reason"),
    createdByUserId: uuid("created_by_user_id").references(() => appUsers.id, {
      onDelete: "set null"
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [
    index("pr_credit_events_organization_id_idx").on(table.organizationId),
    index("pr_credit_events_feature_request_id_idx").on(table.featureRequestId),
    index("pr_credit_events_pull_request_id_idx").on(table.pullRequestId),
    index("pr_credit_events_qa_review_id_idx").on(table.qaReviewId),
    uniqueIndex("pr_credit_events_billing_payment_id_unique").on(
      table.billingPaymentId
    ),
    index("pr_credit_events_event_type_idx").on(table.eventType),
    index("pr_credit_events_created_at_idx").on(table.createdAt)
  ]
);

export const billingAdminGrants = pgTable(
  "billing_admin_grants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    customerEmail: text("customer_email").notNull(),
    planKey: text("plan_key").notNull(),
    creditsGranted: integer("credits_granted").notNull(),
    validityDays: integer("validity_days").notNull(),
    note: text("note"),
    source: text("source").notNull().default("manual"),
    grantedByUserId: uuid("granted_by_user_id").references(() => appUsers.id, {
      onDelete: "set null"
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [
    index("billing_admin_grants_organization_id_idx").on(table.organizationId),
    index("billing_admin_grants_customer_email_idx").on(table.customerEmail),
    index("billing_admin_grants_plan_key_idx").on(table.planKey),
    index("billing_admin_grants_source_idx").on(table.source),
    index("billing_admin_grants_created_at_idx").on(table.createdAt)
  ]
);
