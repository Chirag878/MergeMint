import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";

import { organizations } from "./organizations";

export const usageCounters = pgTable(
  "usage_counters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    periodKey: text("period_key").notNull(),
    featureWorkflowsUsed: integer("feature_workflows_used").notNull().default(0),
    prVerificationsUsed: integer("pr_verifications_used").notNull().default(0),
    aiReviewsUsed: integer("ai_reviews_used").notNull().default(0),
    releaseReportsUsed: integer("release_reports_used").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [
    uniqueIndex("usage_counters_organization_period_unique").on(
      table.organizationId,
      table.periodKey
    ),
    index("usage_counters_organization_id_idx").on(table.organizationId),
    index("usage_counters_period_key_idx").on(table.periodKey),
    index("usage_counters_created_at_idx").on(table.createdAt)
  ]
);
