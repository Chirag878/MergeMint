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

import { prdStatusEnum } from "./enums";
import { featureRequests } from "./feature-requests";
import type { JsonObject, StringList } from "./types";

export const prds = pgTable(
  "prds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    featureRequestId: uuid("feature_request_id")
      .notNull()
      .references(() => featureRequests.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    problem: text("problem"),
    goals: jsonb("goals").$type<StringList>().default([]).notNull(),
    nonGoals: jsonb("non_goals").$type<StringList>().default([]).notNull(),
    userStories: jsonb("user_stories").$type<JsonObject[]>().default([]).notNull(),
    edgeCases: jsonb("edge_cases").$type<StringList>().default([]).notNull(),
    risks: jsonb("risks").$type<StringList>().default([]).notNull(),
    version: integer("version").notNull().default(1),
    status: prdStatusEnum("status").notNull().default("draft"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    approvedAt: timestamp("approved_at", { withTimezone: true })
  },
  (table) => [
    index("prds_feature_request_id_idx").on(table.featureRequestId),
    index("prds_status_idx").on(table.status),
    index("prds_created_at_idx").on(table.createdAt)
  ]
);

export const prdRequirements = pgTable(
  "prd_requirements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    prdId: uuid("prd_id")
      .notNull()
      .references(() => prds.id, { onDelete: "cascade" }),
    requirementKey: text("requirement_key").notNull(),
    requirement: text("requirement").notNull(),
    priority: text("priority").notNull().default("P1"),
    acceptanceCriteria:
      jsonb("acceptance_criteria").$type<StringList>().default([]).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [
    uniqueIndex("prd_requirements_prd_requirement_key_unique").on(
      table.prdId,
      table.requirementKey
    ),
    index("prd_requirements_prd_id_idx").on(table.prdId),
    index("prd_requirements_priority_idx").on(table.priority),
    index("prd_requirements_created_at_idx").on(table.createdAt)
  ]
);
