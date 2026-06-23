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

import { appUsers } from "./auth";
import { approvals } from "./approvals";
import { releaseReportStatusEnum } from "./enums";
import { featureRequests } from "./feature-requests";
import { pullRequests } from "./github";
import { organizations } from "./organizations";
import { projects } from "./projects";
import type { JsonObject } from "./types";

export const releaseReports = pgTable(
  "release_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    featureRequestId: uuid("feature_request_id")
      .notNull()
      .references(() => featureRequests.id, { onDelete: "cascade" }),
    pullRequestId: uuid("pull_request_id")
      .notNull()
      .references(() => pullRequests.id, { onDelete: "cascade" }),
    approvalId: uuid("approval_id").references(() => approvals.id, {
      onDelete: "set null"
    }),
    title: text("title").notNull(),
    status: releaseReportStatusEnum("status").notNull().default("draft"),
    shareToken: text("share_token").notNull(),
    reportData: jsonb("report_data").$type<JsonObject>().notNull(),
    readinessScore: integer("readiness_score"),
    generatedBy: uuid("generated_by").references(() => appUsers.id, {
      onDelete: "set null"
    }),
    generatedAt: timestamp("generated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [
    uniqueIndex("release_reports_share_token_unique").on(table.shareToken),
    index("release_reports_organization_id_idx").on(table.organizationId),
    index("release_reports_project_id_idx").on(table.projectId),
    index("release_reports_feature_request_id_idx").on(table.featureRequestId),
    index("release_reports_pull_request_id_idx").on(table.pullRequestId),
    index("release_reports_approval_id_idx").on(table.approvalId),
    index("release_reports_status_idx").on(table.status),
    index("release_reports_generated_by_idx").on(table.generatedBy),
    index("release_reports_created_at_idx").on(table.createdAt)
  ]
);
