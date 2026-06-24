import { ensureUserWorkspace } from "@veriflow/api";
import { requireWebSession } from "../server-auth";
import { DashboardClient } from "./dashboard-client";

export default async function AppPage() {
  const session = await requireWebSession();

  await ensureUserWorkspace({
    user: session.user,
    session: session.session
  });

  return (
    <DashboardClient userLabel={session.user.name || session.user.email} />
  );
}
