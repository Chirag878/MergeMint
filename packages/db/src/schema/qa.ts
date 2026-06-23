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
  aiAgentTypeEnum,
  aiRunStatusEnum,
  findingCategoryEnum,
  findingSeverityEnum,
  findingStatusEnum,
  qaReviewStatusEnum,
  requirementCoverageStatusEnum
} from "./enums";
import { featureRequests } from "./feature-requests";
import { pullRequests } from "./github";
import { organizations } from "./organizations";
import { prds } from "./prds";
import type { JsonObject, RequirementEvidence, TokenUsage } from "./types";

export const aiRuns = pgTable(
  "ai_runs",
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
    agentType: aiAgentTypeEnum("agent_type").notNull(),
    model: text("model").notNull(),
    input: jsonb("input").$type<JsonObject>().notNull(),
    output: jsonb("output").$type<JsonObject>(),
    tokenUsage: jsonb("token_usage").$type<TokenUsage>(),
    status: aiRunStatusEnum("status").notNull().default("queued"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [
    index("ai_runs_organization_id_idx").on(table.organizationId),
    index("ai_runs_feature_request_id_idx").on(table.featureRequestId),
    index("ai_runs_pull_request_id_idx").on(table.pullRequestId),
    index("ai_runs_agent_type_idx").on(table.agentType),
    index("ai_runs_status_idx").on(table.status),
    index("ai_runs_created_at_idx").on(table.createdAt)
  ]
);

export const qaReviews = pgTable(
  "qa_reviews",
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
    prdId: uuid("prd_id")
      .notNull()
      .references(() => prds.id, { onDelete: "cascade" }),
    aiRunId: uuid("ai_run_id").references(() => aiRuns.id, {
      onDelete: "set null"
    }),
    reviewVersion: integer("review_version").notNull().default(1),
    overallStatus: qaReviewStatusEnum("overall_status").notNull(),
    confidenceScore: integer("confidence_score"),
    readinessScore: integer("readiness_score"),
    summary: text("summary"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [
    uniqueIndex("qa_reviews_pull_request_review_version_unique").on(
      table.pullRequestId,
      table.reviewVersion
    ),
    index("qa_reviews_organization_id_idx").on(table.organizationId),
    index("qa_reviews_feature_request_id_idx").on(table.featureRequestId),
    index("qa_reviews_pull_request_id_idx").on(table.pullRequestId),
    index("qa_reviews_prd_id_idx").on(table.prdId),
    index("qa_reviews_ai_run_id_idx").on(table.aiRunId),
    index("qa_reviews_overall_status_idx").on(table.overallStatus),
    index("qa_reviews_created_at_idx").on(table.createdAt)
  ]
);

export const qaRequirementCoverage = pgTable(
  "qa_requirement_coverage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    qaReviewId: uuid("qa_review_id")
      .notNull()
      .references(() => qaReviews.id, { onDelete: "cascade" }),
    requirementKey: text("requirement_key").notNull(),
    status: requirementCoverageStatusEnum("status").notNull(),
    evidence: jsonb("evidence").$type<RequirementEvidence>().default({}).notNull(),
    concern: text("concern"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [
    uniqueIndex("qa_requirement_coverage_review_requirement_unique").on(
      table.qaReviewId,
      table.requirementKey
    ),
    index("qa_requirement_coverage_qa_review_id_idx").on(table.qaReviewId),
    index("qa_requirement_coverage_requirement_key_idx").on(
      table.requirementKey
    ),
    index("qa_requirement_coverage_status_idx").on(table.status),
    index("qa_requirement_coverage_created_at_idx").on(table.createdAt)
  ]
);

export const qaFindings = pgTable(
  "qa_findings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    qaReviewId: uuid("qa_review_id")
      .notNull()
      .references(() => qaReviews.id, { onDelete: "cascade" }),
    pullRequestId: uuid("pull_request_id")
      .notNull()
      .references(() => pullRequests.id, { onDelete: "cascade" }),
    requirementKey: text("requirement_key"),
    severity: findingSeverityEnum("severity").notNull(),
    category: findingCategoryEnum("category").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    file: text("file"),
    line: integer("line"),
    suggestedFix: text("suggested_fix"),
    status: findingStatusEnum("status").notNull().default("open"),
    waivedReason: text("waived_reason"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [
    index("qa_findings_qa_review_id_idx").on(table.qaReviewId),
    index("qa_findings_pull_request_id_idx").on(table.pullRequestId),
    index("qa_findings_requirement_key_idx").on(table.requirementKey),
    index("qa_findings_severity_idx").on(table.severity),
    index("qa_findings_category_idx").on(table.category),
    index("qa_findings_status_idx").on(table.status),
    index("qa_findings_created_at_idx").on(table.createdAt)
  ]
);
