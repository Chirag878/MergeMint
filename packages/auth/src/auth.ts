import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db, schema } from "@veriflow/db";
import { appUsers } from "@veriflow/db";
import { getRequiredAuthEnv } from "@veriflow/env";

type AuthInstance = ReturnType<typeof createAuth>;

const productionAppOrigin = "https://mergemint-eight.vercel.app";

let authInstance: AuthInstance | undefined;

function logAuthFailure(
  event: string,
  error: unknown,
  metadata?: Record<string, string | number | boolean | null | undefined>
) {
  const message = error instanceof Error ? error.message : String(error);

  console.error("[auth]", event, {
    ...metadata,
    message
  });
}

function getTrustedOrigins(authEnv: {
  BETTER_AUTH_URL: string;
  NEXT_PUBLIC_APP_URL?: string;
}) {
  const envOrigins = [authEnv.BETTER_AUTH_URL, authEnv.NEXT_PUBLIC_APP_URL].filter(
    (origin): origin is string => Boolean(origin)
  );
  const normalizedOrigins = envOrigins.map((origin) => new URL(origin).origin);

  return Array.from(
    new Set([...envOrigins, ...normalizedOrigins, productionAppOrigin])
  );
}

async function syncAppUser(user: {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
}) {
  await db
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
    });
}

async function trySyncAppUser(user: {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
}) {
  try {
    await syncAppUser(user);
  } catch (error) {
    logAuthFailure("app_user_sync_failed", error, {
      userId: user.id,
      hasEmail: Boolean(user.email)
    });
  }
}

function createAuth() {
  const authEnv = getRequiredAuthEnv();

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "pg",
      schema
    }),
    secret: authEnv.BETTER_AUTH_SECRET,
    baseURL: authEnv.BETTER_AUTH_URL,
    trustedOrigins: getTrustedOrigins(authEnv),
    emailAndPassword: {
      enabled: false
    },
    socialProviders: {
      github: {
        clientId: authEnv.GITHUB_CLIENT_ID,
        clientSecret: authEnv.GITHUB_CLIENT_SECRET
      },
      google: {
        clientId: authEnv.GOOGLE_CLIENT_ID,
        clientSecret: authEnv.GOOGLE_CLIENT_SECRET
      }
    },
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            await trySyncAppUser(user);
          }
        },
        update: {
          after: async (user) => {
            await trySyncAppUser(user);
          }
        }
      }
    }
  });
}

export function getAuth() {
  authInstance ??= createAuth();
  return authInstance;
}

export type Auth = AuthInstance;
