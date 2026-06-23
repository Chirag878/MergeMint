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
import { organizations } from "./organizations";
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
