import {
  bigint,
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
import { appUsers } from "./auth";
import { featureRequests } from "./feature-requests";
import { organizations } from "./organizations";
import { projects } from "./projects";
import { qaReviews } from "./qa";
import type {
  ChangedFile,
  GitHubCheckSnapshot,
  GitHubCommitSnapshot,
  JsonObject,
  RepositoryAnalysisFileIndexItem,
  RepositoryAnalysisImportantFile,
  StringList
} from "./types";

export const githubAppInstallations = pgTable(
  "github_app_installations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    installationId: bigint("installation_id", { mode: "number" }).notNull(),
    accountLogin: text("account_login").notNull(),
    accountId: bigint("account_id", { mode: "number" }),
    accountType: text("account_type"),
    repositorySelection: text("repository_selection"),
    permissions: jsonb("permissions").$type<JsonObject>(),
    events: jsonb("events").$type<JsonObject>(),
    installedByUserId: uuid("installed_by_user_id").references(() => appUsers.id, {
      onDelete: "set null"
    }),
    suspendedAt: timestamp("suspended_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [
    uniqueIndex("github_app_installations_installation_id_unique").on(
      table.installationId
    ),
    index("github_app_installations_organization_id_idx").on(
      table.organizationId
    ),
    index("github_app_installations_account_login_idx").on(table.accountLogin),
    index("github_app_installations_installed_by_user_id_idx").on(
      table.installedByUserId
    )
  ]
);

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
    githubAppInstallationId: bigint("github_app_installation_id", {
      mode: "number"
    }).references(() => githubAppInstallations.installationId, {
      onDelete: "set null"
    }),
    owner: text("owner").notNull(),
    name: text("name").notNull(),
    fullName: text("full_name").notNull(),
    defaultBranch: text("default_branch").notNull().default("main"),
    isPrivate: boolean("private").notNull().default(false),
    githubAppSelected: boolean("github_app_selected").notNull().default(true),
    githubAppSyncedAt: timestamp("github_app_synced_at", {
      withTimezone: true
    }),
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
    index("repositories_github_app_installation_id_idx").on(
      table.githubAppInstallationId
    ),
    index("repositories_github_repo_id_idx").on(table.githubRepoId),
    index("repositories_full_name_idx").on(table.fullName),
    index("repositories_owner_name_idx").on(table.owner, table.name),
    index("repositories_connected_at_idx").on(table.connectedAt)
  ]
);

export const projectGithubRepositories = pgTable(
  "project_github_repositories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    repositoryId: uuid("repository_id")
      .notNull()
      .references(() => repositories.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [
    uniqueIndex("project_github_repositories_project_unique").on(
      table.projectId
    ),
    index("project_github_repositories_organization_id_idx").on(
      table.organizationId
    ),
    index("project_github_repositories_repository_id_idx").on(
      table.repositoryId
    )
  ]
);

export const repositoryAnalyses = pgTable(
  "repository_analyses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "set null"
    }),
    repositoryId: uuid("repository_id").references(() => repositories.id, {
      onDelete: "set null"
    }),
    githubRepositoryId: bigint("github_repository_id", { mode: "number" }),
    installationId: bigint("installation_id", { mode: "number" }),
    owner: text("owner").notNull(),
    name: text("name").notNull(),
    fullName: text("full_name").notNull(),
    defaultBranch: text("default_branch"),
    analyzedCommitSha: text("analyzed_commit_sha"),
    status: text("status").notNull().default("completed"),
    techStack: jsonb("tech_stack").$type<StringList>(),
    appStructure: jsonb("app_structure").$type<JsonObject>(),
    importantFiles:
      jsonb("important_files").$type<RepositoryAnalysisImportantFile[]>(),
    routes: jsonb("routes").$type<StringList>(),
    apiEndpoints: jsonb("api_endpoints").$type<StringList>(),
    databaseModels: jsonb("database_models").$type<StringList>(),
    authSummary: text("auth_summary"),
    testingSummary: text("testing_summary"),
    deploymentSummary: text("deployment_summary"),
    riskAreas: jsonb("risk_areas").$type<StringList>(),
    suggestedFeatureAreas: jsonb("suggested_feature_areas").$type<StringList>(),
    summary: text("summary"),
    rawFileIndex:
      jsonb("raw_file_index").$type<RepositoryAnalysisFileIndexItem[]>(),
    analysisData: jsonb("analysis_data").$type<JsonObject>(),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [
    index("repository_analyses_organization_id_idx").on(table.organizationId),
    index("repository_analyses_project_id_idx").on(table.projectId),
    index("repository_analyses_repository_id_idx").on(table.repositoryId),
    index("repository_analyses_github_repository_id_idx").on(
      table.githubRepositoryId
    ),
    index("repository_analyses_installation_id_idx").on(table.installationId),
    index("repository_analyses_full_name_idx").on(table.fullName),
    index("repository_analyses_created_at_idx").on(table.createdAt)
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
    installationId: bigint("installation_id", { mode: "number" }),
    repositoryOwner: text("repository_owner"),
    repositoryName: text("repository_name"),
    prNumber: integer("pr_number"),
    matchedFeatureRequestId: uuid("matched_feature_request_id").references(
      () => featureRequests.id,
      { onDelete: "set null" }
    ),
    eventType: text("event_type").notNull(),
    action: text("action"),
    status: text("status").notNull().default("received"),
    deliveryId: text("delivery_id").notNull(),
    errorMessage: text("error_message"),
    payload: jsonb("payload").$type<JsonObject>(),
    payloadSummary: jsonb("payload_summary").$type<JsonObject>(),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
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
    index("github_webhook_events_repository_pr_idx").on(
      table.repositoryOwner,
      table.repositoryName,
      table.prNumber
    ),
    index("github_webhook_events_matched_feature_request_id_idx").on(
      table.matchedFeatureRequestId
    ),
    index("github_webhook_events_event_type_idx").on(table.eventType),
    index("github_webhook_events_status_idx").on(table.status),
    index("github_webhook_events_received_at_idx").on(table.receivedAt),
    index("github_webhook_events_processed_at_idx").on(table.processedAt),
    index("github_webhook_events_created_at_idx").on(table.createdAt)
  ]
);

export const githubProofPublications = pgTable(
  "github_proof_publications",
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
    qaReviewId: uuid("qa_review_id").references(() => qaReviews.id, {
      onDelete: "set null"
    }),
    githubCommentId: bigint("github_comment_id", { mode: "number" }),
    githubStatusContext: text("github_status_context"),
    lastPublishedCommitSha: text("last_published_commit_sha"),
    lastPublishStatus: text("last_publish_status").notNull().default("not_posted"),
    lastPublishError: text("last_publish_error"),
    coverageSnapshot:
      jsonb("coverage_snapshot").$type<JsonObject>().default({}).notNull(),
    publishedBy: uuid("published_by").references(() => appUsers.id, {
      onDelete: "set null"
    }),
    lastPublishedAt: timestamp("last_published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [
    uniqueIndex("github_proof_publications_feature_pr_unique").on(
      table.featureRequestId,
      table.pullRequestId
    ),
    index("github_proof_publications_organization_id_idx").on(
      table.organizationId
    ),
    index("github_proof_publications_feature_request_id_idx").on(
      table.featureRequestId
    ),
    index("github_proof_publications_pull_request_id_idx").on(
      table.pullRequestId
    ),
    index("github_proof_publications_qa_review_id_idx").on(table.qaReviewId),
    index("github_proof_publications_last_publish_status_idx").on(
      table.lastPublishStatus
    )
  ]
);
