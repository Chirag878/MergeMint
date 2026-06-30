import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  projects,
  verificationRules,
  type VerificationRuleScope,
  type VerificationRuleSeverity
} from "@veriflow/db";
import { assertRoleCan } from "../authz";
import type { TRPCContext } from "../context";
import { ensureUserWorkspace } from "./workspace-bootstrap.service";

type ProtectedContext = TRPCContext & {
  user: NonNullable<TRPCContext["user"]>;
  session: NonNullable<TRPCContext["session"]>;
};

type VerificationRuleInput = {
  title: string;
  description: string;
  severity: VerificationRuleSeverity;
  appliesTo: VerificationRuleScope;
  enabled?: boolean;
};

function toBootstrapInput(ctx: ProtectedContext) {
  return {
    user: ctx.user,
    session: ctx.session
  };
}

async function getProjectOrThrow(projectId: string, organizationId: string) {
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.organizationId, organizationId)))
    .limit(1);

  if (!project) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Project not found."
    });
  }

  return project;
}

async function getRuleOrThrow(ruleId: string, organizationId: string) {
  const [rule] = await db
    .select()
    .from(verificationRules)
    .where(
      and(
        eq(verificationRules.id, ruleId),
        eq(verificationRules.organizationId, organizationId)
      )
    )
    .limit(1);

  if (!rule) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Verification rule not found."
    });
  }

  return rule;
}

export async function listVerificationRules(
  ctx: ProtectedContext,
  projectId: string
) {
  const workspace = await ensureUserWorkspace(toBootstrapInput(ctx));
  assertRoleCan(workspace.membership.role, "project:read");

  await getProjectOrThrow(projectId, workspace.activeOrganization.id);

  return db
    .select()
    .from(verificationRules)
    .where(
      and(
        eq(verificationRules.projectId, projectId),
        eq(verificationRules.organizationId, workspace.activeOrganization.id)
      )
    )
    .orderBy(desc(verificationRules.createdAt));
}

export async function createVerificationRule(
  ctx: ProtectedContext,
  projectId: string,
  input: VerificationRuleInput
) {
  const workspace = await ensureUserWorkspace(toBootstrapInput(ctx));
  assertRoleCan(workspace.membership.role, "project:write");

  await getProjectOrThrow(projectId, workspace.activeOrganization.id);

  const [rule] = await db
    .insert(verificationRules)
    .values({
      organizationId: workspace.activeOrganization.id,
      projectId,
      title: input.title,
      description: input.description,
      severity: input.severity,
      appliesTo: input.appliesTo,
      enabled: input.enabled ?? true,
      createdBy: workspace.appUser.id,
      updatedAt: new Date()
    })
    .returning();

  return rule;
}

export async function updateVerificationRule(
  ctx: ProtectedContext,
  ruleId: string,
  input: Partial<VerificationRuleInput>
) {
  const workspace = await ensureUserWorkspace(toBootstrapInput(ctx));
  assertRoleCan(workspace.membership.role, "project:write");

  await getRuleOrThrow(ruleId, workspace.activeOrganization.id);

  const [rule] = await db
    .update(verificationRules)
    .set({
      ...input,
      updatedAt: new Date()
    })
    .where(eq(verificationRules.id, ruleId))
    .returning();

  return rule;
}

export async function deleteVerificationRule(ctx: ProtectedContext, ruleId: string) {
  const workspace = await ensureUserWorkspace(toBootstrapInput(ctx));
  assertRoleCan(workspace.membership.role, "project:write");

  await getRuleOrThrow(ruleId, workspace.activeOrganization.id);

  await db.delete(verificationRules).where(eq(verificationRules.id, ruleId));

  return { ok: true };
}

export async function toggleVerificationRule(ctx: ProtectedContext, ruleId: string) {
  const workspace = await ensureUserWorkspace(toBootstrapInput(ctx));
  assertRoleCan(workspace.membership.role, "project:write");

  const current = await getRuleOrThrow(ruleId, workspace.activeOrganization.id);
  const [rule] = await db
    .update(verificationRules)
    .set({
      enabled: !current.enabled,
      updatedAt: new Date()
    })
    .where(eq(verificationRules.id, ruleId))
    .returning();

  return rule;
}

