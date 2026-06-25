import { sql } from "drizzle-orm";
import { getSessionFromHeaders } from "@veriflow/auth/server";
import { db } from "@veriflow/db";

const requiredTables = [
  "user",
  "session",
  "account",
  "verification",
  "app_users",
  "organizations",
  "organization_members",
  "subscriptions",
  "usage_counters"
] as const;

type RequiredTable = (typeof requiredTables)[number];

type AuthDebugDiagnostics = {
  ok: boolean;
  env: {
    databaseUrlExists: boolean;
    betterAuthUrlExists: boolean;
    nextPublicAppUrlExists: boolean;
  };
  session: {
    readable: boolean;
    authenticated: boolean;
    userId: string | null;
    email: string | null;
    error: string | null;
  };
  database: {
    connected: boolean;
    requiredTables: Record<RequiredTable, boolean>;
    error: string | null;
  };
};

function getEmptyRequiredTables() {
  return Object.fromEntries(requiredTables.map((table) => [table, false])) as
    Record<RequiredTable, boolean>;
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function getAuthDebugDiagnostics(headers: Headers) {
  const diagnostics: AuthDebugDiagnostics = {
    ok: false,
    env: {
      databaseUrlExists: Boolean(process.env.DATABASE_URL),
      betterAuthUrlExists: Boolean(process.env.BETTER_AUTH_URL),
      nextPublicAppUrlExists: Boolean(process.env.NEXT_PUBLIC_APP_URL)
    },
    session: {
      readable: false,
      authenticated: false,
      userId: null,
      email: null,
      error: null
    },
    database: {
      connected: false,
      requiredTables: getEmptyRequiredTables(),
      error: null
    }
  };

  try {
    const session = await getSessionFromHeaders(headers);

    diagnostics.session = {
      readable: true,
      authenticated: Boolean(session?.user),
      userId: session?.user.id ?? null,
      email: session?.user.email ?? null,
      error: null
    };
  } catch (error) {
    diagnostics.session.error = toErrorMessage(error);
  }

  try {
    const rows = await db.execute<{ tableName: string }>(sql`
      select table_name as "tableName"
      from information_schema.tables
      where table_schema = 'public'
        and table_name = any(${requiredTables})
    `);
    const presentTables = new Set(rows.map((row) => row.tableName));

    diagnostics.database = {
      connected: true,
      requiredTables: Object.fromEntries(
        requiredTables.map((table) => [table, presentTables.has(table)])
      ) as Record<RequiredTable, boolean>,
      error: null
    };
  } catch (error) {
    diagnostics.database.error = toErrorMessage(error);
  }

  diagnostics.ok =
    diagnostics.env.databaseUrlExists &&
    diagnostics.env.betterAuthUrlExists &&
    diagnostics.session.readable &&
    diagnostics.database.connected &&
    Object.values(diagnostics.database.requiredTables).every(Boolean);

  return diagnostics;
}
