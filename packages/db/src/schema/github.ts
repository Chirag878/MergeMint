import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";

import { ciStatusEnum, githubPrStateEnum } from "./enums";
import { featureRequests } from "./feature-requests";
import { organizations } from "./organizations";
import { projects } from "./projects";
import type {
  ChangedFile,
  GitHubCheckSnapshot,
  GitHubCommitSnapshot,
  JsonObject
} from "./types";

export const githubConnections = pgTable(
  "github_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    installationId: text("installation_id"),
    githubAccountLogin: text("github_account_login").notNull(),
    githubAccountId: text("github_account_id").notNull(),
    encryptedAccessToken: text("encrypted_access_token"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [
    index("github_connections_organization_id_idx").on(table.organizationId),
    index("github_connections_github_account_id_idx").on(
      table.githubAccountId
    ),
    uniqueIndex("github_connections_org_installation_unique").on(
      table.organizationId,
      table.installationId
    )
  ]
);

export const repositories = pgTable(
  "repositories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    githubRepoId: text("github_repo_id").notNull(),
    owner: text("owner").notNull(),
    name: text("name").notNull(),
    fullName: text("full_name").notNull(),
    defaultBranch: text("default_branch").notNull().default("main"),
    isPrivate: boolean("private").notNull().default(false),
    connectedAt: timestamp("connected_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [
    uniqueIndex("repositories_org_github_repo_id_unique").on(
      table.organizationId,
      table.githubRepoId
    ),
    uniqueIndex("repositories_org_full_name_unique").on(
      table.organizationId,
      table.fullName
    ),
    index("repositories_organization_id_idx").on(table.organizationId),
    index("repositories_github_repo_id_idx").on(table.githubRepoId),
    index("repositories_full_name_idx").on(table.fullName),
    index("repositories_connected_at_idx").on(table.connectedAt)
  ]
);

export const pullRequests = pgTable(
  "pull_requests",
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
    repositoryId: uuid("repository_id")
      .notNull()
      .references(() => repositories.id, { onDelete: "cascade" }),
    githubPrNumber: integer("github_pr_number").notNull(),
    title: text("title").notNull(),
    author: text("author"),
    branch: text("branch").notNull(),
    baseBranch: text("base_branch").notNull(),
    state: githubPrStateEnum("state").notNull().default("open"),
    mergeStatus: text("merge_status"),
    latestCommitSha: text("latest_commit_sha"),
    htmlUrl: text("html_url").notNull(),
    openedAt: timestamp("opened_at", { withTimezone: true }),
    mergedAt: timestamp("merged_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [
    uniqueIndex("pull_requests_repository_pr_number_unique").on(
      table.repositoryId,
      table.githubPrNumber
    ),
    index("pull_requests_organization_id_idx").on(table.organizationId),
    index("pull_requests_project_id_idx").on(table.projectId),
    index("pull_requests_feature_request_id_idx").on(table.featureRequestId),
    index("pull_requests_repository_id_idx").on(table.repositoryId),
    index("pull_requests_state_idx").on(table.state),
    index("pull_requests_created_at_idx").on(table.createdAt)
  ]
);

export const prSnapshots = pgTable(
  "pr_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pullRequestId: uuid("pull_request_id")
      .notNull()
      .references(() => pullRequests.id, { onDelete: "cascade" }),
    commitSha: text("commit_sha").notNull(),
    diffText: text("diff_text"),
    changedFiles:
      jsonb("changed_files").$type<ChangedFile[]>().default([]).notNull(),
    commits:
      jsonb("commits").$type<GitHubCommitSnapshot[]>().default([]).notNull(),
    checks: jsonb("checks").$type<GitHubCheckSnapshot[]>().default([]).notNull(),
    ciStatus: ciStatusEnum("ci_status").notNull().default("unknown"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [
    uniqueIndex("pr_snapshots_pull_request_commit_unique").on(
      table.pullRequestId,
      table.commitSha
    ),
    index("pr_snapshots_pull_request_id_idx").on(table.pullRequestId),
    index("pr_snapshots_commit_sha_idx").on(table.commitSha),
    index("pr_snapshots_ci_status_idx").on(table.ciStatus),
    index("pr_snapshots_created_at_idx").on(table.createdAt)
  ]
);

export const githubWebhookEvents = pgTable(
  "github_webhook_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "set null"
    }),
    eventType: text("event_type").notNull(),
    deliveryId: text("delivery_id").notNull(),
    payload: jsonb("payload").$type<JsonObject>().notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [
    uniqueIndex("github_webhook_events_delivery_id_unique").on(
      table.deliveryId
    ),
    index("github_webhook_events_organization_id_idx").on(table.organizationId),
    index("github_webhook_events_event_type_idx").on(table.eventType),
    index("github_webhook_events_processed_at_idx").on(table.processedAt),
    index("github_webhook_events_created_at_idx").on(table.createdAt)
  ]
);
