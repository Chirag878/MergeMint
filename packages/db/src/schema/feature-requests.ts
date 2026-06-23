import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid
} from "drizzle-orm/pg-core";

import { appUsers } from "./auth";
import { featurePriorityEnum, featureStatusEnum } from "./enums";
import { organizations } from "./organizations";
import { projects } from "./projects";
import type { StringList } from "./types";

export const featureRequests = pgTable(
  "feature_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull(),
    businessGoal: text("business_goal"),
    expectedBehavior: text("expected_behavior"),
    acceptanceCriteria:
      jsonb("acceptance_criteria").$type<StringList>().default([]).notNull(),
    priority: featurePriorityEnum("priority").notNull().default("medium"),
    status: featureStatusEnum("status").notNull().default("draft"),
    createdBy: uuid("created_by").references(() => appUsers.id, {
      onDelete: "set null"
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [
    index("feature_requests_organization_id_idx").on(table.organizationId),
    index("feature_requests_project_id_idx").on(table.projectId),
    index("feature_requests_created_by_idx").on(table.createdBy),
    index("feature_requests_status_idx").on(table.status),
    index("feature_requests_priority_idx").on(table.priority),
    index("feature_requests_created_at_idx").on(table.createdAt)
  ]
);

export const clarificationQuestions = pgTable(
  "clarification_questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    featureRequestId: uuid("feature_request_id")
      .notNull()
      .references(() => featureRequests.id, { onDelete: "cascade" }),
    question: text("question").notNull(),
    reason: text("reason"),
    priority: featurePriorityEnum("priority").notNull().default("medium"),
    answer: text("answer"),
    answeredAt: timestamp("answered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [
    index("clarification_questions_feature_request_id_idx").on(
      table.featureRequestId
    ),
    index("clarification_questions_priority_idx").on(table.priority),
    index("clarification_questions_created_at_idx").on(table.createdAt)
  ]
);
