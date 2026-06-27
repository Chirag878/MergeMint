import { and, eq } from "drizzle-orm";
import {
  db,
  featureRequests,
  githubAppInstallations,
  githubWebhookEvents,
  pullRequests,
  repositories,
  type JsonObject
} from "@veriflow/db";
import { syncLinkedPullRequestSnapshot } from "./github-pr-linking.service";

const SUPPORTED_PULL_REQUEST_ACTIONS = new Set([
  "opened",
  "reopened",
  "synchronize",
  "ready_for_review",
  "closed"
]);

type WebhookStatus = "processed" | "ignored" | "failed";

type GitHubWebhookHeaders = {
  eventName: string;
  deliveryId: string;
};

type GitHubWebhookPayload = {
  action?: string;
  repository?: {
    name?: string;
    full_name?: string;
    owner?: {
      login?: string;
    };
  };
  installation?: {
    id?: number;
    account?: {
      login?: string;
      id?: number;
      type?: string;
    };
    repository_selection?: string;
    permissions?: unknown;
    events?: unknown;
    suspended_at?: string | null;
  };
  repositories_added?: Array<{
    id?: number;
    name?: string;
    full_name?: string;
    private?: boolean;
  }>;
  repositories_removed?: Array<{
    id?: number;
    name?: string;
    full_name?: string;
  }>;
  pull_request?: {
    number?: number;
    title?: string;
    state?: string;
    merged?: boolean;
    draft?: boolean;
    user?: {
      login?: string;
    };
    html_url?: string;
    created_at?: string | null;
    closed_at?: string | null;
    merged_at?: string | null;
    mergeable_state?: string | null;
    head?: {
      ref?: string;
      sha?: string;
    };
    base?: {
      ref?: string;
    };
  };
  sender?: {
    login?: string;
  };
};

type PullRequestMatch = {
  pullRequest: typeof pullRequests.$inferSelect;
  repository: typeof repositories.$inferSelect;
  featureRequest: typeof featureRequests.$inferSelect;
};

function toJsonObject(value: unknown): JsonObject {
  return JSON.parse(JSON.stringify(value)) as JsonObject;
}

function toDate(value: string | null | undefined) {
  return value ? new Date(value) : null;
}

function getRepositoryOwner(payload: GitHubWebhookPayload) {
  return (
    payload.repository?.owner?.login ??
    payload.repository?.full_name?.split("/")[0] ??
    null
  );
}

function getRepositoryName(payload: GitHubWebhookPayload) {
  return payload.repository?.name ?? payload.repository?.full_name?.split("/")[1] ?? null;
}

function getPullRequestNumber(payload: GitHubWebhookPayload) {
  return payload.pull_request?.number ?? null;
}

function getInstallationId(payload: GitHubWebhookPayload) {
  return payload.installation?.id ?? null;
}

function getPrState(payload: GitHubWebhookPayload): "open" | "closed" | "merged" {
  if (payload.pull_request?.merged) {
    return "merged";
  }

  return payload.pull_request?.state === "closed" ? "closed" : "open";
}

function buildPayloadSummary(payload: GitHubWebhookPayload, result?: JsonObject) {
  const pullRequest = payload.pull_request;

  return toJsonObject({
    repository: {
      owner: getRepositoryOwner(payload),
      name: getRepositoryName(payload),
      fullName: payload.repository?.full_name ?? null
    },
    installation: {
      id: getInstallationId(payload),
      accountLogin: payload.installation?.account?.login ?? null,
      repositorySelection: payload.installation?.repository_selection ?? null
    },
    pullRequest: pullRequest
      ? {
          number: pullRequest.number ?? null,
          title: pullRequest.title ?? null,
          state: pullRequest.state ?? null,
          merged: pullRequest.merged ?? false,
          draft: pullRequest.draft ?? false,
          author: pullRequest.user?.login ?? null,
          headBranch: pullRequest.head?.ref ?? null,
          baseBranch: pullRequest.base?.ref ?? null,
          headSha: pullRequest.head?.sha ?? null
        }
      : null,
    sender: {
      login: payload.sender?.login ?? null
    },
    result: result ?? null
  });
}

