"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { trpc } from "@/trpc/react";

const priorities = ["low", "medium", "high", "urgent"] as const;

export function FeaturesClient() {
  const utils = trpc.useUtils();
  const projects = trpc.projects.list.useQuery();
  const features = trpc.featureRequests.list.useQuery();
  const [projectId, setProjectId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [businessGoal, setBusinessGoal] = useState("");
  const [expectedBehavior, setExpectedBehavior] = useState("");
  const [acceptanceCriteria, setAcceptanceCriteria] = useState("");
  const [priority, setPriority] = useState<(typeof priorities)[number]>("medium");
  const [success, setSuccess] = useState<string | null>(null);

  const createFeature = trpc.featureRequests.create.useMutation({
    onSuccess: async () => {
      setTitle("");
      setDescription("");
      setBusinessGoal("");
      setExpectedBehavior("");
      setAcceptanceCriteria("");
      setPriority("medium");
      setSuccess("Feature request created.");
      await utils.featureRequests.list.invalidate();
    }
  });

  useEffect(() => {
    if (!projectId && projects.data?.[0]) {
      setProjectId(projects.data[0].id);
    }
  }, [projectId, projects.data]);

  const projectNameById = useMemo(
    () => new Map(projects.data?.map((project) => [project.id, project.name])),
    [projects.data]
  );

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
    <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-lg border border-neutral-800 bg-neutral-900 p-5"
      >
        <div>
          <h2 className="text-lg font-medium">Create Feature Request</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Draft a scoped request that can become a PRD and task plan.
          </p>
        </div>

        <label className="block text-sm">
          <span className="text-neutral-300">Project</span>
          <select
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
            className="mt-2 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none transition focus:border-blue-500"
            required
          >
            {projects.data?.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
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
          {createFeature.isPending ? "Creating..." : "Create Feature Request"}
        </button>
      </form>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
        <h2 className="text-lg font-medium">Feature request list</h2>

        {features.isLoading ? (
          <p className="mt-6 text-sm text-neutral-400">Loading...</p>
        ) : null}

        {features.error ? (
          <p className="mt-6 text-sm text-red-300">{features.error.message}</p>
        ) : null}

        {!features.isLoading && !features.error && features.data?.length === 0 ? (
          <div className="mt-6 rounded-md border border-neutral-800 bg-neutral-950 p-5 text-sm text-neutral-400">
            No feature requests yet.
          </div>
        ) : null}

        <div className="mt-5 space-y-3">
          {features.data?.map((feature) => (
            <Link
              key={feature.id}
              href={`/app/features/${feature.id}`}
              className="block rounded-md border border-neutral-800 bg-neutral-950 p-4 transition hover:border-neutral-600"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-medium text-neutral-100">
                    {feature.title}
                  </h3>
                  <p className="mt-1 text-sm text-neutral-500">
                    {projectNameById.get(feature.projectId) ?? "Project"}
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
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
