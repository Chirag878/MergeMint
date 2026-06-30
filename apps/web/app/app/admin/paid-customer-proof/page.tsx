import { revalidatePath } from "next/cache";
import {
  getPaidCustomerProof,
  removePaidCustomerProof,
  savePaidCustomerProof
} from "@veriflow/api";
import { requireWebSession } from "../../../server-auth";

function isAdminEmail(email?: string | null) {
  const admins = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  return Boolean(email && admins.includes(email.toLowerCase()));
}

async function getAdminContext() {
  const session = await requireWebSession("/app/admin/paid-customer-proof");

  if (!isAdminEmail(session.user.email)) {
    throw new Error("Your signed-in email is not listed in ADMIN_EMAILS.");
  }

  return {
    req: new Request("https://mergemint.local/admin/paid-customer-proof"),
    requestId: crypto.randomUUID(),
    user: session.user,
    session: session.session
  };
}

async function saveProofAction(formData: FormData) {
  "use server";

  const ctx = await getAdminContext();
  await savePaidCustomerProof(ctx, {
    imageUrl: String(formData.get("imageUrl") ?? ""),
    amountLabel: String(formData.get("amountLabel") ?? ""),
    statusLabel: String(formData.get("statusLabel") ?? ""),
    dateLabel: String(formData.get("dateLabel") ?? "")
  });

  revalidatePath("/paid-user-proof");
  revalidatePath("/app/admin/paid-customer-proof");
}

async function removeProofAction() {
  "use server";

  const ctx = await getAdminContext();
  await removePaidCustomerProof(ctx);

  revalidatePath("/paid-user-proof");
  revalidatePath("/app/admin/paid-customer-proof");
}

export default async function PaidCustomerProofAdminPage() {
  const session = await requireWebSession("/app/admin/paid-customer-proof");

  if (!isAdminEmail(session.user.email)) {
    return (
      <main className="vf-app-page min-h-screen px-5 py-8 text-[var(--text)] sm:px-6 lg:px-8">
        <section className="mx-auto max-w-3xl rounded-lg border border-red-900/60 bg-red-950/30 p-6 text-red-100">
          <h1 className="text-2xl font-semibold">Paid proof admin access denied</h1>
          <p className="mt-3 text-sm leading-6">
            Your signed-in email is not listed in ADMIN_EMAILS.
          </p>
        </section>
      </main>
    );
  }

  const proof = await getPaidCustomerProof();

  return (
    <main className="vf-app-page min-h-screen px-5 py-8 text-[var(--text)] sm:px-6 lg:px-8">
      <section className="mx-auto max-w-4xl space-y-8">
        <div className="vf-page-hero">
          <p className="vf-page-eyebrow">Owner tools</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            Paid customer proof
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-muted)] sm:text-base">
            Add a URL for a redacted payment proof image. Never store customer
            name, email, phone, UPI, address, transaction id, or private data.
          </p>
        </div>

        <form action={saveProofAction} className="space-y-5 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
          <label className="block text-sm font-medium">
            Proof image URL
            <input
              name="imageUrl"
              type="url"
              required
              defaultValue={proof?.imageUrl ?? ""}
              placeholder="https://..."
              className="mt-2 w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] outline-none transition focus:border-[#E8C999]/50"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="block text-sm font-medium">
              Optional amount label
              <input
                name="amountLabel"
                defaultValue={proof?.amountLabel ?? ""}
                placeholder="Redacted amount"
                className="mt-2 w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] outline-none transition focus:border-[#E8C999]/50"
              />
            </label>
            <label className="block text-sm font-medium">
              Optional status label
              <input
                name="statusLabel"
                defaultValue={proof?.statusLabel ?? "Paid / Captured"}
                className="mt-2 w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] outline-none transition focus:border-[#E8C999]/50"
              />
            </label>
            <label className="block text-sm font-medium">
              Optional date label
              <input
                name="dateLabel"
                defaultValue={proof?.dateLabel ?? ""}
                placeholder="Month YYYY"
                className="mt-2 w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] outline-none transition focus:border-[#E8C999]/50"
              />
            </label>
          </div>

          <p className="rounded-md border border-amber-900/50 bg-amber-950/20 p-3 text-xs leading-5 text-amber-100">
            Only add a redacted image URL. Do not store private customer or
            transaction-identifying details.
          </p>

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              className="rounded-md bg-[#E8C999] px-4 py-2 text-sm font-semibold text-[#120707] transition hover:bg-[#F8EEDF]"
            >
              Save
            </button>
          </div>
        </form>

        <form action={removeProofAction} className="rounded-lg border border-red-900/50 bg-red-950/20 p-6">
          <h2 className="text-lg font-semibold text-red-100">Remove proof</h2>
          <p className="mt-2 text-sm leading-6 text-red-100/70">
            This removes the public proof image from `/paid-user-proof`.
          </p>
          <button
            type="submit"
            className="mt-4 rounded-md border border-red-800 px-4 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-950"
          >
            Remove proof
          </button>
        </form>
      </section>
    </main>
  );
}
