import Link from "next/link";
import { getPaidCustomerProof } from "@veriflow/api";

export const metadata = {
  title: "Paid Customer Validation | MergeMint",
  description: "MergeMint paid customer/payment validation proof page."
};

export const dynamic = "force-dynamic";

export default async function PaidUserProofPage() {
  const proof = await getPaidCustomerProof();

  return (
    <main className="min-h-screen bg-[#050202] px-5 py-10 text-[#F8EEDF] sm:px-6 lg:px-8">
      <section className="mx-auto max-w-4xl">
        <nav className="mb-10 flex items-center justify-between text-sm">
          <Link href="/" className="font-semibold text-[#F8EEDF]">
            MergeMint
          </Link>
          <Link href="/login" className="text-[#E8C999]/70 transition hover:text-[#F8EEDF]">
            Sign in
          </Link>
        </nav>

        <div className="rounded-2xl border border-[#E8C999]/14 bg-[#120707]/82 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#E8C999]/70">
            Customer proof
          </p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-5xl">
            Paid Customer Validation
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[#ECD5BC]/72">
            MergeMint has received real paid customer/payment validation.
          </p>

          <div className="mt-8 rounded-xl border border-[#E8C999]/12 bg-[#050202]/70 p-4 sm:p-5">
            {proof ? (
              <div className="space-y-5">
                <div className="overflow-hidden rounded-lg border border-[#E8C999]/12 bg-black">
                  <img
                    src={proof.imageUrl}
                    alt="Redacted paid customer payment proof"
                    className="max-h-[640px] w-full object-contain"
                  />
                </div>
                <div className="flex flex-wrap gap-2 text-xs font-medium text-[#ECD5BC]/70">
                  {proof.statusLabel ? (
                    <span className="rounded-full border border-[#E8C999]/18 bg-[#E8C999]/8 px-3 py-1">
                      {proof.statusLabel}
                    </span>
                  ) : null}
                  {proof.amountLabel ? (
                    <span className="rounded-full border border-[#E8C999]/18 bg-[#E8C999]/8 px-3 py-1">
                      {proof.amountLabel}
                    </span>
                  ) : null}
                  {proof.dateLabel ? (
                    <span className="rounded-full border border-[#E8C999]/18 bg-[#E8C999]/8 px-3 py-1">
                      {proof.dateLabel}
                    </span>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="flex min-h-72 items-center justify-center rounded-lg border border-dashed border-[#E8C999]/18 bg-[#0A0404] p-8 text-center">
                <p className="text-sm text-[#ECD5BC]/62">
                  No redacted payment proof has been added yet.
                </p>
              </div>
            )}
          </div>

          <p className="mt-5 rounded-lg border border-[#E8C999]/12 bg-[#E8C999]/6 p-4 text-sm leading-6 text-[#ECD5BC]/70">
            Customer-identifying details are intentionally hidden for privacy.
          </p>
        </div>
      </section>
    </main>
  );
}
