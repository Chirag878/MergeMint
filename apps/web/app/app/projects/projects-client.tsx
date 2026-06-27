"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { trpc } from "@/trpc/react";

export function ProjectsClient() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const projects = trpc.projects.list.useQuery();
  const clients = trpc.clients.listBasic.useQuery();
  const createProject = trpc.projects.create.useMutation({
    onSuccess: (project) => {
      utils.projects.list.setData(undefined, (current) =>
        current ? [project, ...current] : [project]
      );
      setName("");
      setDescription("");
      setClientName("");
      setClientId("");
      setSuccess("Project created.");
      router.push(`/app/features?projectId=${project.id}`);
      if (project.clientId) {
        void utils.clients.getDeliveryLedger.invalidate({
          clientId: project.clientId
        });
        void utils.clients.list.invalidate();
      }
      void utils.dashboard.getSummary.invalidate();
      void utils.projects.list.invalidate();
    }
  });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientId, setClientId] = useState("");
  const [success, setSuccess] = useState<string | null>(null);

  const canSubmit = name.trim().length >= 2 && !createProject.isPending;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }

    setSuccess(null);
    createProject.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
      clientName: clientName.trim() || undefined,
      clientId: clientId || undefined
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <div className="space-y-6">
        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-lg border border-neutral-800 bg-neutral-900 p-5"
        >
        <div>
          <h2 className="text-lg font-medium">Create Project</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Add a workspace-scoped project for upcoming releases.
          </p>
        </div>

        <label className="block text-sm">
          <span className="text-neutral-300">Name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-2 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none transition focus:border-blue-500"
            placeholder="Mobile checkout"
            minLength={2}
            required
          />
        </label>

        <label className="block text-sm">
          <span className="text-neutral-300">Client ledger</span>
          <select
            value={clientId}
            onChange={(event) => setClientId(event.target.value)}
            className="mt-2 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none transition focus:border-blue-500"
          >
            <option value="">No client ledger</option>
            {clients.data?.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="text-neutral-300">Legacy client label</span>
          <input
            value={clientName}
            onChange={(event) => setClientName(event.target.value)}
            className="mt-2 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none transition focus:border-blue-500"
            placeholder="Optional display label"
          />
        </label>

        {clients.error ? (
          <p className="text-sm text-red-300">{clients.error.message}</p>
        ) : null}

        <label className="block text-sm">
          <span className="text-neutral-300">Description</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="mt-2 min-h-28 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none transition focus:border-blue-500"
            placeholder="Release workflow, scope, or notes"
          />
        </label>

        {createProject.error ? (
          <p className="text-sm text-red-300">{createProject.error.message}</p>
        ) : null}
        {success ? <p className="text-sm text-emerald-300">{success}</p> : null}

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {createProject.isPending ? "Creating..." : "Create Project"}
        </button>
        </form>

        <ProjectSetupPanel projects={projects.data ?? []} />
      </div>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-medium">Project list</h2>
          <Link
            href="/app/features"
            className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-100 transition hover:border-neutral-500"
          >
            Create Feature Request
          </Link>
        </div>

        {projects.isLoading ? (
          <p className="mt-6 text-sm text-neutral-400">Loading...</p>
        ) : null}

        {projects.error ? (
          <p className="mt-6 text-sm text-red-300">{projects.error.message}</p>
        ) : null}

        {!projects.isLoading && !projects.error && projects.data?.length === 0 ? (
          <div className="mt-6 rounded-md border border-neutral-800 bg-neutral-950 p-5 text-sm text-neutral-400">
            No projects yet. Create your first project to start verifying
            releases.
          </div>
        ) : null}

        <div className="mt-5 space-y-3">
          {projects.data?.map((project) => (
            <article
              key={project.id}
              className="rounded-md border border-neutral-800 bg-neutral-950 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-medium text-neutral-100">{project.name}</h3>
                  {project.clientName ? (
                    <p className="mt-1 text-sm text-blue-300">
                      {project.clientName}
                    </p>
                  ) : null}
                </div>
                <span className="rounded-full border border-neutral-700 px-2.5 py-1 text-xs text-neutral-300">
                  {project.status}
                </span>
              </div>
              {project.description ? (
                <p className="mt-3 text-sm text-neutral-400">
                  {project.description}
                </p>
              ) : null}
              <p className="mt-3 text-xs text-neutral-500">
                Created {new Date(project.createdAt).toLocaleDateString()}
              </p>
              <Link
                href={`/app/features?projectId=${project.id}`}
                className="mt-4 inline-flex rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-100 transition hover:border-neutral-500"
              >
                Create Feature Request
              </Link>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function ProjectSetupPanel({
  projects
}: {
  projects: Array<{
    id: string;
    name: string;
  }>;
}) {
  const utils = trpc.useUtils();
  const installations = trpc.githubApp.getInstallations.useQuery();
  const [projectId, setProjectId] = useState("");
  const [installationIdText, setInstallationIdText] = useState("");
  const [repositoryId, setRepositoryId] = useState("");
  const projectSetup = trpc.guidedWorkflow.getProjectSetup.useQuery(
    {
      projectId: projectId || undefined
    },
    {
      enabled: projects.length > 0
    }
  );
  const installationId = installationIdText ? Number(installationIdText) : null;
  const repositories = trpc.githubApp.listInstallationRepositories.useQuery(
    {
      installationId: installationId ?? 0
    },
    {
      enabled: Boolean(installationId)
    }
  );
  const projectIntegration = trpc.githubApp.getProjectIntegration.useQuery(
    {
      projectId
    },
    {
      enabled: Boolean(projectId)
    }
  );
  const syncRepositories =
    trpc.githubApp.syncInstallationRepositories.useMutation({
      onSuccess: async (synced) => {
        await utils.githubApp.listInstallationRepositories.invalidate();
        await utils.guidedWorkflow.getProjectSetup.invalidate();
        if (synced[0]) {
          setRepositoryId(synced[0].id);
        }
      }
    });
  const connectRepository =
    trpc.githubApp.connectRepositoryToProject.useMutation({
      onSuccess: async () => {
        await utils.githubApp.getProjectIntegration.invalidate();
        await utils.githubApp.listInstallationRepositories.invalidate();
        await utils.guidedWorkflow.getProjectSetup.invalidate();
      }
    });
  const disconnectRepository =
    trpc.githubApp.disconnectRepositoryFromProject.useMutation({
      onSuccess: async () => {
        setRepositoryId("");
        await utils.githubApp.getProjectIntegration.invalidate();
        await utils.guidedWorkflow.getProjectSetup.invalidate();
      }
    });

  const activeInstallation = useMemo(
    () =>
      installations.data?.find(
        (installation) => installation.installationId === installationId
      ) ?? null,
    [installationId, installations.data]
  );
  const connectedRepository = projectIntegration.data?.repository ?? null;
  const canConnect =
    Boolean(projectId && repositoryId) && !connectRepository.isPending;

  useEffect(() => {
    if (!projectId && projects[0]) {
      setProjectId(projects[0].id);
    }
  }, [projectId, projects]);

  useEffect(() => {
    if (!installationIdText && installations.data?.[0]) {
      setInstallationIdText(String(installations.data[0].installationId));
    }
  }, [installationIdText, installations.data]);

  useEffect(() => {
    if (!repositoryId && connectedRepository) {
      setRepositoryId(connectedRepository.id);
    }
  }, [connectedRepository, repositoryId]);

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
      <div>
        <h2 className="text-lg font-medium">Project setup</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Connect the repository this project ships from before creating release
          proof.
        </p>
      </div>

      {projectSetup.data ? (
        <div className="mt-4 rounded-md border border-neutral-800 bg-neutral-950 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-medium text-neutral-100">
                {projectSetup.data.title}
              </p>
              <p className="mt-1 text-sm text-neutral-500">
                {projectSetup.data.description}
              </p>
            </div>
            <span className="rounded-full border border-neutral-700 px-2.5 py-1 text-xs text-neutral-300">
              {projectSetup.data.completionPercentage}%
            </span>
          </div>
          <div className="mt-4 grid gap-2">
            {projectSetup.data.steps.map((step) => (
              <div
                key={step.id}
                className="flex items-center justify-between rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm"
              >
                <span className="text-neutral-200">{step.label}</span>
                <span className="text-xs text-neutral-500">{step.status}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href="/app/settings/github"
          className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-100 transition hover:border-neutral-500"
        >
          Workspace GitHub settings
        </Link>
        {installationId ? (
          <button
            type="button"
            onClick={() =>
              syncRepositories.mutate({
                installationId
              })
            }
            disabled={syncRepositories.isPending}
            className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-100 transition hover:border-neutral-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {syncRepositories.isPending ? "Syncing..." : "Sync repositories"}
          </button>
        ) : null}
      </div>

      {installations.isLoading ? (
        <p className="mt-4 text-sm text-neutral-500">Loading installations...</p>
      ) : null}

      {installations.data?.length === 0 ? (
        <p className="mt-4 rounded-md border border-neutral-800 bg-neutral-950 p-3 text-sm text-neutral-400">
          Not connected. Install the GitHub App, then return here to sync
          repositories.
        </p>
      ) : null}

      <div className="mt-4 space-y-3">
        <label className="block text-sm">
          <span className="text-neutral-300">Project</span>
          <select
            value={projectId}
            onChange={(event) => {
              setProjectId(event.target.value);
              setRepositoryId("");
            }}
            className="mt-2 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none transition focus:border-blue-500"
          >
            <option value="">Select a project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="text-neutral-300">Installation</span>
          <select
            value={installationIdText}
            onChange={(event) => {
              setInstallationIdText(event.target.value);
              setRepositoryId("");
            }}
            className="mt-2 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none transition focus:border-blue-500"
          >
            <option value="">No installation</option>
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
          <div className="rounded-md border border-neutral-800 bg-neutral-950 p-3 text-sm text-neutral-400">
            <p>Status: {activeInstallation.suspendedAt ? "Suspended" : "Installed"}</p>
            <p>Repository access: {activeInstallation.repositorySelection ?? "selected"}</p>
          </div>
        ) : null}

        <label className="block text-sm">
          <span className="text-neutral-300">Repository</span>
          <select
            value={repositoryId}
            onChange={(event) => setRepositoryId(event.target.value)}
            disabled={!installationId || repositories.isLoading}
            className="mt-2 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none transition focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">
              {repositories.isLoading ? "Loading repositories..." : "Select repo"}
            </option>
            {repositories.data?.map((repository) => (
              <option key={repository.id} value={repository.id}>
                {repository.fullName}
              </option>
            ))}
          </select>
        </label>

        {connectedRepository ? (
          <p className="rounded-md border border-emerald-900/60 bg-emerald-950/25 p-3 text-sm text-emerald-200">
            Repo selected: {connectedRepository.fullName}
          </p>
        ) : projectId ? (
          <p className="rounded-md border border-neutral-800 bg-neutral-950 p-3 text-sm text-neutral-400">
            Installed, no repo selected for this project.
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              connectRepository.mutate({
                projectId,
                repositoryId
              })
            }
            disabled={!canConnect}
            className="rounded-md bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {connectRepository.isPending ? "Connecting..." : "Connect repo"}
          </button>
          {connectedRepository ? (
            <button
              type="button"
              onClick={() =>
                disconnectRepository.mutate({
                  projectId
                })
              }
              disabled={disconnectRepository.isPending}
              className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-100 transition hover:border-neutral-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {disconnectRepository.isPending ? "Disconnecting..." : "Disconnect"}
            </button>
          ) : null}
        </div>

        {syncRepositories.error ? (
          <p className="text-sm text-red-300">{syncRepositories.error.message}</p>
        ) : null}
        {connectRepository.error ? (
          <p className="text-sm text-red-300">{connectRepository.error.message}</p>
        ) : null}
        {disconnectRepository.error ? (
          <p className="text-sm text-red-300">
            {disconnectRepository.error.message}
          </p>
        ) : null}
      </div>
    </section>
  );
}
