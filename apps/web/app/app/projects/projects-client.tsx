"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { trpc } from "@/trpc/react";

export function ProjectsClient({
  initialProjectId
}: {
  initialProjectId?: string;
}) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const projects = trpc.projects.list.useQuery();
  const clients = trpc.clients.listBasic.useQuery();
  const githubInstallations = trpc.githubApp.getInstallations.useQuery();
  const [creationMode, setCreationMode] = useState<"github" | "manual">("github");
  const [installationIdText, setInstallationIdText] = useState("");
  const selectedInstallationId = installationIdText
    ? Number(installationIdText)
    : (githubInstallations.data?.[0]?.installationId ?? null);
  const syncedRepositories = trpc.githubApp.listInstallationRepositories.useQuery(
    {
      installationId: selectedInstallationId ?? 0
    },
    {
      enabled: Boolean(selectedInstallationId)
    }
  );
  const createProject = trpc.projects.create.useMutation({
    onSuccess: (project) => {
      const connectedRepository =
        creationMode === "github"
          ? syncedRepositories.data?.find((repository) => repository.id === repositoryId) ??
            null
          : null;
      const projectListItem = {
        ...project,
        connectedRepository,
        repositoryAnalyzed: false,
        activeFeatureCount: 0,
        featuresNeedingAction: 0,
        latestReleaseState: connectedRepository ? "repo_connected" : "setup"
      };
      utils.projects.list.setData(undefined, (current) =>
        current ? [projectListItem, ...current] : [projectListItem]
      );
      setName("");
      setDescription("");
      setClientName("");
      setClientId("");
      setRepositoryId("");
      setSuccess("Project created.");
      router.push(`/app/projects?projectId=${project.id}`);
      if (project.clientId) {
        void utils.clients.getDeliveryLedger.invalidate({
          clientId: project.clientId
        });
        void utils.clients.list.invalidate();
      }
      void utils.dashboard.getSummary.invalidate();
      void utils.projects.list.invalidate();
      void utils.releaseBoard.getBoard.invalidate();
    }
  });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientId, setClientId] = useState("");
  const [repositoryId, setRepositoryId] = useState("");
  const [success, setSuccess] = useState<string | null>(null);
  const updateProjectStatus = trpc.projects.updateStatus.useMutation({
    onSuccess: async () => {
      await utils.projects.list.invalidate();
      await utils.dashboard.getSummary.invalidate();
      await utils.releaseBoard.getBoard.invalidate();
    },
    onError: (error, variables) => {
      if (
        variables.status === "completed" &&
        error.data?.code === "PRECONDITION_FAILED" &&
        window.confirm(
          "This project still has unresolved release items. Mark complete anyway?"
        )
      ) {
        updateProjectStatus.mutate({
          ...variables,
          overrideUnresolved: true
        });
      }
    }
  });

  const githubInstalled = (githubInstallations.data?.length ?? 0) > 0;
  const canSubmit =
    name.trim().length >= 2 &&
    !createProject.isPending &&
    (creationMode === "manual" || Boolean(repositoryId));

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
      clientId: clientId || undefined,
      repositoryId: creationMode === "github" ? repositoryId : undefined
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
            Start from a synced GitHub repository, or create manually and connect
            the repo later.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-md border border-neutral-800 bg-neutral-950 p-1">
          <button
            type="button"
            onClick={() => setCreationMode("github")}
            className={
              creationMode === "github"
                ? "rounded-md bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-950"
                : "rounded-md px-3 py-2 text-sm font-medium text-neutral-400 transition hover:text-neutral-100"
            }
          >
            From GitHub repo
          </button>
          <button
            type="button"
            onClick={() => setCreationMode("manual")}
            className={
              creationMode === "manual"
                ? "rounded-md bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-950"
                : "rounded-md px-3 py-2 text-sm font-medium text-neutral-400 transition hover:text-neutral-100"
            }
          >
            Manual
          </button>
        </div>

        {creationMode === "github" ? (
          <div className="space-y-3 rounded-md border border-neutral-800 bg-neutral-950 p-4">
            {!githubInstalled && !githubInstallations.isLoading ? (
              <div>
                <p className="text-sm text-neutral-400">
                  Connect GitHub first so MergeMint can create a project from a
                  selected repository.
                </p>
                <Link
                  href="/app/settings/github"
                  className="mt-3 inline-flex rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-100 transition hover:border-neutral-500"
                >
                  Connect GitHub first
                </Link>
              </div>
            ) : null}

            {githubInstalled ? (
              <>
                <label className="block text-sm">
                  <span className="text-neutral-300">GitHub installation</span>
                  <select
                    value={String(selectedInstallationId ?? "")}
                    onChange={(event) => {
                      setInstallationIdText(event.target.value);
                      setRepositoryId("");
                    }}
                    className="mt-2 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none transition focus:border-blue-500"
                  >
                    {githubInstallations.data?.map((installation) => (
                      <option
                        key={installation.id}
                        value={String(installation.installationId)}
                      >
                        {installation.accountLogin}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-sm">
                  <span className="text-neutral-300">Synced repository</span>
                  <select
                    value={repositoryId}
                    onChange={(event) => {
                      setRepositoryId(event.target.value);
                      const repository = syncedRepositories.data?.find(
                        (item) => item.id === event.target.value
                      );
                      if (repository && !name) {
                        setName(repository.name);
                      }
                    }}
                    disabled={syncedRepositories.isLoading}
                    className="mt-2 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none transition focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">
                      {syncedRepositories.isLoading
                        ? "Loading repositories..."
                        : "Select repository"}
                    </option>
                    {syncedRepositories.data?.map((repository) => (
                      <option key={repository.id} value={repository.id}>
                        {repository.fullName}
                      </option>
                    ))}
                  </select>
                </label>

                {!syncedRepositories.isLoading &&
                syncedRepositories.data?.length === 0 ? (
                  <div>
                    <p className="text-sm text-neutral-400">
                      Sync repositories first, then create a project from the
                      repository this work ships from.
                    </p>
                    <Link
                      href="/app/settings/github"
                      className="mt-3 inline-flex rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-100 transition hover:border-neutral-500"
                    >
                      Sync repositories first
                    </Link>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}

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

        <ProjectSetupPanel
          projects={projects.data ?? []}
          initialProjectId={initialProjectId}
        />
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
          {projects.data?.map((project) => {
            const projectCta = getProjectPrimaryCta(project, {
              githubInstalled: (githubInstallations.data?.length ?? 0) > 0
            });

            return (
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
                  <p className="mt-2 text-sm text-neutral-500">
                    Repo: {project.connectedRepository?.fullName ?? "Not connected"}
                  </p>
                </div>
                <span className="rounded-full border border-neutral-700 px-2.5 py-1 text-xs text-neutral-300">
                  {formatProjectState(project.latestReleaseState)}
                </span>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <ProjectMetric label="Active features" value={project.activeFeatureCount ?? 0} />
                <ProjectMetric label="Needs action" value={project.featuresNeedingAction ?? 0} />
                <ProjectMetric
                  label="Repo analysis"
                  value={project.repositoryAnalyzed ? "Ready" : "Missing"}
                />
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
                href={projectCta.href}
                className="mt-4 inline-flex rounded-md bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-950 transition hover:bg-white"
              >
                {projectCta.label}
              </Link>
              <div className="mt-3 flex flex-wrap gap-2">
                {project.status === "completed" ? (
                  <button
                    type="button"
                    onClick={() =>
                      updateProjectStatus.mutate({
                        projectId: project.id,
                        status: "active"
                      })
                    }
                    disabled={updateProjectStatus.isPending}
                    className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-100 transition hover:border-neutral-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Reopen project
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      updateProjectStatus.mutate({
                        projectId: project.id,
                        status: "completed"
                      })
                    }
                    disabled={updateProjectStatus.isPending}
                    className="rounded-md border border-neutral-800 px-3 py-2 text-sm text-neutral-400 transition hover:border-neutral-600 hover:text-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Mark completed
                  </button>
                )}
              </div>
            </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function ProjectSetupPanel({
  projects,
  initialProjectId
}: {
  projects: Array<{
    id: string;
    name: string;
  }>;
  initialProjectId?: string;
}) {
  const utils = trpc.useUtils();
  const installations = trpc.githubApp.getInstallations.useQuery();
  const [projectId, setProjectId] = useState("");
  const [installationIdText, setInstallationIdText] = useState("");
  const [repositoryId, setRepositoryId] = useState("");
  const [showAnalysisDetails, setShowAnalysisDetails] = useState(false);
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
  const latestAnalysis = trpc.repositoryIntelligence.getLatestByProject.useQuery(
    {
      projectId
    },
    {
      enabled: Boolean(projectId)
    }
  );
  const taskSummary = trpc.engineeringTasks.getProjectSummary.useQuery(
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
        await utils.projects.list.invalidate();
        await utils.dashboard.getSummary.invalidate();
        await utils.releaseBoard.getBoard.invalidate();
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
        await utils.repositoryIntelligence.getLatestByProject.invalidate();
        await utils.projects.list.invalidate();
        await utils.dashboard.getSummary.invalidate();
        await utils.releaseBoard.getBoard.invalidate();
      }
    });
  const disconnectRepository =
    trpc.githubApp.disconnectRepositoryFromProject.useMutation({
      onSuccess: async () => {
        setRepositoryId("");
        setShowAnalysisDetails(false);
        await utils.githubApp.getProjectIntegration.invalidate();
        await utils.guidedWorkflow.getProjectSetup.invalidate();
        await utils.repositoryIntelligence.getLatestByProject.invalidate();
        await utils.projects.list.invalidate();
        await utils.dashboard.getSummary.invalidate();
        await utils.releaseBoard.getBoard.invalidate();
      }
    });
  const analyzeRepository =
    trpc.repositoryIntelligence.analyzeProjectRepository.useMutation({
      onSuccess: async () => {
        await utils.repositoryIntelligence.getLatestByProject.invalidate({
          projectId
        });
        await utils.guidedWorkflow.getProjectSetup.invalidate();
        await utils.projects.list.invalidate();
        await utils.dashboard.getSummary.invalidate();
        await utils.releaseBoard.getBoard.invalidate();
        setShowAnalysisDetails(true);
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
    if (!projectId) {
      if (initialProjectId && projects.some((project) => project.id === initialProjectId)) {
        setProjectId(initialProjectId);
      } else if (projects[0]) {
        setProjectId(projects[0].id);
      }
    }
  }, [initialProjectId, projectId, projects]);

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
          Connect GitHub
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
          Connect GitHub so MergeMint can verify PRs against requirements.
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
              setShowAnalysisDetails(false);
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
              setShowAnalysisDetails(false);
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

        {activeInstallation && !repositories.isLoading && repositories.data?.length === 0 ? (
          <p className="rounded-md border border-neutral-800 bg-neutral-950 p-3 text-sm text-neutral-400">
            Sync selected repositories from your GitHub App installation.
          </p>
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

        <RepoIntelligenceCard
          projectId={projectId}
          connectedRepository={connectedRepository}
          analysis={latestAnalysis.data}
          isLoading={latestAnalysis.isLoading}
          isAnalyzing={analyzeRepository.isPending}
          error={latestAnalysis.error?.message ?? analyzeRepository.error?.message}
          showDetails={showAnalysisDetails}
          onToggleDetails={() => setShowAnalysisDetails((current) => !current)}
          onAnalyze={() => {
            if (projectId) {
              analyzeRepository.mutate({ projectId });
            }
          }}
        />

        {taskSummary.data ? (
          <div className="rounded-md border border-neutral-800 bg-neutral-950 p-4">
            <h3 className="font-medium text-neutral-100">Engineering tasks</h3>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <TaskSummaryMetric
                label="Active"
                value={taskSummary.data.activeTasks}
              />
              <TaskSummaryMetric
                label="Blocked"
                value={taskSummary.data.blockedTasks}
              />
              <TaskSummaryMetric
                label="High risk"
                value={taskSummary.data.highRiskTasks}
              />
              <TaskSummaryMetric
                label="Ready for PR"
                value={taskSummary.data.tasksReadyForPr}
              />
            </div>
          </div>
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

function RepoIntelligenceCard({
  projectId,
  connectedRepository,
  analysis,
  isLoading,
  isAnalyzing,
  error,
  showDetails,
  onToggleDetails,
  onAnalyze
}: {
  projectId: string;
  connectedRepository: {
    fullName: string;
    defaultBranch: string;
  } | null;
  analysis:
    | {
        id: string;
        status: string;
        fullName: string;
        defaultBranch: string | null;
        analyzedCommitSha: string | null;
        techStack: string[] | null;
        appStructure: Record<string, unknown> | null;
        importantFiles:
          | Array<{
              path: string;
              summary?: string;
              signals?: string[];
            }>
          | null;
        routes: string[] | null;
        apiEndpoints: string[] | null;
        databaseModels: string[] | null;
        authSummary: string | null;
        testingSummary: string | null;
        deploymentSummary: string | null;
        riskAreas: string[] | null;
        suggestedFeatureAreas: string[] | null;
        summary: string | null;
        errorMessage: string | null;
        updatedAt: Date | string;
      }
    | null
    | undefined;
  isLoading: boolean;
  isAnalyzing: boolean;
  error?: string;
  showDetails: boolean;
  onToggleDetails: () => void;
  onAnalyze: () => void;
}) {
  if (!projectId || !connectedRepository) {
    return (
      <div className="rounded-md border border-neutral-800 bg-neutral-950 p-4">
        <h3 className="font-medium text-neutral-100">Repository intelligence</h3>
        <p className="mt-2 text-sm text-neutral-400">
          Connect a GitHub repository so MergeMint can understand the codebase
          before reviewing PRs.
        </p>
        <p className="mt-3 text-xs text-neutral-500">
          Use the repository selector above to connect a repository.
        </p>
      </div>
    );
  }

  const complete = analysis?.status === "completed";
  const failed = analysis?.status === "failed";
  const running = isAnalyzing || analysis?.status === "running";
  const techStack = analysis?.techStack ?? [];
  const keyModules = [
    ...(analysis?.routes ?? []),
    ...(analysis?.apiEndpoints ?? []),
    ...(analysis?.databaseModels ?? [])
  ].slice(0, 6);

  return (
    <div className="rounded-md border border-neutral-800 bg-neutral-950 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-medium text-neutral-100">
            {complete ? "Repository intelligence" : "Analyze repository"}
          </h3>
          <p className="mt-2 text-sm text-neutral-400">
            {complete
              ? "MergeMint has a reusable codebase snapshot for repo-aware PRDs, tasks, and QA reviews."
              : "Build a codebase snapshot so PRDs, engineering tasks, and QA reviews can use real repo context."}
          </p>
        </div>
        <button
          type="button"
          onClick={onAnalyze}
          disabled={running}
          className="rounded-md bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {running ? "Analyzing..." : complete ? "Re-analyze" : "Analyze repository"}
        </button>
      </div>

      {isLoading ? (
        <p className="mt-3 text-sm text-neutral-500">Loading repository analysis...</p>
      ) : null}

      {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}

      {failed ? (
        <div className="mt-4 rounded-md border border-red-900/60 bg-red-950/20 p-3 text-sm text-red-200">
          {analysis.errorMessage ?? "Repository analysis failed."}
        </div>
      ) : null}

      {!analysis && !isLoading ? (
        <p className="mt-3 text-sm text-neutral-500">
          No snapshot yet for {connectedRepository.fullName}.
        </p>
      ) : null}

      {complete && analysis ? (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            {techStack.slice(0, 8).map((item) => (
              <span
                key={item}
                className="rounded-full border border-blue-800 bg-blue-950/25 px-2.5 py-1 text-xs text-blue-200"
              >
                {item}
              </span>
            ))}
          </div>
          <div className="grid gap-2 text-sm text-neutral-400">
            <p>Default branch: {analysis.defaultBranch ?? connectedRepository.defaultBranch}</p>
            <p>
              Commit:{" "}
              {analysis.analyzedCommitSha
                ? analysis.analyzedCommitSha.slice(0, 12)
                : "unknown"}
            </p>
            <p>Last analyzed: {new Date(analysis.updatedAt).toLocaleString()}</p>
            {analysis.summary ? <p>{analysis.summary}</p> : null}
          </div>
          {keyModules.length > 0 ? (
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">
                Key modules
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {keyModules.map((module) => (
                  <span
                    key={module}
                    className="rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1 text-xs text-neutral-300"
                  >
                    {module}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          <button
            type="button"
            onClick={onToggleDetails}
            className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-100 transition hover:border-neutral-500"
          >
            {showDetails ? "Hide details" : "View details"}
          </button>
          {showDetails ? <RepoAnalysisDetails analysis={analysis} /> : null}
        </div>
      ) : null}
    </div>
  );
}

function RepoAnalysisDetails({
  analysis
}: {
  analysis: NonNullable<Parameters<typeof RepoIntelligenceCard>[0]["analysis"]>;
}) {
  return (
    <div className="grid gap-3 rounded-md border border-neutral-800 bg-neutral-900 p-4 text-sm">
      <DetailList title="Important files" items={analysis.importantFiles?.map((file) => `${file.path}${file.summary ? ` - ${file.summary}` : ""}`) ?? []} />
      <DetailList title="Routes" items={analysis.routes ?? []} />
      <DetailList title="API endpoints" items={analysis.apiEndpoints ?? []} />
      <DetailList title="Database layer" items={analysis.databaseModels ?? []} />
      <DetailText title="Auth" value={analysis.authSummary} />
      <DetailText title="Testing" value={analysis.testingSummary} />
      <DetailText title="Deployment" value={analysis.deploymentSummary} />
      <DetailList title="Risk areas" items={analysis.riskAreas ?? []} />
      <DetailList
        title="Suggested feature areas"
        items={analysis.suggestedFeatureAreas ?? []}
      />
    </div>
  );
}

function DetailList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="font-medium text-neutral-200">{title}</p>
      {items.length > 0 ? (
        <ul className="mt-2 space-y-1 text-neutral-400">
          {items.slice(0, 12).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-neutral-500">Not detected.</p>
      )}
    </div>
  );
}

function DetailText({ title, value }: { title: string; value?: string | null }) {
  return (
    <div>
      <p className="font-medium text-neutral-200">{title}</p>
      <p className="mt-1 text-neutral-400">{value ?? "Not detected."}</p>
    </div>
  );
}

function getProjectPrimaryCta(
  project: {
    id: string;
    status?: string;
    connectedRepository?: { fullName: string } | null;
    repositoryAnalyzed?: boolean;
    activeFeatureCount?: number;
  },
  options: {
    githubInstalled: boolean;
  }
) {
  if (project.status === "completed") {
    return {
      label: "Open completed project",
      href: `/app/features?projectId=${project.id}`
    };
  }

  if (!options.githubInstalled) {
    return {
      label: "Connect GitHub",
      href: "/app/settings/github"
    };
  }

  if (!project.connectedRepository) {
    return {
      label: "Connect repository",
      href: `/app/projects?projectId=${project.id}`
    };
  }

  if (!project.repositoryAnalyzed) {
    return {
      label: "Analyze repository",
      href: `/app/projects?projectId=${project.id}`
    };
  }

  if (!project.activeFeatureCount) {
    return {
      label: "Create feature request",
      href: `/app/features?projectId=${project.id}`
    };
  }

  return {
    label: "Continue release",
    href: `/app/features?projectId=${project.id}`
  };
}

function formatProjectState(state?: string | null) {
  if (!state) {
    return "setup";
  }

  return state.replaceAll("_", " ");
}

function ProjectMetric({
  label,
  value
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-md border border-neutral-800 bg-neutral-900 p-3">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-neutral-100">{value}</p>
    </div>
  );
}

function TaskSummaryMetric({
  label,
  value
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-md border border-neutral-800 bg-neutral-900 p-3">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-neutral-100">{value}</p>
    </div>
  );
}
