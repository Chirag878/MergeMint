import {
  index,
  pgTable,
  text,
  timestamp,
  uuid
} from "drizzle-orm/pg-core";

import { projectStatusEnum } from "./enums";
import { organizations } from "./organizations";

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    clientName: text("client_name"),
    status: projectStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [
    index("projects_organization_id_idx").on(table.organizationId),
    index("projects_status_idx").on(table.status),
    index("projects_created_at_idx").on(table.createdAt)
  ]
);
