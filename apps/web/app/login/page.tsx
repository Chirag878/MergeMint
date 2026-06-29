"use client";

import { useState } from "react";
import { authClient, type OAuthProvider } from "@veriflow/auth/client";

const postLoginPath = "/app";

function getSafeCallbackURL() {
  if (typeof window === "undefined") {
    return postLoginPath;
  }

  const params = new URLSearchParams(window.location.search);
  const callbackURL = params.get("callbackURL") ?? params.get("next");

  return callbackURL?.startsWith("/") && !callbackURL.startsWith("//")
    ? callbackURL
    : postLoginPath;
}

const providers: Array<{
  id: OAuthProvider;
  label: string;
  variant: "primary" | "secondary";
}> = [
  {
    id: "github",
    label: "Continue with GitHub",
    variant: "primary"
  },
  {
    id: "google",
    label: "Continue with Google",
    variant: "secondary"
  }
];

export default function LoginPage() {
  const session = authClient.useSession();
  const [pendingProvider, setPendingProvider] = useState<OAuthProvider | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  if (session.data?.user && typeof window !== "undefined") {
    window.location.replace(getSafeCallbackURL());
  }

  async function signIn(provider: OAuthProvider) {
    setPendingProvider(provider);
    setError(null);

    const result = await authClient.signIn.social({
      provider,
      callbackURL: getSafeCallbackURL()
    });

    if (result.error) {
      setError(result.error.message ?? "Unable to start sign in.");
      setPendingProvider(null);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 px-6 py-10 text-neutral-100">
      <section className="w-full max-w-md rounded-xl border border-neutral-800 bg-neutral-900 p-8 shadow-2xl">
        <p className="text-sm font-medium uppercase tracking-[0.28em] text-blue-400">
          MergeMint
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">
          Sign in to verify your next release.
        </h1>

        <div className="mt-8 space-y-3">
          {providers.map((provider) => (
            <button
              key={provider.id}
              type="button"
              disabled={Boolean(pendingProvider)}
              onClick={() => void signIn(provider.id)}
              className={
                provider.variant === "primary"
                  ? "h-11 w-full rounded-md bg-neutral-100 px-4 text-sm font-medium text-neutral-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                  : "h-11 w-full rounded-md border border-neutral-700 bg-neutral-950 px-4 text-sm font-medium text-neutral-100 transition hover:border-neutral-500 disabled:cursor-not-allowed disabled:opacity-60"
              }
            >
              {pendingProvider === provider.id ? "Redirecting..." : provider.label}
            </button>
          ))}
        </div>

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
      </section>
    </main>
  );
}
