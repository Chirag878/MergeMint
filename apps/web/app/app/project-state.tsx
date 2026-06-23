"use client";

import Link from "next/link";
import { trpc } from "@/trpc/react";

export function AppHomeProjectState() {
  const projects = trpc.projects.list.useQuery();

  if (projects.isLoading) {
    return (
      <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-5 text-sm text-neutral-400">
        Loading projects...
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

  if ((projects.data?.length ?? 0) === 0) {
    return (
      <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-6">
        <p className="text-lg font-medium text-neutral-100">
          Create your first project to start verifying releases.
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
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
      <p className="text-sm text-neutral-500">Active projects</p>
      <p className="mt-2 text-2xl font-semibold text-neutral-100">
        {projects.data?.length}
      </p>
    </div>
  );
}
