import Link from "next/link";

export default function PricingPage() {
  const paymentLink = process.env.NEXT_PUBLIC_PAYMENT_LINK;
  const ctaHref = paymentLink ?? "/login";

  return (
    <main className="min-h-screen bg-[#060706] px-5 py-10 text-neutral-100 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-4xl">
        <Link href="/" className="text-sm text-neutral-500 transition hover:text-white">
          Back to Veriflow
        </Link>

        <div className="mt-10 rounded-lg border border-amber-300/20 bg-[linear-gradient(135deg,rgba(245,158,11,0.14),rgba(16,185,129,0.1),rgba(255,255,255,0.03))] p-6 shadow-2xl shadow-black/30 sm:p-8 lg:p-10">
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-amber-200">
            Founding pilot
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white">
            Founding Pilot ₹2,999
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-neutral-300">
            Verify five real PRs with AI requirement coverage, human approval,
            and client-ready release reports.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {[
              "5 PR verifications",
              "AI requirement coverage review",
              "Human approval workflow",
              "Shareable release reports",
              "Founder-assisted onboarding"
            ].map((item) => (
              <div
                key={item}
                className="rounded-md border border-white/10 bg-black/25 p-4 text-sm text-neutral-300"
              >
                {item}
              </div>
            ))}
          </div>

          <Link
            href={ctaHref}
            className="mt-8 inline-flex rounded-md bg-white px-5 py-3 text-sm font-semibold text-neutral-950 transition hover:bg-neutral-100"
          >
            Start founding pilot
          </Link>
        </div>
      </section>
    </main>
  );
}
