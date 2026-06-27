"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { trpc } from "@/trpc/react";

export function GitHubSettingsClient() {
  const utils = trpc.useUtils();
  const installLink = trpc.githubApp.getInstallLink.useQuery();
  const installations = trpc.githubApp.getInstallations.useQuery();
  const [selectedInstallationId, setSelectedInstallationId] = useState<
    number | null
  >(null);
  const activeInstallationId =
    selectedInstallationId ?? installations.data?.[0]?.installationId ?? null;
  const repositories = trpc.githubApp.listInstallationRepositories.useQuery(
    {
      installationId: activeInstallationId ?? 0
    },
    {
      enabled: Boolean(activeInstallationId)
    }
  );
  const syncRepositories =
    trpc.githubApp.syncInstallationRepositories.useMutation({
      onSuccess: async () => {
        await Promise.all([
          utils.githubApp.getInstallations.invalidate(),
          utils.githubApp.listInstallationRepositories.invalidate(),
          utils.guidedWorkflow.getWorkspaceSetup.invalidate(),
          utils.projects.list.invalidate(),
          utils.dashboard.getSummary.invalidate(),
          utils.releaseBoard.getBoard.invalidate()
        ]);
      }
    });
  const activeInstallation = useMemo(
    () =>
      installations.data?.find(
        (installation) => installation.installationId === activeInstallationId
      ) ?? null,
    [activeInstallationId, installations.data]
  );

  const connected = (installations.data?.length ?? 0) > 0;
  const repoCount = repositories.data?.length ?? 0;
  const primaryLabel = !connected
    ? "Install GitHub App"
    : repoCount === 0
      ? "Sync repositories"
      : "Sync repositories";

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
      <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-medium">Workspace GitHub connection</h2>
            <p className="mt-1 text-sm text-neutral-500">
              MergeMint only accesses repositories selected during GitHub App
              installation.
            </p>
          </div>
          <StatusBadge>
            {!connected
              ? "Not connected"
              : repoCount === 0
                ? "Installed, no repos synced"
                : "Repo synced"}
          </StatusBadge>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {!connected ? (
            installLink.data?.installUrl ? (
              <a
                href={installLink.data.installUrl}
                className="rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-950 transition hover:bg-white"
              >
                {primaryLabel}
              </a>
            ) : (
              <p className="rounded-md border border-amber-800 bg-amber-950/30 px-3 py-2 text-sm text-amber-200">
                GitHub App env is not configured.
              </p>
            )
          ) : activeInstallationId ? (
            <button
              type="button"
              onClick={() =>
                syncRepositories.mutate({
                  installationId: activeInstallationId
                })
              }
              disabled={syncRepositories.isPending}
              className="rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {syncRepositories.isPending ? "Syncing..." : primaryLabel}
            </button>
          ) : null}
          {activeInstallation ? (
            <a
              href={`https://github.com/settings/installations/${activeInstallation.installationId}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-neutral-700 px-4 py-2 text-sm text-neutral-100 transition hover:border-neutral-500"
            >
              Manage installation
            </a>
          ) : null}
          <Link
            href="/app/projects"
            className="rounded-md border border-neutral-700 px-4 py-2 text-sm text-neutral-100 transition hover:border-neutral-500"
          >
            Back to projects
          </Link>
        </div>

        {syncRepositories.error ? (
          <p className="mt-4 text-sm text-red-300">
            {syncRepositories.error.message}
          </p>
        ) : null}
      </section>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
        <h2 className="text-lg font-medium">Connection details</h2>
        {installations.isLoading ? (
          <p className="mt-4 text-sm text-neutral-500">Loading installations...</p>
        ) : null}
        {!connected && !installations.isLoading ? (
          <p className="mt-4 rounded-md border border-neutral-800 bg-neutral-950 p-4 text-sm text-neutral-400">
            Connect GitHub so MergeMint can verify PRs against requirements.
          </p>
        ) : null}
        {connected ? (
          <div className="mt-4 space-y-3">
            <label className="block text-sm">
              <span className="text-neutral-300">Installation</span>
              <select
                value={String(activeInstallationId ?? "")}
                onChange={(event) =>
                  setSelectedInstallationId(
                    event.target.value ? Number(event.target.value) : null
                  )
                }
                className="mt-2 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none transition focus:border-blue-500"
              >
                {installations.data?.map((installation) => (
                  <option
                    key={installation.id}
                    value={String(installation.installationId)}
                  >
                    {installation.accountLogin}
                  </option>
                ))}
              </select>
            </label>
            {activeInstallation ? (
              <div className="rounded-md border border-neutral-800 bg-neutral-950 p-4 text-sm text-neutral-400">
                <p>Account: {activeInstallation.accountLogin}</p>
                <p>
                  Status:{" "}
                  {activeInstallation.suspendedAt ? "Suspended" : "Installed"}
                </p>
                <p>
                  Repository access:{" "}
                  {activeInstallation.repositorySelection ?? "selected"}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-5 lg:col-span-2">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-medium">Synced repositories</h2>
            <p className="mt-1 text-sm text-neutral-500">
              These are the repositories available for project-level selection.
            </p>
          </div>
          <StatusBadge>{repoCount} synced</StatusBadge>
        </div>

        {repositories.isLoading ? (
          <p className="mt-4 text-sm text-neutral-500">Loading repositories...</p>
        ) : null}
        {!repositories.isLoading && connected && repoCount === 0 ? (
          <p className="mt-4 rounded-md border border-neutral-800 bg-neutral-950 p-4 text-sm text-neutral-400">
            No repositories synced yet. Sync repositories to choose the
            repository a project ships from.
          </p>
        ) : null}
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {repositories.data?.map((repository) => (
            <article
              key={repository.id}
              className="rounded-md border border-neutral-800 bg-neutral-950 p-4"
            >
              <p className="font-medium text-neutral-100">
                {repository.fullName}
              </p>
              <p className="mt-2 text-sm text-neutral-500">
                Default branch: {repository.defaultBranch}
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatusBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-neutral-700 px-2.5 py-1 text-xs text-neutral-300">
      {children}
    </span>
  );
}
