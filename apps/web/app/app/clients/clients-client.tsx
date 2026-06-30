"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { trpc } from "@/trpc/react";

function formatCount(value: number, label: string) {
  return `${value} ${label}${value === 1 ? "" : "s"}`;
}

export function ClientsClient() {
  const utils = trpc.useUtils();
  const clients = trpc.clients.list.useQuery();
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [success, setSuccess] = useState<string | null>(null);

  const createClient = trpc.clients.create.useMutation({
    onSuccess: (client) => {
      utils.clients.list.setData(undefined, (current) => {
        const createdClient = {
          ...client,
          projectsCount: 0,
          featureRequestsCount: 0,
          reportsCount: 0,
          openFindingsCount: 0,
          pendingApprovalsCount: 0
        };

        return current ? [createdClient, ...current] : [createdClient];
      });
      utils.clients.listBasic.setData(undefined, (current) =>
        current ? [client, ...current] : [client]
      );
      setName("");
      setCompanyName("");
      setContactName("");
      setContactEmail("");
      setNotes("");
      setSuccess("Client created.");
      void utils.clients.list.invalidate();
      void utils.clients.listBasic.invalidate();
    }
  });

  const canSubmit = name.trim().length > 0 && !createClient.isPending;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }

    setSuccess(null);
    createClient.mutate({
      name: name.trim(),
      companyName: companyName.trim() || undefined,
      contactName: contactName.trim() || undefined,
      contactEmail: contactEmail.trim() || undefined,
      notes: notes.trim() || undefined
    });
  }

  return (
    <div className="vf-clients-screen grid gap-6 xl:grid-cols-[380px_1fr]">
      <form
        onSubmit={onSubmit}
        className="vf-client-compose space-y-4 rounded-lg border border-neutral-800 bg-neutral-900 p-5"
      >
        <div>
          <h2 className="text-lg font-medium">Add Client</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Create a private agency ledger scoped to this workspace.
          </p>
        </div>

        <label className="block text-sm">
          <span className="text-neutral-300">Client name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-2 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none transition focus:border-blue-500"
            placeholder="Acme launch team"
            required
          />
        </label>

        <label className="block text-sm">
          <span className="text-neutral-300">Company</span>
          <input
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
            className="mt-2 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none transition focus:border-blue-500"
            placeholder="Acme"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <label className="block text-sm">
            <span className="text-neutral-300">Contact</span>
            <input
              value={contactName}
              onChange={(event) => setContactName(event.target.value)}
              className="mt-2 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none transition focus:border-blue-500"
              placeholder="Priya Sharma"
            />
          </label>

          <label className="block text-sm">
            <span className="text-neutral-300">Email</span>
            <input
              value={contactEmail}
              onChange={(event) => setContactEmail(event.target.value)}
              className="mt-2 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none transition focus:border-blue-500"
              placeholder="client@example.com"
              type="email"
            />
          </label>
        </div>

        <label className="block text-sm">
          <span className="text-neutral-300">Notes</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="mt-2 min-h-24 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none transition focus:border-blue-500"
            placeholder="Delivery context, stakeholder notes, or contract scope"
          />
        </label>

        {createClient.error ? (
          <p className="text-sm text-red-300">{createClient.error.message}</p>
        ) : null}
        {success ? <p className="text-sm text-emerald-300">{success}</p> : null}

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {createClient.isPending ? "Creating..." : "Add Client"}
        </button>
      </form>

      <section className="space-y-4">
        {clients.isLoading ? (
          <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-5 text-sm text-neutral-400">
            Loading...
          </div>
        ) : null}

        {clients.error ? (
          <div className="rounded-lg border border-red-900/60 bg-red-950/30 p-5 text-sm text-red-200">
            {clients.error.message}
          </div>
        ) : null}

        {!clients.isLoading && !clients.error && clients.data?.length === 0 ? (
          <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-8 text-sm text-neutral-400">
            No clients yet. Add your first client to start building a delivery
            ledger.
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          {clients.data?.map((client) => (
            <article
              key={client.id}
              className="rounded-lg border border-neutral-800 bg-neutral-900 p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-medium text-neutral-100">
                    {client.name}
                  </h2>
                  {client.companyName ? (
                    <p className="mt-1 text-sm text-blue-300">
                      {client.companyName}
                    </p>
                  ) : null}
                </div>
                <span className="rounded-full border border-neutral-700 px-2.5 py-1 text-xs capitalize text-neutral-300">
                  {client.status}
                </span>
              </div>

              {client.contactName || client.contactEmail ? (
                <p className="mt-4 text-sm text-neutral-400">
                  {[client.contactName, client.contactEmail]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              ) : null}

              <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-md border border-neutral-800 bg-neutral-950 p-3">
                  <p className="text-neutral-500">Projects</p>
                  <p className="mt-1 font-medium text-neutral-100">
                    {client.projectsCount}
                  </p>
                </div>
                <div className="rounded-md border border-neutral-800 bg-neutral-950 p-3">
                  <p className="text-neutral-500">Features</p>
                  <p className="mt-1 font-medium text-neutral-100">
                    {client.featureRequestsCount}
                  </p>
                </div>
                <div className="rounded-md border border-neutral-800 bg-neutral-950 p-3">
                  <p className="text-neutral-500">Reports</p>
                  <p className="mt-1 font-medium text-neutral-100">
                    {client.reportsCount}
                  </p>
                </div>
                <div className="rounded-md border border-neutral-800 bg-neutral-950 p-3">
                  <p className="text-neutral-500">Open risks</p>
                  <p className="mt-1 font-medium text-neutral-100">
                    {client.openFindingsCount}
                  </p>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between gap-3 text-sm">
                <p className="text-neutral-500">
                  {formatCount(client.pendingApprovalsCount, "pending approval")}
                </p>
                <Link
                  href={`/app/clients/${client.id}`}
                  className="rounded-md bg-neutral-100 px-3 py-2 font-medium text-neutral-950 transition hover:bg-white"
                >
                  Open ledger
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
