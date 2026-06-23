import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid
} from "drizzle-orm/pg-core";

import { appUsers } from "./auth";
import { approvalDecisionEnum } from "./enums";
import { featureRequests } from "./feature-requests";
import { pullRequests } from "./github";
import { organizations } from "./organizations";
import type { StringList } from "./types";

export const approvals = pgTable(
  "approvals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    featureRequestId: uuid("feature_request_id")
      .notNull()
      .references(() => featureRequests.id, { onDelete: "cascade" }),
    pullRequestId: uuid("pull_request_id")
      .notNull()
      .references(() => pullRequests.id, { onDelete: "cascade" }),
    approvedBy: uuid("approved_by").references(() => appUsers.id, {
      onDelete: "set null"
    }),
    decision: approvalDecisionEnum("decision").notNull(),
    note: text("note"),
    remainingRisks:
      jsonb("remaining_risks").$type<StringList>().default([]).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [
    index("approvals_organization_id_idx").on(table.organizationId),
    index("approvals_feature_request_id_idx").on(table.featureRequestId),
    index("approvals_pull_request_id_idx").on(table.pullRequestId),
    index("approvals_approved_by_idx").on(table.approvedBy),
    index("approvals_decision_idx").on(table.decision),
    index("approvals_created_at_idx").on(table.createdAt)
  ]
);
