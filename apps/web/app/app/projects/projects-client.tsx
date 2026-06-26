"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { trpc } from "@/trpc/react";

export function ProjectsClient() {
  const utils = trpc.useUtils();
  const projects = trpc.projects.list.useQuery();
  const clients = trpc.clients.list.useQuery();
  const createProject = trpc.projects.create.useMutation({
    onSuccess: async () => {
      setName("");
      setDescription("");
      setClientName("");
      setClientId("");
      setSuccess("Project created.");
      await Promise.all([
        utils.projects.list.invalidate(),
        utils.clients.list.invalidate()
      ]);
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
