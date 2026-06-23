import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();

export type OAuthProvider = "github" | "google";

export function isOAuthProvider(provider: string): provider is OAuthProvider {
  return provider === "github" || provider === "google";
}
