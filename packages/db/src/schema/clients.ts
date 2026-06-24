import {
  index,
  pgTable,
  text,
  timestamp,
  uuid
} from "drizzle-orm/pg-core";

import { appUsers } from "./auth";
import { organizations } from "./organizations";

export const clients = pgTable(
  "clients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    companyName: text("company_name"),
    contactName: text("contact_name"),
    contactEmail: text("contact_email"),
    notes: text("notes"),
    status: text("status").notNull().default("active"),
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
    index("clients_organization_id_idx").on(table.organizationId),
    index("clients_created_by_idx").on(table.createdBy),
    index("clients_status_idx").on(table.status),
    index("clients_created_at_idx").on(table.createdAt)
  ]
);
