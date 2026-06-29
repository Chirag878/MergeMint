import { ensureUserWorkspace } from "@veriflow/api";
import { requireWebSession } from "../../server-auth";
import { WelcomeClient } from "./welcome-client";

export default async function WelcomePage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireWebSession();
  await ensureUserWorkspace({
    user: session.user,
    session: session.session
  });

  const params: Record<string, string | string[] | undefined> =
    await Promise.resolve(searchParams ?? {});
  const payment = typeof params.payment === "string" ? params.payment : undefined;

  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-6 lg:px-8">
      <WelcomeClient payment={payment} />
    </main>
  );
}