async function updateWebhookEvent(input: {
  id: string;
  status: WebhookStatus;
  organizationId?: string | null;
  matchedFeatureRequestId?: string | null;
  errorMessage?: string | null;
  payloadSummary: JsonObject;
}) {
  await db
    .update(githubWebhookEvents)
    .set({
      status: input.status,
      organizationId: input.organizationId,
      matchedFeatureRequestId: input.matchedFeatureRequestId,
      errorMessage: input.errorMessage,
      payloadSummary: input.payloadSummary,
      processedAt: new Date()
    })
    .where(eq(githubWebhookEvents.id, input.id));
}

async function findLinkedPullRequests(input: {
  repositoryOwner: string;
  repositoryName: string;
  prNumber: number;
}) {
  return db
    .select({
      pullRequest: pullRequests,
      repository: repositories,
      featureRequest: featureRequests
    })
    .from(pullRequests)
    .innerJoin(repositories, eq(pullRequests.repositoryId, repositories.id))
    .innerJoin(featureRequests, eq(pullRequests.featureRequestId, featureRequests.id))
    .where(
      and(
        eq(repositories.owner, input.repositoryOwner),
        eq(repositories.name, input.repositoryName),
        eq(pullRequests.githubPrNumber, input.prNumber)
      )
    );
}

async function updateLinkedPullRequestState(
  match: PullRequestMatch,
  payload: GitHubWebhookPayload
) {
  const pullRequest = payload.pull_request;

  if (!pullRequest) {
    return;
  }

  await db
    .update(pullRequests)
    .set({
      title: pullRequest.title ?? match.pullRequest.title,
      author: pullRequest.user?.login ?? match.pullRequest.author,
      branch: pullRequest.head?.ref ?? match.pullRequest.branch,
      baseBranch: pullRequest.base?.ref ?? match.pullRequest.baseBranch,
      state: getPrState(payload),
      mergeStatus: pullRequest.mergeable_state ?? match.pullRequest.mergeStatus,
      latestCommitSha: pullRequest.head?.sha ?? match.pullRequest.latestCommitSha,
      htmlUrl: pullRequest.html_url ?? match.pullRequest.htmlUrl,
      openedAt: toDate(pullRequest.created_at) ?? match.pullRequest.openedAt,
      mergedAt: toDate(pullRequest.merged_at),
      closedAt: toDate(pullRequest.closed_at),
      updatedAt: new Date()
    })
    .where(eq(pullRequests.id, match.pullRequest.id));
}

async function getStoredInstallation(installationId: number | null) {
  if (!installationId) {
    return null;
  }

  const [installation] = await db
    .select()
    .from(githubAppInstallations)
    .where(eq(githubAppInstallations.installationId, installationId))
    .limit(1);

  return installation ?? null;
}

async function processInstallationEvent(payload: GitHubWebhookPayload) {
  const installationId = getInstallationId(payload);
  const storedInstallation = await getStoredInstallation(installationId);

  if (!storedInstallation || !installationId) {
    return {
      status: "ignored" as const,
      organizationId: null,
      result: "unmatched_installation"
    };
  }

  const suspendedAt =
    payload.action === "deleted"
      ? new Date()
      : payload.installation?.suspended_at
        ? new Date(payload.installation.suspended_at)
        : null;

  await db
    .update(githubAppInstallations)
    .set({
      accountLogin:
        payload.installation?.account?.login ?? storedInstallation.accountLogin,
      accountId: payload.installation?.account?.id ?? storedInstallation.accountId,
      accountType:
        payload.installation?.account?.type ?? storedInstallation.accountType,
      repositorySelection:
        payload.installation?.repository_selection ??
        storedInstallation.repositorySelection,
      permissions: payload.installation?.permissions
        ? toJsonObject(payload.installation.permissions)
        : storedInstallation.permissions,
      events: payload.installation?.events
        ? toJsonObject(payload.installation.events)
        : storedInstallation.events,
      suspendedAt,
      updatedAt: new Date()
    })
    .where(eq(githubAppInstallations.installationId, installationId));

  if (payload.action === "deleted" || payload.action === "suspend") {
    await db
      .update(repositories)
      .set({
        githubAppSelected: false,
        githubAppSyncedAt: new Date()
      })
      .where(eq(repositories.githubAppInstallationId, installationId));
  }

  return {
    status: "processed" as const,
    organizationId: storedInstallation.organizationId,
    result: "installation_updated"
  };
}

