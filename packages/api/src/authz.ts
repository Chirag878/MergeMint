import { TRPCError } from "@trpc/server";
import type { TRPCContext } from "./context";

export type MemberRole = "owner" | "admin" | "member" | "viewer";

export type Permission =
  | "create_project"
  | "create_feature_request"
  | "organization:manage"
  | "project:write"
  | "project:read"
  | "billing:manage";

export const ROLE_PERMISSIONS: Record<MemberRole, Permission[]> = {
  owner: [
    "organization:manage",
    "create_project",
    "create_feature_request",
    "project:write",
    "project:read",
    "billing:manage"
  ],
  admin: [
    "organization:manage",
    "create_project",
    "create_feature_request",
    "project:write",
    "project:read"
  ],
  member: ["create_feature_request", "project:write", "project:read"],
  viewer: ["project:read"]
};

export function assertAuthenticated(ctx: Pick<TRPCContext, "session" | "user">) {
  if (!ctx.session || !ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in to perform this action."
    });
  }

  return {
    session: ctx.session,
    user: ctx.user
  };
}

export function hasPermission(role: MemberRole, permission: Permission) {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function assertRole(role: MemberRole, permission: Permission) {
  if (!hasPermission(role, permission)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have permission to perform this action."
    });
  }
}

export function assertRoleCan(role: MemberRole, permission: Permission) {
  assertRole(role, permission);
}

export function canCreateProject(role: MemberRole) {
  return hasPermission(role, "create_project");
}

export function canCreateFeatureRequest(role: MemberRole) {
  return hasPermission(role, "create_feature_request");
}

export function assertOrgMember<TMember extends { role: MemberRole } | null>(
  member: TMember
) {
  if (!member) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You must be a member of this organization."
    });
  }

  return member;
}
