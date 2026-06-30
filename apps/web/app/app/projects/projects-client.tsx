"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { trpc } from "@/trpc/react";

type CreationMode = "github" | "manual";

type ProjectListItem = {
  id: string;
  name: string;
  description: string | null;
  clientName: string | null;
  clientId: string | null;
  status: string;
  createdAt: Date | string;
  connectedRepository: {
    id: string;
    fullName: string;
    owner: string;
    name: string;
    defaultBranch: string;
  } | null;
  repositoryAnalyzed: boolean;
  activeFeatureCount: number;
  featuresNeedingAction: number;
  latestReleaseState: string;
};

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
  const [createOpen, setCreateOpen] = useState(false);
  const [mode, setMode] = useState<CreationMode>("github");
  const [installationIdText, setInstallationIdText] = useState("");
  const [repositoryId, setRepositoryId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientId, setClientId] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const selectedInstallationId = installationIdText
    ? Number(installationIdText)
    : (githubInstallations.data?.[0]?.installationId ?? null);
  const syncedRepositories = trpc.githubApp.listInstallationRepositories.useQuery(
    { installationId: selectedInstallationId ?? 0 },
    { enabled: Boolean(selectedInstallationId) }
  );
  const analyzeRepository =
    trpc.repositoryIntelligence.analyzeProjectRepository.useMutation({
      onSuccess: async (_analysis, variables) => {
        setStatusMessage("Repository analysis completed.");
        await Promise.all([
          utils.repositoryIntelligence.getLatestByProject.invalidate({
            projectId: variables.projectId
          }),
          utils.projects.list.invalidate(),
          utils.projects.getControlRoom.invalidate({
            projectId: variables.projectId
          }),
          utils.guidedWorkflow.getProjectSetup.invalidate({
            projectId: variables.projectId
          }),
          utils.dashboard.getSummary.invalidate(),
          utils.releaseBoard.getBoard.invalidate()
        ]);
      }
    });
  const createProject = trpc.projects.create.useMutation({
    onSuccess: async (project) => {
      setStatusMessage("Project created.");
      setCreateOpen(false);
      resetCreateForm();
      await Promise.all([
        utils.projects.list.invalidate(),
        utils.dashboard.getSummary.invalidate(),
        utils.releaseBoard.getBoard.invalidate(),
        utils.guidedWorkflow.getWorkspaceSetup.invalidate()
      ]);
      if (project.clientId) {
        await Promise.all([
          utils.clients.getDeliveryLedger.invalidate({
            clientId: project.clientId
          }),
          utils.clients.list.invalidate()
        ]);
      }
      router.push(`/app/projects/${project.id}`);
    }
  });

  useEffect(() => {
    if (initialProjectId) {
      router.replace(`/app/projects/${initialProjectId}`);
    }
  }, [initialProjectId, router]);

  useEffect(() => {
    if (!installationIdText && githubInstallations.data?.[0]) {
      setInstallationIdText(String(githubInstallations.data[0].installationId));
    }
  }, [githubInstallations.data, installationIdText]);

  const githubInstalled = (githubInstallations.data?.length ?? 0) > 0;
  const repoCount = syncedRepositories.data?.length ?? 0;
  const hasRepos = repoCount > 0;
  const canSubmit =
    name.trim().length >= 2 &&
    !createProject.isPending &&
    (mode === "manual" || Boolean(repositoryId));

  function resetCreateForm() {
    setMode("github");
    setRepositoryId("");
    setName("");
    setDescription("");
    setClientName("");
    setClientId("");
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    setStatusMessage(null);
    createProject.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
      clientName: clientName.trim() || undefined,
      clientId: clientId || undefined,
      repositoryId: mode === "github" ? repositoryId : undefined
    });
  }

  return (
    <div className="vf-projects-screen space-y-6">
      <div className="vf-projects-command-bar flex flex-col gap-4 rounded-lg border border-neutral-800 bg-neutral-900 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#E8C999]">
            Project cockpit
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-white">
            Projects
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-neutral-400">
            Group client or product work before verifying releases.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-950 transition hover:bg-white"
        >
          Create Project
        </button>
      </div>

      <GitHubStatusCard
        installed={githubInstalled}
        repoCount={repoCount}
        loading={githubInstallations.isLoading || syncedRepositories.isLoading}
      />

      {statusMessage ? (
        <p className="rounded-md border border-emerald-900/60 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-200">
          {statusMessage}
        </p>
      ) : null}
      {analyzeRepository.error ? (
        <p className="rounded-md border border-red-900/60 bg-red-950/25 px-4 py-3 text-sm text-red-200">
          {analyzeRepository.error.message}
        </p>
      ) : null}

      <section className="space-y-4">
        {projects.isLoading ? (
          <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-6 text-sm text-neutral-400">
            Loading projects...
          </div>
        ) : null}

        {projects.error ? (
          <div className="rounded-lg border border-red-900/60 bg-red-950/25 p-6 text-sm text-red-200">
            {projects.error.message}
          </div>
        ) : null}

        {!projects.isLoading && !projects.error && projects.data?.length === 0 ? (
          <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-8">
            <h2 className="text-lg font-medium text-neutral-100">
              No projects yet
            </h2>
            <p className="mt-2 max-w-xl text-sm text-neutral-400">
              Create a project from a synced repository or start manually and
              connect the repository later.
            </p>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="mt-5 rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-950 transition hover:bg-white"
            >
              Create Project
            </button>
          </div>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-2">
          {projects.data?.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              githubInstalled={githubInstalled}
              analyzingProjectId={
                analyzeRepository.isPending
                  ? analyzeRepository.variables?.projectId
                  : null
              }
              onAnalyze={() =>
                analyzeRepository.mutate({
                  projectId: project.id
                })
              }
            />
          ))}
        </div>
      </section>

      {createOpen ? (
        <CreateProjectModal
          mode={mode}
          setMode={setMode}
          githubInstalled={githubInstalled}
          hasRepos={hasRepos}
          selectedInstallationId={selectedInstallationId}
          installationIdText={installationIdText}
          setInstallationIdText={setInstallationIdText}
          installations={githubInstallations.data ?? []}
          repositories={syncedRepositories.data ?? []}
          repositoriesLoading={syncedRepositories.isLoading}
          clients={clients.data ?? []}
          name={name}
          setName={setName}
          description={description}
          setDescription={setDescription}
          clientId={clientId}
          setClientId={setClientId}
          clientName={clientName}
          setClientName={setClientName}
          repositoryId={repositoryId}
          setRepositoryId={setRepositoryId}
          canSubmit={canSubmit}
          isCreating={createProject.isPending}
          error={createProject.error?.message}
          onClose={() => {
            setCreateOpen(false);
            resetCreateForm();
          }}
          onSubmit={onSubmit}
        />
      ) : null}
    </div>
  );
}

