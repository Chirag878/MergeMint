import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db, schema } from "@veriflow/db";
import { appUsers } from "@veriflow/db";
import { getRequiredAuthEnv } from "@veriflow/env";

type AuthInstance = ReturnType<typeof createAuth>;

let authInstance: AuthInstance | undefined;

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

function createAuth() {
  const authEnv = getRequiredAuthEnv();

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "pg",
      schema
    }),
    secret: authEnv.BETTER_AUTH_SECRET,
    baseURL: authEnv.BETTER_AUTH_URL,
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
            await syncAppUser(user);
          }
        },
        update: {
          after: async (user) => {
            await syncAppUser(user);
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
