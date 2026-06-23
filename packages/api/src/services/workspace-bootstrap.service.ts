import { and, asc, eq } from "drizzle-orm";
import {
  appUsers,
  db,
  organizationMembers,
  organizations,
  subscriptions,
  usageCounters
} from "@veriflow/db";

type BetterAuthUser = {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
};

type BetterAuthSession = {
  id: string;
};

type WorkspaceDb = typeof db;

export type EnsureUserWorkspaceInput = {
  user: BetterAuthUser;
  session: BetterAuthSession;
};

function toSlugPart(value: string) {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "workspace"
  );
}

function getDefaultOrganizationName(user: BetterAuthUser) {
  const fallbackName = user.email.split("@")[0] ?? "Workspace";
  return `${user.name || fallbackName}'s Workspace`;
}

function getDefaultOrganizationSlug(user: BetterAuthUser) {
  const base = toSlugPart(user.name || user.email.split("@")[0] || "workspace");
  const suffix = toSlugPart(user.id).slice(0, 10);
  return `${base}-${suffix}`;
}

function getCurrentPeriodKey(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(
    2,
    "0"
  )}`;
}

async function upsertAppUser(tx: WorkspaceDb, user: BetterAuthUser) {
  const [existingByAuthId] = await tx
    .select()
    .from(appUsers)
    .where(eq(appUsers.betterAuthUserId, user.id))
    .limit(1);

  if (existingByAuthId) {
    const [updated] = await tx
      .update(appUsers)
      .set({
        email: user.email,
        name: user.name ?? null,
        image: user.image ?? null,
        updatedAt: new Date()
      })
      .where(eq(appUsers.id, existingByAuthId.id))
      .returning();

    return updated ?? existingByAuthId;
  }

  const [existingByEmail] = await tx
    .select()
    .from(appUsers)
    .where(eq(appUsers.email, user.email))
    .limit(1);

  if (existingByEmail) {
    const [updated] = await tx
      .update(appUsers)
      .set({
        betterAuthUserId: user.id,
        name: user.name ?? existingByEmail.name,
        image: user.image ?? existingByEmail.image,
        updatedAt: new Date()
      })
      .where(eq(appUsers.id, existingByEmail.id))
      .returning();

    return updated ?? existingByEmail;
  }

  const [created] = await tx
    .insert(appUsers)
    .values({
      betterAuthUserId: user.id,
      email: user.email,
      name: user.name ?? null,
      image: user.image ?? null
    })
    .onConflictDoUpdate({
      target: appUsers.betterAuthUserId,
      set: {
        email: user.email,
        name: user.name ?? null,
        image: user.image ?? null,
        updatedAt: new Date()
      }
    })
    .returning();

  if (!created) {
    throw new Error("Unable to create app user profile.");
  }

  return created;
}

async function ensureSubscription(tx: WorkspaceDb, organizationId: string) {
  const [existing] = await tx
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.organizationId, organizationId))
    .limit(1);

  if (existing) {
    return existing;
  }

  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1);

  const [created] = await tx
    .insert(subscriptions)
    .values({
      organizationId,
      plan: "founder_pilot",
      status: "active",
      razorpayCustomerId: `bootstrap:${organizationId}`,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd
    })
    .onConflictDoNothing({
      target: subscriptions.organizationId
    })
    .returning();

  if (created) {
    return created;
  }

  const [afterConflict] = await tx
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.organizationId, organizationId))
    .limit(1);

  if (!afterConflict) {
    throw new Error("Unable to ensure subscription for workspace.");
  }

  return afterConflict;
}

async function ensureUsageCounter(tx: WorkspaceDb, organizationId: string) {
  const periodKey = getCurrentPeriodKey();

  await tx
    .insert(usageCounters)
    .values({
      organizationId,
      periodKey
    })
    .onConflictDoNothing({
      target: [usageCounters.organizationId, usageCounters.periodKey]
    });
}

async function getMembershipsForAppUser(tx: WorkspaceDb, appUserId: string) {
  return tx
    .select({
      membership: organizationMembers,
      organization: organizations,
      subscription: subscriptions
    })
    .from(organizationMembers)
    .innerJoin(
      organizations,
      eq(organizationMembers.organizationId, organizations.id)
    )
    .leftJoin(
      subscriptions,
      eq(subscriptions.organizationId, organizations.id)
    )
    .where(eq(organizationMembers.userId, appUserId))
    .orderBy(asc(organizationMembers.createdAt));
}

export async function ensureUserWorkspace(input: EnsureUserWorkspaceInput) {
  void input.session;

  return db.transaction(async (tx) => {
    const appUser = await upsertAppUser(tx, input.user);
    const existingMemberships = await getMembershipsForAppUser(tx, appUser.id);

    if (existingMemberships[0]) {
      const activeOrganization = existingMemberships[0].organization;
      const subscription = await ensureSubscription(tx, activeOrganization.id);
      await ensureUsageCounter(tx, activeOrganization.id);

      return {
        appUser,
        organizations: existingMemberships.map((entry) => entry.organization),
        activeOrganization,
        membership: existingMemberships[0].membership,
        subscription
      };
    }

    const organizationName = getDefaultOrganizationName(input.user);
    const organizationSlug = getDefaultOrganizationSlug(input.user);

    const [createdOrganization] = await tx
      .insert(organizations)
      .values({
        name: organizationName,
        slug: organizationSlug
      })
      .onConflictDoNothing({
        target: organizations.slug
      })
      .returning();

    const organization =
      createdOrganization ??
      (
        await tx
          .select()
          .from(organizations)
          .where(eq(organizations.slug, organizationSlug))
          .limit(1)
      )[0];

    if (!organization) {
      throw new Error("Unable to create default organization.");
    }

    const [createdMembership] = await tx
      .insert(organizationMembers)
      .values({
        organizationId: organization.id,
        userId: appUser.id,
        role: "owner"
      })
      .onConflictDoNothing({
        target: [organizationMembers.organizationId, organizationMembers.userId]
      })
      .returning();

    const membership =
      createdMembership ??
      (
        await tx
          .select()
          .from(organizationMembers)
          .where(
            and(
              eq(organizationMembers.organizationId, organization.id),
              eq(organizationMembers.userId, appUser.id)
            )
          )
          .limit(1)
      )[0];

    if (!membership) {
      throw new Error("Unable to create organization membership.");
    }

    const subscription = await ensureSubscription(tx, organization.id);
    await ensureUsageCounter(tx, organization.id);

    return {
      appUser,
      organizations: [organization],
      activeOrganization: organization,
      membership,
      subscription
    };
  });
}
