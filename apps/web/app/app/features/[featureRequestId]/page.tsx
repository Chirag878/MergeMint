import { ensureUserWorkspace } from "@veriflow/api";
import { FeatureDetailClient } from "./feature-detail-client";
import { requireWebSession } from "../../../server-auth";

export default async function FeatureDetailPage({
  params
}: {
  params: Promise<{ featureRequestId: string }>;
}) {
  const session = await requireWebSession();
  const workspace = await ensureUserWorkspace({
    user: session.user,
    session: session.session
  });
  const { featureRequestId } = await params;

  return (
    <main className="vf-app-page min-h-screen px-5 py-8 text-neutral-100 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-7xl space-y-8">
        <p className="vf-page-eyebrow">
          {workspace.activeOrganization.name}
        </p>
        <FeatureDetailClient featureRequestId={featureRequestId} />
      </section>
    </main>
  );
}