function GitHubStatusCard({
  installed,
  repoCount,
  loading
}: {
  installed: boolean;
  repoCount: number;
  loading: boolean;
}) {
  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-medium text-neutral-100">
              {installed ? "GitHub connected" : "Connect GitHub"}
            </h2>
            {installed ? <StatusChip tone="good">{repoCount} synced</StatusChip> : null}
          </div>
          <p className="mt-2 text-sm text-neutral-400">
            {installed
              ? "Repositories are synced at workspace level."
              : "Install the MergeMint GitHub App to create projects from selected repositories."}
          </p>
          {loading ? (
            <p className="mt-2 text-xs text-neutral-500">Checking GitHub status...</p>
          ) : null}
        </div>
        <Link
          href="/app/settings/github"
          className="inline-flex rounded-md border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-100 transition hover:border-neutral-500"
        >
          {installed ? "Manage GitHub" : "Connect GitHub"}
        </Link>
      </div>
    </section>
  );
}

function ProjectCard({
  project,
  githubInstalled,
  analyzingProjectId,
  onAnalyze
}: {
  project: ProjectListItem;
  githubInstalled: boolean;
  analyzingProjectId: string | null;
  onAnalyze: () => void;
}) {
  const primary = getPrimaryAction(project, githubInstalled);
  const analyzing = analyzingProjectId === project.id;
  const reportsReady = Math.max(
    0,
    (project.activeFeatureCount ?? 0) - (project.featuresNeedingAction ?? 0)
  );

  return (
    <article className="vf-project-card group rounded-lg border border-neutral-800 bg-neutral-900 p-5 transition hover:border-neutral-700 hover:bg-neutral-900/80">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-lg font-semibold text-neutral-100">
              {project.name}
            </h2>
            <StatusChip>{formatStatus(project.status)}</StatusChip>
          </div>
          <p className="mt-2 text-sm text-neutral-400">
            {[project.clientName, project.connectedRepository?.fullName ?? "No repository connected"]
              .filter(Boolean)
              .join(" - ")}
          </p>
          <p className="mt-3 inline-flex rounded-full border border-[#E8C999]/20 bg-[#E8C999]/10 px-2.5 py-1 text-xs font-semibold text-[#E8C999]">
            Next: {primary.label}
          </p>
        </div>
        <details className="relative shrink-0">
          <summary className="list-none rounded-md border border-neutral-800 px-2.5 py-1 text-sm text-neutral-400 transition hover:border-neutral-600 hover:text-neutral-100">
            ...
          </summary>
          <div className="absolute right-0 z-10 mt-2 w-44 rounded-md border border-neutral-800 bg-neutral-950 p-2 shadow-xl">
            <Link
              href={`/app/projects/${project.id}`}
              className="block rounded px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-900 hover:text-white"
            >
              Open project
            </Link>
            <Link
              href={`/app/features?projectId=${project.id}`}
              className="block rounded px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-900 hover:text-white"
            >
              Create feature
            </Link>
          </div>
        </details>
      </div>

      <ProgressRail
        repo={Boolean(project.connectedRepository)}
        analysis={project.repositoryAnalyzed}
        features={(project.activeFeatureCount ?? 0) > 0}
        pr={!["setup", "repo_connected"].includes(project.latestReleaseState)}
        qa={project.featuresNeedingAction === 0 && (project.activeFeatureCount ?? 0) > 0}
        report={reportsReady > 0}
      />

      <div className="vf-project-proof-map mt-4 grid gap-2 sm:grid-cols-3">
        <ProofTile label="Repository" value={project.connectedRepository?.fullName ?? "Not connected"} />
        <ProofTile label="Release state" value={formatStatus(project.latestReleaseState)} />
        <ProofTile label="Health" value={project.featuresNeedingAction > 0 ? "Needs review" : "Clear"} />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Metric label="Active features" value={project.activeFeatureCount ?? 0} />
        <Metric label="Needs review" value={project.featuresNeedingAction ?? 0} />
        <Metric label="Reports ready" value={reportsReady} />
        <Metric
          label="Repo intelligence"
          value={project.repositoryAnalyzed ? "Analyzed" : "Missing"}
        />
      </div>

      {project.description ? (
        <p className="mt-4 line-clamp-2 text-sm leading-6 text-neutral-400">
          {project.description}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {primary.kind === "analyze" ? (
          <button
            type="button"
            onClick={onAnalyze}
            disabled={analyzing}
            className="rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {analyzing ? "Analyzing..." : primary.label}
          </button>
        ) : (
          <Link
            href={primary.href}
            className="rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-950 transition hover:bg-white"
          >
            {primary.label}
          </Link>
        )}
        <Link
          href={`/app/projects/${project.id}`}
          className="text-sm font-medium text-neutral-300 transition hover:text-white"
        >
          Open Project
        </Link>
      </div>
    </article>
  );
}

function CreateProjectModal({
  mode,
  setMode,
  githubInstalled,
  hasRepos,
  installationIdText,
  setInstallationIdText,
  installations,
  repositories,
  repositoriesLoading,
  clients,
  name,
  setName,
  description,
  setDescription,
  clientId,
  setClientId,
  clientName,
  setClientName,
  repositoryId,
  setRepositoryId,
  canSubmit,
  isCreating,
  error,
  onClose,
  onSubmit
}: {
  mode: CreationMode;
  setMode: (mode: CreationMode) => void;
  githubInstalled: boolean;
  hasRepos: boolean;
  selectedInstallationId: number | null;
  installationIdText: string;
  setInstallationIdText: (value: string) => void;
  installations: Array<{ id: string; installationId: number; accountLogin: string }>;
  repositories: Array<{ id: string; name: string; fullName: string }>;
  repositoriesLoading: boolean;
  clients: Array<{ id: string; name: string }>;
  name: string;
  setName: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  clientId: string;
  setClientId: (value: string) => void;
  clientName: string;
  setClientName: (value: string) => void;
  repositoryId: string;
  setRepositoryId: (value: string) => void;
  canSubmit: boolean;
  isCreating: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const selectedRepository = useMemo(
    () => repositories.find((repository) => repository.id === repositoryId),
    [repositories, repositoryId]
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 px-4 py-10">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-2xl rounded-lg border border-neutral-800 bg-neutral-950 p-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-neutral-100">
              Create Project
            </h2>
            <p className="mt-2 text-sm text-neutral-400">
              Choose how this project should start.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-neutral-800 px-3 py-1.5 text-sm text-neutral-300 transition hover:border-neutral-600 hover:text-white"
          >
            Close
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setMode("github")}
            className={
              mode === "github"
                ? "rounded-lg border border-blue-700 bg-blue-950/30 p-4 text-left"
                : "rounded-lg border border-neutral-800 bg-neutral-900 p-4 text-left transition hover:border-neutral-700"
            }
          >
            <p className="font-medium text-neutral-100">From GitHub repo</p>
            <p className="mt-2 text-sm text-neutral-400">
              Create a project from a synced repository and connect it immediately.
            </p>
          </button>
          <button
            type="button"
            onClick={() => setMode("manual")}
            className={
              mode === "manual"
                ? "rounded-lg border border-blue-700 bg-blue-950/30 p-4 text-left"
                : "rounded-lg border border-neutral-800 bg-neutral-900 p-4 text-left transition hover:border-neutral-700"
            }
          >
            <p className="font-medium text-neutral-100">Manual project</p>
            <p className="mt-2 text-sm text-neutral-400">
              Start with a project brief and connect a repository later.
            </p>
          </button>
        </div>

        {mode === "github" ? (
          <div className="mt-5 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
            {!githubInstalled ? (
              <div>
                <p className="text-sm text-neutral-400">
                  Install the GitHub App before creating a project from a repository.
                </p>
                <Link
                  href="/app/settings/github"
                  className="mt-3 inline-flex rounded-md bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-950 transition hover:bg-white"
                >
                  Connect GitHub
                </Link>
              </div>
            ) : null}
            {githubInstalled && !hasRepos && !repositoriesLoading ? (
              <div>
                <p className="text-sm text-neutral-400">
                  Sync repositories in workspace GitHub settings before selecting one.
                </p>
                <Link
                  href="/app/settings/github"
                  className="mt-3 inline-flex rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-100 transition hover:border-neutral-500"
                >
                  Sync repositories
                </Link>
              </div>
            ) : null}
            {githubInstalled ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="text-neutral-300">GitHub account/org</span>
                  <select
                    value={installationIdText}
                    onChange={(event) => {
                      setInstallationIdText(event.target.value);
                      setRepositoryId("");
                    }}
                    className="mt-2 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none transition focus:border-blue-500"
                  >
                    {installations.map((installation) => (
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
                      const nextRepositoryId = event.target.value;
                      setRepositoryId(nextRepositoryId);
                      const repository = repositories.find(
                        (item) => item.id === nextRepositoryId
                      );
                      if (repository && !name) setName(repository.name);
                    }}
                    disabled={repositoriesLoading || !hasRepos}
                    className="mt-2 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none transition focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">
                      {repositoriesLoading ? "Loading repositories..." : "Select repository"}
                    </option>
                    {repositories.map((repository) => (
                      <option key={repository.id} value={repository.id}>
                        {repository.fullName}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}
            {selectedRepository ? (
              <p className="mt-3 text-xs text-neutral-500">
                This project will be connected to {selectedRepository.fullName}.
              </p>
            ) : null}
          </div>
        ) : (
          <p className="mt-5 rounded-lg border border-neutral-800 bg-neutral-900 p-4 text-sm text-neutral-400">
            Repository can be connected later from the project control room.
          </p>
        )}

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
            <span className="text-neutral-300">Project name</span>
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
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-neutral-300">Client label</span>
            <input
              value={clientName}
              onChange={(event) => setClientName(event.target.value)}
              className="mt-2 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none transition focus:border-blue-500"
              placeholder="Optional"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="text-neutral-300">Project brief</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="mt-2 min-h-28 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none transition focus:border-blue-500"
              placeholder="Release workflow, scope, or notes"
            />
          </label>
        </div>

        {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-neutral-700 px-4 py-2 text-sm text-neutral-100 transition hover:border-neutral-500"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isCreating ? "Creating..." : "Create project"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ProgressRail({
  repo,
  analysis,
  features,
  pr,
  qa,
  report
}: {
  repo: boolean;
  analysis: boolean;
  features: boolean;
  pr: boolean;
  qa: boolean;
  report: boolean;
}) {
  const steps = [
    ["Repo", repo],
    ["Analysis", analysis],
    ["Features", features],
    ["PR", pr],
    ["QA", qa],
    ["Report", report]
  ] as const;

  return (
    <div className="mt-5 grid grid-cols-6 gap-2">
      {steps.map(([label, complete]) => (
        <div key={label} className="min-w-0">
          <div
            className={
              complete
                ? "h-1.5 rounded-full bg-emerald-400"
                : "h-1.5 rounded-full bg-neutral-800"
            }
          />
          <p className="mt-2 truncate text-xs text-neutral-500">{label}</p>
        </div>
      ))}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-neutral-100">{value}</p>
    </div>
  );
}

function ProofTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-neutral-800 bg-neutral-950/70 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
        {label}
      </p>
      <p className="mt-1 truncate text-xs font-medium text-neutral-200">{value}</p>
    </div>
  );
}

function StatusChip({
  children,
  tone = "neutral"
}: {
  children: React.ReactNode;
  tone?: "neutral" | "good";
}) {
  return (
    <span
      className={
        tone === "good"
          ? "rounded-full border border-emerald-800 bg-emerald-950/30 px-2.5 py-1 text-xs text-emerald-200"
          : "rounded-full border border-neutral-700 bg-neutral-950 px-2.5 py-1 text-xs text-neutral-300"
      }
    >
      {children}
    </span>
  );
}

function getPrimaryAction(project: ProjectListItem, githubInstalled: boolean) {
  if (project.status === "completed") {
    return {
      kind: "link",
      label: "View project",
      href: `/app/projects/${project.id}`
    } as const;
  }

  if (!githubInstalled && !project.connectedRepository) {
    return {
      kind: "link",
      label: "Connect GitHub",
      href: "/app/settings/github"
    } as const;
  }

  if (!project.connectedRepository) {
    return {
      kind: "link",
      label: "Connect repository",
      href: `/app/projects/${project.id}`
    } as const;
  }

  if (!project.repositoryAnalyzed) {
    return {
      kind: "analyze",
      label: "Analyze repository"
    } as const;
  }

  if (!project.activeFeatureCount) {
    return {
      kind: "link",
      label: "Create feature",
      href: `/app/features?projectId=${project.id}`
    } as const;
  }

  return {
    kind: "link",
    label: "Continue release",
    href: `/app/projects/${project.id}`
  } as const;
}

function formatStatus(status: string) {
  return status.replaceAll("_", " ");
}
