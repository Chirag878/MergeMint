import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid
} from "drizzle-orm/pg-core";

import { appUsers } from "./auth";
import { organizations } from "./organizations";
import { projects } from "./projects";

export type VerificationRuleSeverity = "blocking" | "warning" | "info";
export type VerificationRuleScope =
  | "all"
  | "frontend"
  | "backend"
  | "db"
  | "auth"
  | "billing"
  | "api"
  | "docs"
  | "github"
  | "ai";

export type VerificationRuleEvaluation = {
  ruleId: string | null;
  title: string;
  status: "passed" | "warning" | "failed" | "not_applicable";
  severity: VerificationRuleSeverity;
  evidence: string;
  suggestedFix: string | null;
};

export const verificationRules = pgTable(
  "verification_rules",
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
    severity: text("severity").$type<VerificationRuleSeverity>().notNull(),
    appliesTo: text("applies_to").$type<VerificationRuleScope>().notNull().default("all"),
    enabled: boolean("enabled").notNull().default(true),
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
    index("verification_rules_organization_id_idx").on(table.organizationId),
    index("verification_rules_project_id_idx").on(table.projectId),
    index("verification_rules_enabled_idx").on(table.enabled),
    index("verification_rules_created_at_idx").on(table.createdAt),
    index("verification_rules_project_enabled_idx").on(
      table.projectId,
      table.enabled
    )
  ]
);

