import { desc, eq } from "drizzle-orm";
import { auditLogs, db, type JsonObject } from "@veriflow/db";
import type { TRPCContext } from "../context";
import { ensureUserWorkspace } from "./workspace-bootstrap.service";

type ProtectedContext = TRPCContext & {
  user: NonNullable<TRPCContext["user"]>;
  session: NonNullable<TRPCContext["session"]>;
};

export type PaidCustomerProof = {
  imageUrl: string;
  amountLabel: string | null;
  statusLabel: string | null;
  dateLabel: string | null;
  updatedAt: Date;
};

function toBootstrapInput(ctx: ProtectedContext) {
  return {
    user: ctx.user,
    session: ctx.session
  };
}

function readProofMetadata(metadata: JsonObject): Omit<PaidCustomerProof, "updatedAt"> | null {
  const imageUrl = typeof metadata.imageUrl === "string" ? metadata.imageUrl.trim() : "";

  if (!imageUrl) {
    return null;
  }

  return {
    imageUrl,
    amountLabel:
      typeof metadata.amountLabel === "string" && metadata.amountLabel.trim()
        ? metadata.amountLabel.trim()
        : null,
    statusLabel:
      typeof metadata.statusLabel === "string" && metadata.statusLabel.trim()
        ? metadata.statusLabel.trim()
        : null,
    dateLabel:
      typeof metadata.dateLabel === "string" && metadata.dateLabel.trim()
        ? metadata.dateLabel.trim()
        : null
  };
}

export async function getPaidCustomerProof(): Promise<PaidCustomerProof | null> {
  const [latest] = await db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.entityType, "paid_customer_proof"))
    .orderBy(desc(auditLogs.createdAt))
    .limit(1);

  if (!latest || latest.action === "paid_customer_proof_removed") {
    return null;
  }

  const proof = readProofMetadata(latest.metadata);
  return proof ? { ...proof, updatedAt: latest.createdAt } : null;
}

export async function savePaidCustomerProof(
  ctx: ProtectedContext,
  input: {
    imageUrl: string;
    amountLabel?: string | null;
    statusLabel?: string | null;
    dateLabel?: string | null;
  }
) {
  const workspace = await ensureUserWorkspace(toBootstrapInput(ctx));
  const imageUrl = input.imageUrl.trim();

  if (!imageUrl) {
    throw new Error("Proof image URL is required.");
  }

  await db.insert(auditLogs).values({
    organizationId: workspace.activeOrganization.id,
    actorId: workspace.appUser.id,
    action: "paid_customer_proof_updated",
    entityType: "paid_customer_proof",
    metadata: {
      imageUrl,
      amountLabel: input.amountLabel?.trim() || null,
      statusLabel: input.statusLabel?.trim() || "Paid / Captured",
      dateLabel: input.dateLabel?.trim() || null
    }
  });
}

export async function removePaidCustomerProof(ctx: ProtectedContext) {
  const workspace = await ensureUserWorkspace(toBootstrapInput(ctx));

  await db.insert(auditLogs).values({
    organizationId: workspace.activeOrganization.id,
    actorId: workspace.appUser.id,
    action: "paid_customer_proof_removed",
    entityType: "paid_customer_proof",
    metadata: {}
  });
}
