"use client";

import Link from "next/link";
import { trpc } from "@/trpc/react";

export function FeatureDetailClient({
  featureRequestId
}: {
  featureRequestId: string;
}) {
  const utils = trpc.useUtils();
  const workflow = trpc.requirementEngine.getWorkflow.useQuery({
    featureRequestId
  });
  const generateClarifications =
    trpc.requirementEngine.generateClarifications.useMutation({
      onSuccess: () =>
        utils.requirementEngine.getWorkflow.invalidate({ featureRequestId })
    });
  const generatePrd = trpc.requirementEngine.generatePrd.useMutation({
    onSuccess: () =>
      utils.requirementEngine.getWorkflow.invalidate({ featureRequestId })
  });
  const generateTasks =
    trpc.requirementEngine.generateEngineeringTasks.useMutation({
      onSuccess: () =>
        utils.requirementEngine.getWorkflow.invalidate({ featureRequestId })
    });

  const feature = workflow.data?.featureRequest;
  const latestPrd = workflow.data?.prds[0];

  if (workflow.isLoading) {
    return (
      <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-5 text-sm text-neutral-400">
        Loading...
      </div>
    );
  }

  if (workflow.error || !feature) {
    return (
      <div className="rounded-lg border border-red-900/60 bg-red-950/30 p-5">
        <p className="text-sm text-red-200">
          {workflow.error?.message ?? "Feature request not found."}
        </p>
        <Link
          href="/app/features"
          className="mt-4 inline-flex rounded-md border border-red-800 px-3 py-2 text-sm text-red-100"
        >
          Back to features
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/app/features" className="text-sm text-neutral-500">
            Back to features
          </Link>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">
            {feature.title}
          </h1>
          <p className="mt-3 max-w-3xl text-neutral-400">
            {feature.description}
          </p>
        </div>
        <div className="flex gap-2">
          <span className="rounded-full border border-neutral-700 px-3 py-1 text-sm text-neutral-300">
            {feature.priority}
          </span>
          <span className="rounded-full border border-neutral-700 px-3 py-1 text-sm text-neutral-300">
            {feature.status}
          </span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <DetailBlock title="Business goal" value={feature.businessGoal} />
        <DetailBlock
          title="Expected behavior"
          value={feature.expectedBehavior}
        />
      </div>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
        <h2 className="text-lg font-medium">Acceptance criteria</h2>
        {feature.acceptanceCriteria.length > 0 ? (
          <ul className="mt-4 space-y-2 text-sm text-neutral-300">
            {feature.acceptanceCriteria.map((criterion) => (
              <li key={criterion} className="rounded-md bg-neutral-950 p-3">
                {criterion}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-neutral-500">
            No acceptance criteria captured yet.
          </p>
        )}
      </section>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
        <h2 className="text-lg font-medium">Requirement engine</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() =>
              generateClarifications.mutate({ featureRequestId: feature.id })
            }
            disabled={generateClarifications.isPending}
            className="rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {generateClarifications.isPending
              ? "Generating..."
              : "Generate clarification questions"}
          </button>
          <button
            type="button"
            onClick={() => generatePrd.mutate({ featureRequestId: feature.id })}
            disabled={generatePrd.isPending}
            className="rounded-md border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-100 transition hover:border-neutral-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {generatePrd.isPending ? "Generating..." : "Generate PRD"}
          </button>
          <button
            type="button"
            onClick={() =>
              latestPrd ? generateTasks.mutate({ prdId: latestPrd.id }) : null
            }
            disabled={!latestPrd || generateTasks.isPending}
            className="rounded-md border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-100 transition hover:border-neutral-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {generateTasks.isPending
              ? "Generating..."
              : "Generate engineering tasks"}
          </button>
        </div>

        {generateClarifications.error || generatePrd.error || generateTasks.error ? (
          <p className="mt-4 text-sm text-red-300">
            {generateClarifications.error?.message ??
              generatePrd.error?.message ??
              generateTasks.error?.message}
          </p>
        ) : null}

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <Metric label="Questions" value={workflow.data?.questions.length ?? 0} />
          <Metric label="PRDs" value={workflow.data?.prds.length ?? 0} />
          <Metric label="Tasks" value={workflow.data?.tasks.length ?? 0} />
        </div>
      </section>
    </>
  );
}

function DetailBlock({
  title,
  value
}: {
  title: string;
  value?: string | null;
}) {
  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
      <h2 className="text-lg font-medium">{title}</h2>
      <p className="mt-3 text-sm text-neutral-400">
        {value || "Not specified."}
      </p>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-neutral-800 bg-neutral-950 p-4">
      <p className="text-sm text-neutral-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-neutral-100">{value}</p>
    </div>
  );
}
