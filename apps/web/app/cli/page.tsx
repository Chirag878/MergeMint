import Link from "next/link";

const commandExamples = [
  "npx mergemint verify --feature feat_123 --pr 135",
  "npx mergemint report --feature feat_123",
  "npx mergemint rules check --repo owner/repo --pr 135"
];

const actionExample = `name: MergeMint Verification

on:
  pull_request:
    types: [opened, synchronize, reopened, ready_for_review]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: mergemint/verify-pr@v1
        with:
          feature_id: feat_123
          pr_number: \${{ github.event.pull_request.number }}`;

export default function CliPreviewPage() {
  return (
    <main className="min-h-screen bg-neutral-950 px-5 py-10 text-neutral-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <nav className="mb-10 flex items-center justify-between gap-4 text-sm">
          <Link href="/" className="font-semibold text-neutral-100">
            MergeMint
          </Link>
          <div className="flex gap-4 text-neutral-400">
            <Link href="/pricing" className="hover:text-neutral-100">
              Pricing
            </Link>
            <Link href="/app" className="hover:text-neutral-100">
              Dashboard
            </Link>
          </div>
        </nav>

        <section className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-emerald-300">
            Terminal workflow preview
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
            MergeMint CLI
          </h1>
          <p className="mt-5 text-base leading-7 text-neutral-400">
            Today, the supported path is the GitHub App plus the MergeMint web
            dashboard. CLI and GitHub Action workflows are a preview direction
            for terminal-native teams, not a published npm package yet.
          </p>
        </section>

        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
            <h2 className="text-lg font-medium">CLI Preview Commands</h2>
            <div className="mt-4 space-y-3">
              {commandExamples.map((command) => (
                <pre
                  key={command}
                  className="overflow-x-auto rounded-md bg-neutral-950 p-3 text-sm text-emerald-200"
                >
                  <code>{command}</code>
                </pre>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
            <h2 className="text-lg font-medium">GitHub Action Preview</h2>
            <pre className="mt-4 overflow-x-auto rounded-md bg-neutral-950 p-3 text-sm text-blue-100">
              <code>{actionExample}</code>
            </pre>
          </section>
        </div>

        <section className="mt-6 rounded-lg border border-amber-800 bg-amber-950/25 p-5 text-sm text-amber-100">
          <p className="font-semibold">Preview status</p>
          <p className="mt-2 leading-6">
            These examples show the intended terminal workflow. For real PR
            verification today, connect the GitHub App, link a PR inside
            MergeMint, run AI QA Review, and publish GitHub proof from the
            protected app.
          </p>
        </section>
      </div>
    </main>
  );
}