async function processInstallationRepositoriesEvent(payload: GitHubWebhookPayload) {
  const installationId = getInstallationId(payload);
  const storedInstallation = await getStoredInstallation(installationId);

  if (!storedInstallation || !installationId) {
    return {
      status: "ignored" as const,
      organizationId: null,
      result: "unmatched_installation"
    };
  }

  const now = new Date();
  for (const repository of payload.repositories_removed ?? []) {
    if (!repository.id) {
      continue;
    }

    await db
      .update(repositories)
      .set({
        githubAppSelected: false,
        githubAppSyncedAt: now
      })
      .where(
        and(
          eq(repositories.organizationId, storedInstallation.organizationId),
          eq(repositories.githubRepoId, String(repository.id))
        )
      );
  }

  for (const repository of payload.repositories_added ?? []) {
    if (!repository.id || !repository.full_name) {
      continue;
    }

    const [owner, name] = repository.full_name.split("/");

    if (!owner || !name) {
      continue;
    }

    await db
      .insert(repositories)
      .values({
        organizationId: storedInstallation.organizationId,
        githubRepoId: String(repository.id),
        githubAppInstallationId: installationId,
        owner,
        name,
        fullName: repository.full_name,
        defaultBranch: "main",
        isPrivate: repository.private ?? false,
        githubAppSelected: true,
        githubAppSyncedAt: now
      })
      .onConflictDoUpdate({
        target: [repositories.organizationId, repositories.fullName],
        set: {
          githubRepoId: String(repository.id),
          githubAppInstallationId: installationId,
          owner,
          name,
          isPrivate: repository.private ?? false,
          githubAppSelected: true,
          githubAppSyncedAt: now
        }
      });
  }

  return {
    status: "processed" as const,
    organizationId: storedInstallation.organizationId,
    result: "installation_repositories_updated"
  };
}

