import { and, eq } from "drizzle-orm";
import {
  db,
  featureRequests,
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

export async function processGitHubWebhook(
  headers: GitHubWebhookHeaders,
  payload: unknown
) {
  const typedPayload = payload as GitHubWebhookPayload;
  const repositoryOwner = getRepositoryOwner(typedPayload);
  const repositoryName = getRepositoryName(typedPayload);
  const prNumber = getPullRequestNumber(typedPayload);
  const action = typedPayload.action ?? null;

  const [eventRow] = await db
    .insert(githubWebhookEvents)
    .values({
      eventType: headers.eventName,
      deliveryId: headers.deliveryId,
      action,
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
