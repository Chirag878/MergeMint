"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { trpc } from "@/trpc/react";

const nextActionBadges = {
  generate_prd: "Next: Generate PRD",
  link_pr: "Next: Link PR",
  run_qa_review: "Next: Run QA review",
  submit_approval: "Next: Submit approval",
  generate_report: "Next: Generate report",
  open_report: "Next: Open report",
  review_risks: "Next: Review risks"
} as const;

const riskLabels = {
  open_finding: "Open finding",
  partial_requirement: "Partial requirement",
  missing_requirement: "Missing requirement",
  high_critical_finding: "High/Critical finding",
  pending_approval: "Pending approval"
} as const;

const featurePriorities = ["low", "medium", "high", "urgent"] as const;

type ClientLedgerTab = "ledger" | "projects" | "reports" | "risks" | "notes";

const clientLedgerTabs: Array<{ id: ClientLedgerTab; label: string }> = [
  { id: "ledger", label: "Ledger" },
  { id: "projects", label: "Projects" },
  { id: "reports", label: "Reports" },
  { id: "risks", label: "Risks" },
  { id: "notes", label: "Notes" }
];

function formatDate(value?: Date | string | null) {
  if (!value) {
    return "Not recorded";
  }

  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function formatStatus(value: string | null | undefined) {
  return value ? value.replaceAll("_", " ") : "Not recorded";
}

function getHealthLabel(summary: {
  pendingApprovalsCount: number;
  openFindingsCount: number;
  partialRequirementsCount: number;
  missingRequirementsCount: number;
  changesRequestedCount: number;
}) {
  if (summary.missingRequirementsCount > 0 || summary.changesRequestedCount > 0) {
    return "Blocked";
  }

  if (
    summary.pendingApprovalsCount > 0 ||
    summary.openFindingsCount > 0 ||
    summary.partialRequirementsCount > 0
  ) {
    return "Needs attention";
  }

  return "Healthy";
}

function getActionHref(input: {
  nextAction: keyof typeof nextActionBadges;
  featureRequestId: string;
  reportShareToken?: string;
}) {
  if (input.nextAction === "open_report" && input.reportShareToken) {
    return `/reports/${input.reportShareToken}`;
  }

  return `/app/features/${input.featureRequestId}`;
}

function getActionLabel(input: {
  nextAction: keyof typeof nextActionBadges;
  reportShareToken?: string;
}) {
  if (input.nextAction === "open_report" && input.reportShareToken) {
    return "Open report";
  }

  if (input.nextAction === "run_qa_review") {
    return "Run QA review";
  }

  return "Open feature";
}

function StatCard({
  label,
  value,
  tone = "neutral"
}: {
  label: string;
  value: number | string;
  tone?: "neutral" | "amber" | "red" | "green";
}) {
  const toneClass =
    tone === "amber"
      ? "text-amber-300"
      : tone === "red"
        ? "text-red-300"
        : tone === "green"
          ? "text-emerald-300"
          : "text-neutral-100";

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
      <p className="text-sm text-neutral-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

function RequirementRiskCard({
  partial,
  missing,
  label = "Requirement coverage"
}: {
  partial: number;
  missing: number;
  label?: string;
}) {
  const hasRisk = partial + missing > 0;

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
      <p className="text-sm text-neutral-500">{label}</p>
      <div
        className={`mt-3 space-y-1 text-sm font-medium ${
          hasRisk ? "text-amber-300" : "text-neutral-100"
        }`}
      >
        <p>Partial requirements: {partial}</p>
        <p>Missing requirements: {missing}</p>
      </div>
    </div>
  );
}

function ClientLedgerTabs({
  activeTab,
  onChange
}: {
  activeTab: ClientLedgerTab;
  onChange: (tab: ClientLedgerTab) => void;
}) {
  return (
    <nav className="sticky top-20 z-30 -mx-1 flex gap-2 overflow-x-auto rounded-lg border border-neutral-800 bg-neutral-950/90 p-2 backdrop-blur">
      {clientLedgerTabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition ${
            activeTab === tab.id
              ? "bg-neutral-100 text-neutral-950"
              : "text-neutral-300 hover:bg-neutral-900 hover:text-neutral-100"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

export function ClientLedgerClient({ clientId }: { clientId: string }) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const ledger = trpc.clients.getDeliveryLedger.useQuery({ clientId });
  const [projectId, setProjectId] = useState("");
  const [success, setSuccess] = useState<string | null>(null);
  const [showNewProjectForm, setShowNewProjectForm] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDescription, setNewProjectDescription] = useState("");
  const [showEditForm, setShowEditForm] = useState(false);
  const [editName, setEditName] = useState("");
  const [editCompanyName, setEditCompanyName] = useState("");
  const [editContactName, setEditContactName] = useState("");
  const [editContactEmail, setEditContactEmail] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editStatus, setEditStatus] = useState<"active" | "archived">("active");
  const [showFeatureForm, setShowFeatureForm] = useState(false);
  const [featureProjectId, setFeatureProjectId] = useState("");
  const [featureTitle, setFeatureTitle] = useState("");
  const [featureDescription, setFeatureDescription] = useState("");
  const [featureBusinessGoal, setFeatureBusinessGoal] = useState("");
  const [featureExpectedBehavior, setFeatureExpectedBehavior] = useState("");
  const [featureAcceptanceCriteria, setFeatureAcceptanceCriteria] = useState("");
  const [featurePriority, setFeaturePriority] =
    useState<(typeof featurePriorities)[number]>("medium");
  const [createdFeatureRequestId, setCreatedFeatureRequestId] = useState<
    string | null
  >(null);
  const [activeTab, setActiveTab] = useState<ClientLedgerTab>("ledger");
  const projects = trpc.projects.list.useQuery(undefined, {
    enabled: activeTab === "projects" || showNewProjectForm,
    staleTime: 30_000
  });

  const invalidateLedger = async () => {
    await Promise.all([
      utils.clients.getDeliveryLedger.invalidate({ clientId }),
      utils.clients.list.invalidate()
    ]);
  };

  const archiveClient = trpc.clients.archive.useMutation({
    onSuccess: async () => {
      setCreatedFeatureRequestId(null);
      setSuccess("Client archived.");
      await invalidateLedger();
    }
  });

  const updateClient = trpc.clients.update.useMutation({
    onSuccess: async () => {
      setShowEditForm(false);
      setCreatedFeatureRequestId(null);
      setSuccess("Client updated.");
      await invalidateLedger();
    }
  });

  const createProject = trpc.projects.create.useMutation({
    onSuccess: (project) => {
      utils.projects.list.setData(undefined, (current) =>
        current ? [project, ...current] : [project]
      );
      setShowNewProjectForm(false);
      setNewProjectName("");
      setNewProjectDescription("");
      setCreatedFeatureRequestId(null);
      setFeatureProjectId(project.id);
      setSuccess("Project created for this client.");
      void utils.clients.getDeliveryLedger.invalidate({ clientId });
      void utils.projects.list.invalidate();
    }
  });

  const createFeatureRequest = trpc.featureRequests.create.useMutation({
    onSuccess: (featureRequest) => {
      utils.featureRequests.list.setData(undefined, (current) =>
        current ? [featureRequest, ...current] : [featureRequest]
      );
      setShowFeatureForm(false);
      setFeatureProjectId("");
      setFeatureTitle("");
      setFeatureDescription("");
      setFeatureBusinessGoal("");
      setFeatureExpectedBehavior("");
      setFeatureAcceptanceCriteria("");
      setFeaturePriority("medium");
      setCreatedFeatureRequestId(featureRequest.id);
      setSuccess("Feature request created.");
      router.push(`/app/features/${featureRequest.id}`);
      void utils.clients.getDeliveryLedger.invalidate({ clientId });
      void utils.featureRequests.list.invalidate();
    }
  });

  const attachProject = trpc.clients.attachProject.useMutation({
    onSuccess: async () => {
      setProjectId("");
      setCreatedFeatureRequestId(null);
      setSuccess("Project linked.");
      await Promise.all([
        utils.clients.getDeliveryLedger.invalidate({ clientId }),
        utils.clients.list.invalidate(),
        utils.projects.list.invalidate()
      ]);
    }
  });

  const detachProject = trpc.clients.detachProject.useMutation({
    onSuccess: async () => {
      setCreatedFeatureRequestId(null);
      setSuccess("Project detached.");
      await Promise.all([
        utils.clients.getDeliveryLedger.invalidate({ clientId }),
        utils.clients.list.invalidate(),
        utils.projects.list.invalidate()
      ]);
    }
  });

  const attachableProjects = useMemo(
    () => projects.data?.filter((project) => !project.clientId) ?? [],
    [projects.data]
  );

  const healthLabel = ledger.data
    ? getHealthLabel(ledger.data.summary)
    : "Loading";

  function getClientProjectIds() {
    return new Set(ledger.data?.projects.map((project) => project.id) ?? []);
  }

  function openFeatureForm(projectIdForFeature?: string) {
    if (ledger.data?.client.status === "archived") {
      return;
    }

    setActiveTab("ledger");
    const clientProjects = ledger.data?.projects ?? [];

    if (clientProjects.length === 0) {
      setFeatureProjectId("");
      setShowFeatureForm(true);
      setSuccess(null);
      return;
    }

    setFeatureProjectId(
      projectIdForFeature ?? (clientProjects.length === 1 ? clientProjects[0].id : "")
    );
    setFeatureTitle("");
    setFeatureDescription("");
    setFeatureBusinessGoal("");
    setFeatureExpectedBehavior("");
    setFeatureAcceptanceCriteria("");
    setFeaturePriority("medium");
    setShowFeatureForm(true);
    setSuccess(null);
    setCreatedFeatureRequestId(null);
  }

  function openNewProjectForm() {
    if (ledger.data?.client.status === "archived") {
      return;
    }

    setActiveTab("projects");
    setShowNewProjectForm((value) => !value);
    setSuccess(null);
    setCreatedFeatureRequestId(null);
  }

  function openEditForm() {
    if (!ledger.data) {
      return;
    }

    const { client } = ledger.data;
    setEditName(client.name);
    setEditCompanyName(client.companyName ?? "");
    setEditContactName(client.contactName ?? "");
    setEditContactEmail(client.contactEmail ?? "");
    setEditNotes(client.notes ?? "");
    setEditStatus(client.status);
    setActiveTab("notes");
    setShowEditForm(true);
    setSuccess(null);
  }

  function onUpdateClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editName.trim() || updateClient.isPending) {
      return;
    }

    setSuccess(null);
    updateClient.mutate({
      clientId,
      name: editName.trim(),
      companyName: editCompanyName.trim() || null,
      contactName: editContactName.trim() || null,
      contactEmail: editContactEmail.trim() || null,
      notes: editNotes.trim() || null,
      status: editStatus
    });
  }

  function onCreateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      ledger.data?.client.status === "archived" ||
      newProjectName.trim().length < 2 ||
      createProject.isPending
    ) {
      return;
    }

    setSuccess(null);
    setCreatedFeatureRequestId(null);
    createProject.mutate({
      name: newProjectName.trim(),
      description: newProjectDescription.trim() || undefined,
      clientId
    });
  }

  function onCreateFeatureRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const clientProjectIds = getClientProjectIds();
    const parsedAcceptanceCriteria = featureAcceptanceCriteria
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);

    if (
      ledger.data?.client.status === "archived" ||
      !clientProjectIds.has(featureProjectId) ||
      featureTitle.trim().length < 2 ||
      featureDescription.trim().length === 0 ||
      createFeatureRequest.isPending
    ) {
      return;
    }

    setSuccess(null);
    setCreatedFeatureRequestId(null);
    createFeatureRequest.mutate({
      projectId: featureProjectId,
      clientId,
      title: featureTitle.trim(),
      description: featureDescription.trim(),
      businessGoal: featureBusinessGoal.trim() || undefined,
      expectedBehavior: featureExpectedBehavior.trim() || undefined,
      acceptanceCriteria: parsedAcceptanceCriteria,
      priority: featurePriority
    });
  }

  function onAttach(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      ledger.data?.client.status === "archived" ||
      !projectId ||
      attachProject.isPending
    ) {
      return;
    }

    setSuccess(null);
    setCreatedFeatureRequestId(null);
    attachProject.mutate({ clientId, projectId });
  }

  function onDetach(projectIdToDetach: string) {
    if (ledger.data?.client.status === "archived" || detachProject.isPending) {
      return;
    }

    const confirmed = window.confirm(
      "This will remove the project from this client ledger but will not delete projects, features, reviews, approvals, or reports."
    );

    if (!confirmed) {
      return;
    }

    setSuccess(null);
    setCreatedFeatureRequestId(null);
    detachProject.mutate({ projectId: projectIdToDetach });
  }

  if (ledger.isLoading) {
    return (
      <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-6 text-sm text-neutral-400">
        Loading client ledger...
      </div>
    );
  }

  if (ledger.error) {
    return (
      <div className="rounded-lg border border-red-900/60 bg-red-950/30 p-6 text-sm text-red-200">
        {ledger.error.message}
      </div>
    );
  }

  if (!ledger.data) {
    return null;
  }

  const { client, summary } = ledger.data;
  const isArchived = client.status === "archived";

  return (
    <div className="space-y-8">
      <header className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-tight">
                {client.name}
              </h1>
              <span className="rounded-full border border-neutral-700 px-2.5 py-1 text-xs capitalize text-neutral-300">
                {client.status}
              </span>
            </div>
            {client.companyName || client.contactName || client.contactEmail ? (
              <p className="mt-3 text-sm text-neutral-400">
                {[client.companyName, client.contactName, client.contactEmail]
                  .filter(Boolean)
                  .join(" - ")}
              </p>
            ) : null}
            <p className="mt-4 max-w-3xl text-neutral-400">
              Use this ledger to prove what was requested, reviewed, approved,
              and shipped.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/app/clients"
              className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-100 transition hover:border-neutral-500"
            >
              Back to clients
            </Link>
            <button
              type="button"
              onClick={openNewProjectForm}
              disabled={isArchived}
              className="rounded-md bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              New Project
            </button>
            <button
              type="button"
              onClick={() => openFeatureForm()}
              disabled={isArchived}
              className="rounded-md border border-blue-800 bg-blue-950/30 px-3 py-2 text-sm font-medium text-blue-100 transition hover:border-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Add Feature Request
            </button>
            <button
              type="button"
              onClick={openEditForm}
              className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-100 transition hover:border-neutral-500"
            >
              Edit Client
            </button>
            <button
              type="button"
              onClick={() => archiveClient.mutate({ clientId })}
              disabled={client.status === "archived" || archiveClient.isPending}
              className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-100 transition hover:border-neutral-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {archiveClient.isPending ? "Archiving..." : "Archive"}
            </button>
          </div>
        </div>

        {showEditForm && activeTab === "notes" ? (
          <form
            onSubmit={onUpdateClient}
            className="rounded-lg border border-neutral-800 bg-neutral-900 p-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-medium">Edit Client</h2>
                <p className="mt-1 text-sm text-neutral-500">
                  Update client identity, contact details, notes, and status.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowEditForm(false)}
                className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-100 transition hover:border-neutral-500"
              >
                Cancel
              </button>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="block text-sm">
                <span className="text-neutral-300">Client name</span>
                <input
                  value={editName}
                  onChange={(event) => setEditName(event.target.value)}
                  className="mt-2 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none transition focus:border-blue-500"
                  required
                />
              </label>
              <label className="block text-sm">
                <span className="text-neutral-300">Company</span>
                <input
                  value={editCompanyName}
                  onChange={(event) => setEditCompanyName(event.target.value)}
                  className="mt-2 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none transition focus:border-blue-500"
                />
              </label>
              <label className="block text-sm">
                <span className="text-neutral-300">Contact</span>
                <input
                  value={editContactName}
                  onChange={(event) => setEditContactName(event.target.value)}
                  className="mt-2 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none transition focus:border-blue-500"
                />
              </label>
              <label className="block text-sm">
                <span className="text-neutral-300">Email</span>
                <input
                  value={editContactEmail}
                  onChange={(event) => setEditContactEmail(event.target.value)}
                  className="mt-2 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none transition focus:border-blue-500"
                  type="email"
                />
              </label>
              <label className="block text-sm">
                <span className="text-neutral-300">Status</span>
                <select
                  value={editStatus}
                  onChange={(event) =>
                    setEditStatus(event.target.value as "active" | "archived")
                  }
                  className="mt-2 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none transition focus:border-blue-500"
                >
                  <option value="active">active</option>
                  <option value="archived">archived</option>
                </select>
              </label>
              <label className="block text-sm md:col-span-2">
                <span className="text-neutral-300">Notes</span>
                <textarea
                  value={editNotes}
                  onChange={(event) => setEditNotes(event.target.value)}
                  className="mt-2 min-h-24 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none transition focus:border-blue-500"
                />
              </label>
            </div>
            {updateClient.error ? (
              <p className="mt-4 text-sm text-red-300">
                {updateClient.error.message}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={!editName.trim() || updateClient.isPending}
              className="mt-5 rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {updateClient.isPending ? "Saving..." : "Save changes"}
            </button>
          </form>
        ) : null}

        {(success ||
          archiveClient.error ||
          attachProject.error ||
          createProject.error ||
          createFeatureRequest.error ||
          detachProject.error) ? (
          <div className="rounded-md border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm">
            {success ? <span className="text-emerald-300">{success}</span> : null}
            {createdFeatureRequestId ? (
              <Link
                href={`/app/features/${createdFeatureRequestId}`}
                className="ml-3 font-medium text-blue-300 underline-offset-4 hover:underline"
              >
                Open feature
              </Link>
            ) : null}
            {archiveClient.error ? (
              <span className="text-red-300">{archiveClient.error.message}</span>
            ) : null}
            {attachProject.error ? (
              <span className="text-red-300">{attachProject.error.message}</span>
            ) : null}
            {createProject.error ? (
              <span className="text-red-300">{createProject.error.message}</span>
            ) : null}
            {createFeatureRequest.error ? (
              <span className="text-red-300">
                {createFeatureRequest.error.message}
              </span>
            ) : null}
            {detachProject.error ? (
              <span className="text-red-300">{detachProject.error.message}</span>
            ) : null}
          </div>
        ) : null}
      </header>

      {isArchived ? (
        <div className="rounded-lg border border-amber-900/60 bg-amber-950/20 p-4 text-sm text-amber-100">
          This client is archived. New project and feature request creation are
          disabled to avoid accidental new work under an archived account.
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Projects" value={summary.projectsCount} />
        <StatCard label="Feature requests" value={summary.featureRequestsCount} />
        <StatCard label="Release reports" value={summary.reportsGeneratedCount} />
        <StatCard
          label="Pending approvals"
          value={summary.pendingApprovalsCount}
          tone={summary.pendingApprovalsCount > 0 ? "amber" : "neutral"}
        />
        <StatCard
          label="Open findings"
          value={summary.openFindingsCount}
          tone={summary.openFindingsCount > 0 ? "red" : "neutral"}
        />
        <RequirementRiskCard
          partial={summary.partialRequirementsCount}
          missing={summary.missingRequirementsCount}
        />
      </div>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-medium">Delivery Health</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Current approval, coverage, and unresolved risk posture.
            </p>
          </div>
          <span className="rounded-full border border-neutral-700 px-3 py-1 text-sm text-neutral-100">
            {healthLabel}
          </span>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Approved releases"
            value={summary.approvedReleasesCount}
            tone="green"
          />
          <StatCard
            label="Changes requested"
            value={summary.changesRequestedCount}
            tone={summary.changesRequestedCount > 0 ? "red" : "neutral"}
          />
          <StatCard
            label="Open findings"
            value={summary.openFindingsCount}
            tone={summary.openFindingsCount > 0 ? "red" : "neutral"}
          />
          <RequirementRiskCard
            label="Requirement risks"
            partial={summary.partialRequirementsCount}
            missing={summary.missingRequirementsCount}
          />
        </div>
      </section>

      <ClientLedgerTabs activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === "notes" ? (
        <section
          id="client-notes-section"
          className="scroll-mt-28 rounded-lg border border-neutral-800 bg-neutral-900 p-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-medium">Client Notes</h2>
              <p className="mt-1 text-sm text-neutral-500">
                Scope, delivery expectations, contact context, and account state.
              </p>
            </div>
            <button
              type="button"
              onClick={openEditForm}
              className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-100 transition hover:border-neutral-500"
            >
              Edit Client
            </button>
          </div>
          {client.notes ? (
            <p className="mt-5 whitespace-pre-wrap text-sm leading-6 text-neutral-300">
              {client.notes}
            </p>
          ) : (
            <p className="mt-5 rounded-md border border-neutral-800 bg-neutral-950 p-4 text-sm text-neutral-400">
              Add notes about scope, delivery expectations, or client
              communication preferences.
            </p>
          )}
        </section>
      ) : null}

      {activeTab === "projects" ? (
      <section
        id="client-projects-section"
        className="scroll-mt-28 grid gap-6 xl:grid-cols-[1fr_380px]"
      >
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-medium">Projects</h2>
              <p className="mt-1 text-sm text-neutral-500">
                Projects that roll up into this client delivery ledger.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (isArchived) {
                  return;
                }

                setShowNewProjectForm((value) => !value);
                setSuccess(null);
              }}
              disabled={isArchived}
              className="rounded-md bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              New Project for this Client
            </button>
          </div>

          {showNewProjectForm ? (
            <form
              onSubmit={onCreateProject}
              className="mt-5 rounded-md border border-neutral-800 bg-neutral-950 p-4"
            >
              <h3 className="font-medium text-neutral-100">
                New Project for this Client
              </h3>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="block text-sm">
                  <span className="text-neutral-300">Project name</span>
                  <input
                    value={newProjectName}
                    onChange={(event) => setNewProjectName(event.target.value)}
                    className="mt-2 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none transition focus:border-blue-500"
                    minLength={2}
                    required
                  />
                </label>
                <label className="block text-sm md:col-span-2">
                  <span className="text-neutral-300">Description</span>
                  <textarea
                    value={newProjectDescription}
                    onChange={(event) =>
                      setNewProjectDescription(event.target.value)
                    }
                    className="mt-2 min-h-24 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none transition focus:border-blue-500"
                  />
                </label>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={
                    isArchived ||
                    newProjectName.trim().length < 2 ||
                    createProject.isPending
                  }
                  className="rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {createProject.isPending ? "Creating..." : "Create project"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewProjectForm(false)}
                  className="rounded-md border border-neutral-700 px-4 py-2 text-sm text-neutral-100 transition hover:border-neutral-500"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : null}

          {ledger.data.projects.length === 0 ? (
            <p className="mt-5 rounded-md border border-neutral-800 bg-neutral-950 p-5 text-sm text-neutral-400">
              Attach or create a project to begin tracking delivery.
            </p>
          ) : null}
          <div className="mt-5 space-y-3">
            {ledger.data.projects.map((project) => (
              <article
                key={project.id}
                className="rounded-md border border-neutral-800 bg-neutral-950 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-medium text-neutral-100">
                      {project.name}
                    </h3>
                    <p className="mt-1 text-sm text-neutral-500">
                      {project.featureRequestsCount} feature requests - latest
                      activity {formatDate(project.latestActivityAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href="/app/features"
                      className="rounded-md border border-neutral-700 px-3 py-2 text-xs text-neutral-100 transition hover:border-neutral-500"
                    >
                      Open features
                    </Link>
                    <button
                      type="button"
                      onClick={() => openFeatureForm(project.id)}
                      disabled={isArchived}
                      className="rounded-md border border-neutral-700 px-3 py-2 text-xs text-neutral-100 transition hover:border-neutral-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Add feature
                    </button>
                    <button
                      type="button"
                      onClick={() => onDetach(project.id)}
                      disabled={isArchived || detachProject.isPending}
                      className="rounded-md border border-neutral-700 px-3 py-2 text-xs text-neutral-100 transition hover:border-neutral-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Detach
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        <form
          onSubmit={onAttach}
          className="rounded-lg border border-neutral-800 bg-neutral-900 p-5"
        >
          <h2 className="text-lg font-medium">Link Existing Workspace Project</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Already created a project? Link it to this client delivery ledger.
          </p>

          {attachableProjects.length > 0 ? (
            <>
              <label className="mt-5 block text-sm">
                <span className="text-neutral-300">Project</span>
                <select
                  value={projectId}
                  onChange={(event) => setProjectId(event.target.value)}
                  disabled={isArchived}
                  className="mt-2 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none transition focus:border-blue-500"
                >
                  <option value="">Select a project</option>
                  {attachableProjects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="submit"
                disabled={isArchived || !projectId || attachProject.isPending}
                className="mt-5 w-full rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {attachProject.isPending ? "Linking..." : "Link Project"}
              </button>
            </>
          ) : (
            <div className="mt-5 rounded-md border border-neutral-800 bg-neutral-950 p-4 text-sm text-neutral-400">
              No unattached workspace projects are available. Create a new
              project for this client to start tracking delivery here.
            </div>
          )}

          {projects.isLoading ? (
            <p className="mt-3 text-sm text-neutral-500">Loading projects...</p>
          ) : null}
          {projects.error ? (
            <p className="mt-3 text-sm text-red-300">{projects.error.message}</p>
          ) : null}
        </form>
      </section>
      ) : null}

      {activeTab === "ledger" ? (
      <section
        id="client-ledger-section"
        className="scroll-mt-28 rounded-lg border border-neutral-800 bg-neutral-900 p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-medium">Delivery Ledger</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Feature requests grouped through this client's linked projects.
            </p>
          </div>
          <button
            type="button"
            onClick={() => openFeatureForm()}
            disabled={isArchived}
            className="rounded-md bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add Feature Request
          </button>
        </div>

        {showFeatureForm ? (
          <form
            onSubmit={onCreateFeatureRequest}
            className="mt-5 rounded-md border border-neutral-800 bg-neutral-950 p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-medium text-neutral-100">
                  Add Feature Request
                </h3>
                <p className="mt-1 text-sm text-neutral-500">
                  Create the client request under one of this client's projects.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowFeatureForm(false)}
                className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-100 transition hover:border-neutral-500"
              >
                Cancel
              </button>
            </div>

            {ledger.data.projects.length === 0 ? (
              <p className="mt-4 rounded-md border border-neutral-800 bg-neutral-900 p-4 text-sm text-neutral-400">
                Create a project for this client before adding feature requests.
              </p>
            ) : (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="block text-sm">
                  <span className="text-neutral-300">Project</span>
                  <select
                    value={featureProjectId}
                    onChange={(event) => setFeatureProjectId(event.target.value)}
                    className="mt-2 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none transition focus:border-blue-500"
                    required
                  >
                    <option value="">Select a project</option>
                    {ledger.data.projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-sm">
                  <span className="text-neutral-300">Priority</span>
                  <select
                    value={featurePriority}
                    onChange={(event) =>
                      setFeaturePriority(
                        event.target.value as (typeof featurePriorities)[number]
                      )
                    }
                    className="mt-2 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none transition focus:border-blue-500"
                  >
                    {featurePriorities.map((priority) => (
                      <option key={priority} value={priority}>
                        {priority}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-sm md:col-span-2">
                  <span className="text-neutral-300">Feature title</span>
                  <input
                    value={featureTitle}
                    onChange={(event) => setFeatureTitle(event.target.value)}
                    className="mt-2 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none transition focus:border-blue-500"
                    placeholder="Add role-based approval gates"
                    minLength={2}
                    required
                  />
                </label>

                <label className="block text-sm md:col-span-2">
                  <span className="text-neutral-300">
                    Description / client request
                  </span>
                  <textarea
                    value={featureDescription}
                    onChange={(event) =>
                      setFeatureDescription(event.target.value)
                    }
                    className="mt-2 min-h-28 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none transition focus:border-blue-500"
                    placeholder="What should be built and who needs it?"
                    required
                  />
                </label>

                <label className="block text-sm md:col-span-2">
                  <span className="text-neutral-300">Business goal</span>
                  <textarea
                    value={featureBusinessGoal}
                    onChange={(event) =>
                      setFeatureBusinessGoal(event.target.value)
                    }
                    className="mt-2 min-h-20 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none transition focus:border-blue-500"
                    placeholder="Why does this matter?"
                  />
                </label>

                <label className="block text-sm md:col-span-2">
                  <span className="text-neutral-300">Expected behavior</span>
                  <textarea
                    value={featureExpectedBehavior}
                    onChange={(event) =>
                      setFeatureExpectedBehavior(event.target.value)
                    }
                    className="mt-2 min-h-20 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none transition focus:border-blue-500"
                    placeholder="What should happen when it works?"
                  />
                </label>

                <label className="block text-sm md:col-span-2">
                  <span className="text-neutral-300">Acceptance criteria</span>
                  <textarea
                    value={featureAcceptanceCriteria}
                    onChange={(event) =>
                      setFeatureAcceptanceCriteria(event.target.value)
                    }
                    className="mt-2 min-h-24 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none transition focus:border-blue-500"
                    placeholder="One criterion per line"
                  />
                </label>
              </div>
            )}

            {ledger.data.projects.length > 0 ? (
              <button
                type="submit"
                disabled={
                  isArchived ||
                  !featureProjectId ||
                  featureTitle.trim().length < 2 ||
                  featureDescription.trim().length === 0 ||
                  createFeatureRequest.isPending
                }
                className="mt-5 rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {createFeatureRequest.isPending
                  ? "Creating..."
                  : "Create Feature Request"}
              </button>
            ) : null}
          </form>
        ) : null}

        {ledger.data.deliveryItems.length === 0 ? (
          <p className="mt-5 rounded-md border border-neutral-800 bg-neutral-950 p-5 text-sm text-neutral-400">
            No feature requests are attached to this client yet. Add a feature
            request once this client has at least one linked project.
          </p>
        ) : null}
        <div className="mt-5 space-y-3">
          {ledger.data.deliveryItems.map((item) => {
            const reportShareToken = item.latestReleaseReport?.shareToken;
            const actionHref = getActionHref({
              nextAction: item.nextAction,
              featureRequestId: item.featureRequestId,
              reportShareToken
            });
            const actionLabel = getActionLabel({
              nextAction: item.nextAction,
              reportShareToken
            });

            return (
              <article
                key={item.featureRequestId}
                className="rounded-md border border-neutral-800 bg-neutral-950 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="font-medium text-neutral-100">
                      {item.featureTitle}
                    </h3>
                    <p className="mt-1 text-sm text-neutral-500">
                      {item.projectName} - {formatStatus(item.featureStatus)}
                    </p>
                    <span className="mt-3 inline-flex rounded-full border border-blue-900/60 bg-blue-950/30 px-2.5 py-1 text-xs text-blue-200">
                      {nextActionBadges[item.nextAction]}
                    </span>
                  </div>
                  <Link
                    href={actionHref}
                    className="rounded-md bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-950 transition hover:bg-white"
                  >
                    {actionLabel}
                  </Link>
                </div>

                <div className="mt-4 grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-5">
                  <p className="text-neutral-400">
                    QA:{" "}
                    <span className="text-neutral-100">
                      {item.latestQaReview
                        ? `${formatStatus(item.latestQaReview.overallStatus)} - ${
                            item.latestQaReview.readinessScore ?? "n/a"
                          }`
                        : "Not run"}
                    </span>
                  </p>
                  <div className="text-neutral-400">
                    Coverage:
                    <div className="mt-1 text-neutral-100">
                      {item.coverageSummary ? (
                        <>
                          <p>Covered: {item.coverageSummary.covered}</p>
                          <p>Partial: {item.coverageSummary.partial}</p>
                          <p>Missing: {item.coverageSummary.missing}</p>
                        </>
                      ) : (
                        "n/a"
                      )}
                    </div>
                  </div>
                  <p className="text-neutral-400">
                    Approval:{" "}
                    <span className="text-neutral-100">
                      {formatStatus(item.latestApproval?.decision)}
                    </span>
                  </p>
                  <p className="text-neutral-400">
                    Open findings:{" "}
                    <span className="text-neutral-100">
                      {item.findingsSummary?.open ?? 0}
                    </span>
                  </p>
                  <p className="text-neutral-400">
                    Report:{" "}
                    <span className="text-neutral-100">
                      {item.latestReleaseReport ? "Generated" : "Not generated"}
                    </span>
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </section>
      ) : null}

      {activeTab === "reports" ? (
      <section
        id="client-reports-section"
        className="scroll-mt-28 rounded-lg border border-neutral-800 bg-neutral-900 p-5"
      >
        <h2 className="text-lg font-medium">Release Report Archive</h2>
        {ledger.data.reportArchive.length === 0 ? (
          <p className="mt-5 rounded-md border border-neutral-800 bg-neutral-950 p-5 text-sm text-neutral-400">
            No release reports generated yet. Approved features will appear
            here after a release report is generated.
          </p>
        ) : null}
        <div className="mt-5 space-y-3">
          {ledger.data.reportArchive.map((report) => (
            <article
              key={report.reportId}
              className="rounded-md border border-neutral-800 bg-neutral-950 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="font-medium text-neutral-100">
                    {report.featureTitle}
                  </h3>
                  <p className="mt-1 text-sm text-neutral-500">
                    {report.projectName} - {formatStatus(report.status)} -
                    generated {formatDate(report.generatedAt ?? report.createdAt)}
                  </p>
                </div>
                <Link
                  href={`/reports/${report.shareToken}`}
                  className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-100 transition hover:border-neutral-500"
                >
                  Open public report
                </Link>
              </div>
              <p className="mt-3 text-sm text-neutral-400">
                Decision: {formatStatus(report.finalDecision)} - readiness{" "}
                {report.readinessScore ?? "n/a"}
              </p>
            </article>
          ))}
        </div>
      </section>
      ) : null}

      {activeTab === "risks" ? (
      <section
        id="client-risks-section"
        className="scroll-mt-28 rounded-lg border border-neutral-800 bg-neutral-900 p-5"
      >
        <h2 className="text-lg font-medium">Risks and Pending Actions</h2>
        {ledger.data.risks.length === 0 ? (
          <p className="mt-5 rounded-md border border-neutral-800 bg-neutral-950 p-5 text-sm text-neutral-400">
            No unresolved risks recorded for this client. Missing requirements,
            open QA findings, pending approvals, and blocked reports will appear
            here when they need attention.
          </p>
        ) : null}
        <div className="mt-5 space-y-3">
          {ledger.data.risks.map((risk, index) => {
            const hasReport = Boolean(risk.reportShareToken);

            return (
              <article
                key={`${risk.featureRequestId}-${risk.type}-${index}`}
                className="rounded-md border border-neutral-800 bg-neutral-950 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full border border-neutral-700 px-2.5 py-1 text-xs text-neutral-300">
                        {riskLabels[risk.type]}
                      </span>
                      {risk.severity ? (
                        <span className="rounded-full border border-red-900/60 px-2.5 py-1 text-xs text-red-200">
                          {risk.severity}
                        </span>
                      ) : null}
                    </div>
                    <h3 className="mt-3 font-medium text-neutral-100">
                      {risk.title}
                    </h3>
                    <p className="mt-1 text-sm text-neutral-500">
                      {risk.featureTitle} - {risk.projectName}
                    </p>
                  </div>
                  <Link
                    href={
                      hasReport
                        ? `/reports/${risk.reportShareToken}`
                        : `/app/features/${risk.featureRequestId}`
                    }
                    className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-100 transition hover:border-neutral-500"
                  >
                    {hasReport ? "Open report" : "Open feature"}
                  </Link>
                </div>
                <p className="mt-3 text-sm leading-6 text-neutral-400">
                  {risk.description}
                </p>
              </article>
            );
          })}
        </div>
      </section>
      ) : null}
    </div>
  );
}
