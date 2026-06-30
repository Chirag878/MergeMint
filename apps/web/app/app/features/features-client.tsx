"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { trpc } from "@/trpc/react";

const priorities = ["low", "medium", "high", "urgent"] as const;

export function FeaturesClient({
  initialProjectId
}: {
  initialProjectId?: string;
}) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const projects = trpc.projects.list.useQuery();
  const features = trpc.featureRequests.list.useQuery(undefined, {
    enabled: !initialProjectId
  });
  const [projectId, setProjectId] = useState("");
  const [projectLocked, setProjectLocked] = useState(Boolean(initialProjectId));
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [businessGoal, setBusinessGoal] = useState("");
  const [expectedBehavior, setExpectedBehavior] = useState("");
  const [acceptanceCriteria, setAcceptanceCriteria] = useState("");
  const [priority, setPriority] = useState<(typeof priorities)[number]>("medium");
  const [success, setSuccess] = useState<string | null>(null);

  const createFeature = trpc.featureRequests.create.useMutation({
    onSuccess: (featureRequest) => {
      utils.featureRequests.list.setData(undefined, (current) =>
        current ? [featureRequest, ...current] : [featureRequest]
      );
      const featureProject = projects.data?.find(
        (project) => project.id === featureRequest.projectId
      );
      setTitle("");
      setDescription("");
      setBusinessGoal("");
      setExpectedBehavior("");
      setAcceptanceCriteria("");
      setPriority("medium");
      setSuccess("Feature request created.");
      router.push(`/app/features/${featureRequest.id}`);
      void utils.featureRequests.listByProject.invalidate({
        projectId: featureRequest.projectId
      });
      if (featureProject?.clientId) {
        void utils.clients.getDeliveryLedger.invalidate({
          clientId: featureProject.clientId
        });
        void utils.clients.list.invalidate();
      }
      void utils.dashboard.getSummary.invalidate();
      void utils.featureRequests.list.invalidate();
      void utils.projects.list.invalidate();
      void utils.projects.getControlRoom.invalidate({
        projectId: featureRequest.projectId
      });
      void utils.releaseBoard.getBoard.invalidate();
    }
  });

  useEffect(() => {
    if (
      !projectId &&
      initialProjectId &&
      projects.data?.some((project) => project.id === initialProjectId)
    ) {
      setProjectId(initialProjectId);
    }
  }, [initialProjectId, projectId, projects.data]);

  useEffect(() => {
    if (
      projectLocked &&
      initialProjectId &&
      projects.data &&
      !projects.data.some((project) => project.id === initialProjectId)
    ) {
      setProjectLocked(false);
    }
  }, [initialProjectId, projectLocked, projects.data]);

  const projectNameById = useMemo(
    () => new Map(projects.data?.map((project) => [project.id, project.name])),
    [projects.data]
  );
  const selectedProject = projects.data?.find((project) => project.id === projectId);
  const projectFeatures = trpc.featureRequests.listByProject.useQuery(
    { projectId },
    { enabled: Boolean(projectId) }
  );
  const projectIntegration = trpc.githubApp.getProjectIntegration.useQuery(
    { projectId },
    { enabled: Boolean(projectId) }
  );
  const latestAnalysis = trpc.repositoryIntelligence.getLatestByProject.useQuery(
    { projectId },
    { enabled: Boolean(projectId) }
  );
  const visibleFeatures = projectId ? projectFeatures.data : features.data;

  const hasProjects = (projects.data?.length ?? 0) > 0;
  const canSubmit =
    hasProjects &&
    projectId.length > 0 &&
    title.trim().length >= 2 &&
    description.trim().length > 0 &&
    !createFeature.isPending;

  function parseAcceptanceCriteria() {
    return acceptanceCriteria
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }

    setSuccess(null);
    createFeature.mutate({
      projectId,
      title: title.trim(),
      description: description.trim(),
      businessGoal: businessGoal.trim() || undefined,
      expectedBehavior: expectedBehavior.trim() || undefined,
      acceptanceCriteria: parseAcceptanceCriteria(),
      priority
    });
  }

  if (projects.isLoading) {
    return (
      <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-5 text-sm text-neutral-400">
        Loading...
      </div>
    );
  }

  if (projects.error) {
    return (
      <div className="rounded-lg border border-red-900/60 bg-red-950/30 p-5 text-sm text-red-200">
        {projects.error.message}
      </div>
    );
  }

  if (!hasProjects) {
    return (
      <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-6">
        <p className="text-lg font-medium text-neutral-100">
          You need to create a project before creating a feature request.
        </p>
        <Link
          href="/app/projects"
          className="mt-4 inline-flex rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-950 transition hover:bg-white"
        >
          Create Project
        </Link>
      </div>
    );
  }

  return (
    <div className="vf-features-screen grid gap-6 xl:grid-cols-[420px_1fr]">
      <form
        onSubmit={onSubmit}
        className="vf-feature-compose space-y-4 rounded-lg border border-neutral-800 bg-neutral-900 p-5"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#E8C999]">
            Intake desk
          </p>
          <h2 className="mt-2 text-xl font-semibold">Create Feature Request</h2>
          <p className="mt-1 text-sm text-neutral-500">
            {selectedProject
              ? `Creating feature for: ${selectedProject.name}`
              : "Select a project first, then draft a scoped request."}
          </p>
        </div>

        {selectedProject ? (
          <div className="rounded-md border border-neutral-800 bg-neutral-950 p-3 text-sm text-neutral-400">
            <p>Project: {selectedProject.name}</p>
            <p>
              Repository:{" "}
              {projectIntegration.data?.repository.fullName ?? "Not connected"}
            </p>
            <p>
              Repo intelligence:{" "}
              {latestAnalysis.data?.status === "completed" ? "Ready" : "Missing"}
            </p>
          </div>
        ) : null}

        <label className="block text-sm">
          <span className="text-neutral-300">Project</span>
          <select
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
            disabled={projectLocked}
            className="mt-2 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none transition focus:border-blue-500"
            required
          >
            <option value="">Select a project</option>
            {projects.data?.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          {projectLocked ? (
            <button
              type="button"
              onClick={() => setProjectLocked(false)}
              className="mt-2 text-xs font-medium text-blue-300 transition hover:text-blue-200"
            >
              Change project
            </button>
          ) : null}
        </label>

        <label className="block text-sm">
          <span className="text-neutral-300">Title</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="mt-2 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none transition focus:border-blue-500"
            placeholder="Add role-based approval gates"
            minLength={2}
            required
          />
        </label>

        <label className="block text-sm">
          <span className="text-neutral-300">Description</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="mt-2 min-h-28 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none transition focus:border-blue-500"
            placeholder="What should be built and who needs it?"
            required
          />
        </label>

        <label className="block text-sm">
          <span className="text-neutral-300">Business goal</span>
          <textarea
            value={businessGoal}
            onChange={(event) => setBusinessGoal(event.target.value)}
            className="mt-2 min-h-20 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none transition focus:border-blue-500"
            placeholder="Why does this matter?"
          />
        </label>

        <label className="block text-sm">
          <span className="text-neutral-300">Expected behavior</span>
          <textarea
            value={expectedBehavior}
            onChange={(event) => setExpectedBehavior(event.target.value)}
            className="mt-2 min-h-20 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none transition focus:border-blue-500"
            placeholder="What should happen when it works?"
          />
        </label>

        <label className="block text-sm">
          <span className="text-neutral-300">Acceptance criteria</span>
          <textarea
            value={acceptanceCriteria}
            onChange={(event) => setAcceptanceCriteria(event.target.value)}
            className="mt-2 min-h-24 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none transition focus:border-blue-500"
            placeholder="One criterion per line"
          />
        </label>

        <label className="block text-sm">
          <span className="text-neutral-300">Priority</span>
          <select
            value={priority}
            onChange={(event) =>
              setPriority(event.target.value as (typeof priorities)[number])
            }
            className="mt-2 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none transition focus:border-blue-500"
          >
            {priorities.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        {createFeature.error ? (
          <p className="text-sm text-red-300">{createFeature.error.message}</p>
        ) : null}
        {success ? <p className="text-sm text-emerald-300">{success}</p> : null}

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {createFeature.isPending ? "Creating..." : "Create feature and continue"}
        </button>
      </form>

      <section className="vf-feature-list rounded-lg border border-neutral-800 bg-neutral-900 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#E8C999]">
              Release queue
            </p>
            <h2 className="mt-2 text-xl font-semibold">
              {selectedProject ? `${selectedProject.name} features` : "Feature request list"}
            </h2>
          </div>
          <span className="rounded-full border border-neutral-700 px-2.5 py-1 text-xs text-neutral-300">
            {visibleFeatures?.length ?? 0} features
          </span>
        </div>

        {(projectId ? projectFeatures.isLoading : features.isLoading) ? (
          <p className="mt-6 text-sm text-neutral-400">Loading...</p>
        ) : null}

        {(projectId ? projectFeatures.error : features.error) ? (
          <p className="mt-6 text-sm text-red-300">
            {(projectId ? projectFeatures.error : features.error)?.message}
          </p>
        ) : null}

        {!(projectId ? projectFeatures.isLoading : features.isLoading) &&
        !(projectId ? projectFeatures.error : features.error) &&
        visibleFeatures?.length === 0 ? (
          <div className="mt-6 rounded-md border border-neutral-800 bg-neutral-950 p-5 text-sm text-neutral-400">
            {selectedProject
              ? "Create the first feature request for this project."
              : "Select a project to create and review feature requests."}
          </div>
        ) : null}

        <div className="mt-5 space-y-3">
          {visibleFeatures?.map((feature) => (
            <Link
              key={feature.id}
              href={`/app/features/${feature.id}`}
              className="vf-feature-queue-card block rounded-md border border-neutral-800 bg-neutral-950 p-4 transition hover:border-neutral-600"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
                    {projectNameById.get(feature.projectId) ?? "Project"}
                  </p>
                  <h3 className="mt-1 font-semibold text-neutral-100">
                    {feature.title}
                  </h3>
                  <p className="mt-1 text-sm text-neutral-500">
                    Open the Release Control Room to generate PRD, tasks, QA, approvals, reports, and proof.
                  </p>
                </div>
                <div className="flex gap-2">
                  <span className="rounded-full border border-neutral-700 px-2.5 py-1 text-xs text-neutral-300">
                    {feature.priority}
                  </span>
                  <span className="rounded-full border border-neutral-700 px-2.5 py-1 text-xs text-neutral-300">
                    {feature.status}
                  </span>
                </div>
              </div>
              <p className="mt-3 line-clamp-2 text-sm text-neutral-400">
                {feature.description}
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-800 pt-3">
                <span className="text-xs font-semibold text-[#E8C999]">
                  Next: Release Control Room
                </span>
                <span className="text-xs text-neutral-500">Open feature</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
