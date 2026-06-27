import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid
} from "drizzle-orm/pg-core";

import {
  taskComplexityEnum,
  taskStatusEnum,
  taskTypeEnum
} from "./enums";
import { featureRequests } from "./feature-requests";
import { organizations } from "./organizations";
import { prds } from "./prds";
import { projects } from "./projects";
import type { StringList } from "./types";

export const engineeringTasks = pgTable(
  "engineering_tasks",
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
    prdId: uuid("prd_id")
      .notNull()
      .references(() => prds.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    type: taskTypeEnum("type").notNull().default("other"),
    status: taskStatusEnum("status").notNull().default("todo"),
    priority: text("priority").notNull().default("must_have"),
    riskLevel: text("risk_level").notNull().default("medium"),
    relatedRequirementKeys:
      jsonb("related_requirement_keys").$type<StringList>().default([]).notNull(),
    acceptanceCriteriaRefs:
      jsonb("acceptance_criteria_refs").$type<StringList>().default([]).notNull(),
    acceptanceChecklist:
      jsonb("acceptance_checklist").$type<StringList>().default([]).notNull(),
    suggestedFiles:
      jsonb("suggested_files").$type<StringList>().default([]).notNull(),
    suggestedModules:
      jsonb("suggested_modules").$type<StringList>().default([]).notNull(),
    implementationNotes: text("implementation_notes"),
    verificationNotes: text("verification_notes"),
    complexity: taskComplexityEnum("complexity").notNull().default("medium"),
    orderIndex: integer("order_index").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [
    index("engineering_tasks_organization_id_idx").on(table.organizationId),
    index("engineering_tasks_project_id_idx").on(table.projectId),
    index("engineering_tasks_feature_request_id_idx").on(
      table.featureRequestId
    ),
    index("engineering_tasks_prd_id_idx").on(table.prdId),
    index("engineering_tasks_status_idx").on(table.status),
    index("engineering_tasks_type_idx").on(table.type),
    index("engineering_tasks_priority_idx").on(table.priority),
    index("engineering_tasks_risk_level_idx").on(table.riskLevel),
    index("engineering_tasks_order_index_idx").on(table.orderIndex),
    index("engineering_tasks_created_at_idx").on(table.createdAt)
  ]
);
