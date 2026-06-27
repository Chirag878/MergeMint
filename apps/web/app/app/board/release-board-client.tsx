"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/trpc/react";

type BoardStage = "pending" | "ongoing" | "completing" | "shipped";

const columns: Array<{
  id: BoardStage;
  title: string;
  copy: string;
}> = [
  {
    id: "pending",
    title: "Pending",
    copy: "Waiting for PRD, tasks, or a clear start."
  },
  {
    id: "ongoing",
    title: "Ongoing",
    copy: "PRD/tasks ready, development or PR linking in progress."
  },
  {
    id: "completing",
    title: "Completing",
    copy: "QA, approval, fixes, or report generation."
  },
  {
    id: "shipped",
    title: "Shipped",
    copy: "Approved and reported releases."
  }
];

export function ReleaseBoardClient() {
  const utils = trpc.useUtils();
  const [projectId, setProjectId] = useState("");
  const [clientId, setClientId] = useState("");
  const board = trpc.releaseBoard.getBoard.useQuery({
    projectId: projectId || undefined,
    clientId: clientId || undefined
  });
  const moveFeature = trpc.releaseBoard.updateFeatureStage.useMutation({
    onSuccess: async () => {
      await utils.releaseBoard.getBoard.invalidate();
      await utils.dashboard.getSummary.invalidate();
      await utils.projects.list.invalidate();
    },
    onError: (error, variables) => {
      if (
        variables.stage === "shipped" &&
        error.data?.code === "PRECONDITION_FAILED" &&
        window.confirm(
          "This feature does not have approval and a generated report yet. Mark shipped anyway?"
        )
      ) {
        moveFeature.mutate({
          ...variables,
          overrideUnsafe: true
        });
      }
    }
  });

  if (board.isLoading) {
    return (
      <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-5 text-sm text-neutral-400">
        Loading release board...
      </div>
    );
  }

  if (board.error || !board.data) {
    return (
      <div className="rounded-lg border border-red-900/60 bg-red-950/30 p-5 text-sm text-red-200">
        {board.error?.message ?? "Unable to load release board."}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-medium">Board filters</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Filter by project or client while preserving project-scoped feature
              ownership.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[520px]">
            <label className="block text-sm">
              <span className="text-neutral-300">Project</span>
              <select
                value={projectId}
                onChange={(event) => setProjectId(event.target.value)}
                className="mt-2 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none transition focus:border-blue-500"
              >
                <option value="">All active projects</option>
                {board.data.filters.projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-neutral-300">Client</span>
              <select
                value={clientId}
                onChange={(event) => setClientId(event.target.value)}
                className="mt-2 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none transition focus:border-blue-500"
              >
                <option value="">All clients</option>
                {board.data.filters.clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <BoardStat label="Pending" value={board.data.summary.pending} />
          <BoardStat label="Ongoing" value={board.data.summary.ongoing} />
          <BoardStat label="Completing" value={board.data.summary.completing} />
          <BoardStat label="Shipped" value={board.data.summary.shipped} />
          <BoardStat
            label="Needs attention"
            value={board.data.summary.needsAttention}
          />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-4">
        {columns.map((column) => {
          const cards = board.data.columns[column.id];

          return (
            <div
              key={column.id}
              className="rounded-lg border border-neutral-800 bg-neutral-900 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-medium text-neutral-100">
                    {column.title}
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-neutral-500">
                    {column.copy}
                  </p>
                </div>
                <span className="rounded-full border border-neutral-700 px-2.5 py-1 text-xs text-neutral-300">
                  {cards.length}
                </span>
              </div>

              <div className="mt-4 space-y-3">
                {cards.length === 0 ? (
                  <div className="rounded-md border border-neutral-800 bg-neutral-950 p-4 text-sm text-neutral-500">
                    No features here.
                  </div>
                ) : null}

                {cards.map((card) => (
                  <article
                    key={card.id}
                    className="rounded-md border border-neutral-800 bg-neutral-950 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-medium text-neutral-100">
                          {card.title}
                        </h3>
                        <p className="mt-1 text-sm text-neutral-500">
                          {card.projectName}
                          {card.clientName ? ` - ${card.clientName}` : ""}
                        </p>
                      </div>
                      <StageChip stage={card.stage} />
                    </div>

                    <div className="mt-3 space-y-2 text-sm text-neutral-400">
                      <p>{card.workflowState}</p>
                      <p>Next: {card.nextAction}</p>
                      <p>Repo: {card.repositoryFullName ?? "Not connected"}</p>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <SmallBadge>
                        PR {card.prNumber ? `#${card.prNumber}` : "not linked"}
                      </SmallBadge>
                      <SmallBadge>QA {card.qaVerdict ?? "not run"}</SmallBadge>
                      <SmallBadge>
                        Approval {card.approvalDecision ?? "pending"}
                      </SmallBadge>
                      <SmallBadge>Report {card.reportState ?? "missing"}</SmallBadge>
                      {card.blockedTasks > 0 ? (
                        <RiskBadge>{card.blockedTasks} blocked</RiskBadge>
                      ) : null}
                      {card.highRiskTasks > 0 ? (
                        <RiskBadge>{card.highRiskTasks} high risk</RiskBadge>
                      ) : null}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link
                        href={`/app/features/${card.id}`}
                        className="rounded-md bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-950 transition hover:bg-white"
                      >
                        Open feature
                      </Link>
                      <select
                        value={card.storedStage}
                        onChange={(event) =>
                          moveFeature.mutate({
                            featureRequestId: card.id,
                            stage: event.target.value as BoardStage
                          })
                        }
                        disabled={moveFeature.isPending}
                        className="rounded-md border border-neutral-700 bg-neutral-950 px-2 py-2 text-sm text-neutral-100 outline-none transition focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="pending">Move to Pending</option>
                        <option value="ongoing">Move to Ongoing</option>
                        <option value="completing">Move to Completing</option>
                        <option value="shipped">Mark Shipped</option>
                      </select>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}

function BoardStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-neutral-800 bg-neutral-950 p-3">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-neutral-100">{value}</p>
    </div>
  );
}

function StageChip({ stage }: { stage: BoardStage }) {
  return (
    <span className="rounded-full border border-blue-800 bg-blue-950/25 px-2.5 py-1 text-xs text-blue-200">
      {stage}
    </span>
  );
}

function SmallBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-neutral-700 px-2.5 py-1 text-xs text-neutral-300">
      {children}
    </span>
  );
}

function RiskBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-amber-800 bg-amber-950/30 px-2.5 py-1 text-xs text-amber-200">
      {children}
    </span>
  );
}
