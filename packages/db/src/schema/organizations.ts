import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";

import { memberRoleEnum } from "./enums";
import { appUsers } from "./auth";

export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    logoUrl: text("logo_url"),
    workspaceUseCase: text("workspace_use_case"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [
    uniqueIndex("organizations_slug_unique").on(table.slug),
    index("organizations_created_at_idx").on(table.createdAt)
  ]
);

export const organizationMembers = pgTable(
  "organization_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    role: memberRoleEnum("role").notNull().default("member"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [
    uniqueIndex("organization_members_org_user_unique").on(
      table.organizationId,
      table.userId
    ),
    index("organization_members_organization_id_idx").on(table.organizationId),
    index("organization_members_user_id_idx").on(table.userId),
    index("organization_members_role_idx").on(table.role)
  ]
);

export const organizationInvitations = pgTable(
  "organization_invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: memberRoleEnum("role").notNull().default("member"),
    token: text("token").notNull(),
    status: text("status").notNull().default("pending"),
    invitedBy: uuid("invited_by").references(() => appUsers.id, {
      onDelete: "set null"
    }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [
    uniqueIndex("organization_invitations_token_unique").on(table.token),
    uniqueIndex("organization_invitations_org_email_unique").on(
      table.organizationId,
      table.email
    ),
    index("organization_invitations_organization_id_idx").on(
      table.organizationId
    ),
    index("organization_invitations_email_idx").on(table.email),
    index("organization_invitations_status_idx").on(table.status),
    index("organization_invitations_created_at_idx").on(table.createdAt)
  ]
);