export async function processGitHubWebhook(
  headers: GitHubWebhookHeaders,
  payload: unknown
) {
  const typedPayload = payload as GitHubWebhookPayload;
  const repositoryOwner = getRepositoryOwner(typedPayload);
  const repositoryName = getRepositoryName(typedPayload);
  const prNumber = getPullRequestNumber(typedPayload);
  const installationId = getInstallationId(typedPayload);
  const action = typedPayload.action ?? null;

  const [eventRow] = await db
    .insert(githubWebhookEvents)
    .values({
      eventType: headers.eventName,
      deliveryId: headers.deliveryId,
      action,
      installationId,
      repositoryOwner,
      repositoryName,
      prNumber,
      status: "received",
      payloadSummary: buildPayloadSummary(typedPayload)
    })
    .onConflictDoNothing({
      target: githubWebhookEvents.deliveryId
    })
    .returning();

  if (!eventRow) {
    return {
      ok: true,
      duplicate: true as const
    };
  }

  try {
    if (headers.eventName === "ping") {
      const payloadSummary = buildPayloadSummary(typedPayload, {
        handled: "ping"
      });
      await updateWebhookEvent({
        id: eventRow.id,
        status: "processed",
        payloadSummary
      });

      return {
        ok: true,
        duplicate: false as const,
        status: "processed" as const,
        handled: "ping"
      };
    }

    if (headers.eventName === "installation") {
      const handled = await processInstallationEvent(typedPayload);
      await updateWebhookEvent({
        id: eventRow.id,
        status: handled.status,
        organizationId: handled.organizationId,
        payloadSummary: buildPayloadSummary(typedPayload, {
          handled: "installation",
          action,
          result: handled.result
        })
      });

      return {
        ok: true,
        duplicate: false as const,
        status: handled.status
      };
    }

    if (headers.eventName === "installation_repositories") {
      const handled = await processInstallationRepositoriesEvent(typedPayload);
      await updateWebhookEvent({
        id: eventRow.id,
        status: handled.status,
        organizationId: handled.organizationId,
        payloadSummary: buildPayloadSummary(typedPayload, {
          handled: "installation_repositories",
          action,
          result: handled.result
        })
      });

      return {
        ok: true,
        duplicate: false as const,
        status: handled.status
      };
    }

    if (headers.eventName !== "pull_request") {
      const payloadSummary = buildPayloadSummary(typedPayload, {
        ignoredReason: "unsupported_event"
      });
      await updateWebhookEvent({
        id: eventRow.id,
        status: "ignored",
        payloadSummary
      });

      return {
        ok: true,
        duplicate: false as const,
        status: "ignored" as const,
        ignoredReason: "unsupported_event"
      };
    }

    if (!action || !SUPPORTED_PULL_REQUEST_ACTIONS.has(action)) {
      const payloadSummary = buildPayloadSummary(typedPayload, {
        ignoredReason: "unsupported_pull_request_action"
      });
      await updateWebhookEvent({
        id: eventRow.id,
        status: "ignored",
        payloadSummary
      });

      return {
        ok: true,
        duplicate: false as const,
        status: "ignored" as const,
        ignoredReason: "unsupported_pull_request_action"
      };
    }

    if (!repositoryOwner || !repositoryName || !prNumber) {
      const payloadSummary = buildPayloadSummary(typedPayload, {
        ignoredReason: "missing_repository_or_pr"
      });
      await updateWebhookEvent({
        id: eventRow.id,
        status: "ignored",
        payloadSummary
      });

      return {
        ok: true,
        duplicate: false as const,
        status: "ignored" as const,
        ignoredReason: "missing_repository_or_pr"
      };
    }

    const matches = await findLinkedPullRequests({
      repositoryOwner,
      repositoryName,
      prNumber
    });

    if (matches.length === 0) {
      const payloadSummary = buildPayloadSummary(typedPayload, {
        ignoredReason: "unmatched_pull_request"
      });
      await updateWebhookEvent({
        id: eventRow.id,
        status: "ignored",
        payloadSummary
      });

      return {
        ok: true,
        duplicate: false as const,
        status: "ignored" as const,
        ignoredReason: "unmatched_pull_request"
      };
    }

    const syncResults: JsonObject[] = [];
    for (const match of matches) {
      if (action === "synchronize") {
        const syncResult = await syncLinkedPullRequestSnapshot({
          organizationId: match.pullRequest.organizationId,
          pullRequestId: match.pullRequest.id
        });
        syncResults.push(
          toJsonObject({
            featureRequestId: match.featureRequest.id,
            pullRequestId: syncResult.pullRequest.id,
            snapshotId: syncResult.latestSnapshot.snapshotId,
            commitSha: syncResult.latestSnapshot.commitSha,
            snapshotCreated: syncResult.newSnapshotCreated
          })
        );
      } else {
        await updateLinkedPullRequestState(match, typedPayload);
        syncResults.push(
          toJsonObject({
            featureRequestId: match.featureRequest.id,
            pullRequestId: match.pullRequest.id,
            stateUpdated: true
          })
        );
      }
    }

    const firstMatch = matches[0];
    const payloadSummary = buildPayloadSummary(typedPayload, {
      matchedPullRequests: matches.length,
      syncResults
    });
    await updateWebhookEvent({
      id: eventRow.id,
      status: "processed",
      organizationId: firstMatch?.pullRequest.organizationId,
      matchedFeatureRequestId: firstMatch?.featureRequest.id,
      payloadSummary
    });

    return {
      ok: true,
      duplicate: false as const,
      status: "processed" as const,
      matchedPullRequests: matches.length
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "GitHub webhook processing failed.";
    await updateWebhookEvent({
      id: eventRow.id,
      status: "failed",
      errorMessage,
      payloadSummary: buildPayloadSummary(typedPayload, {
        error: errorMessage
      })
    });

    return {
      ok: true,
      duplicate: false as const,
      status: "failed" as const
    };
  }
}
