import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

type RuntimeGlobal = typeof globalThis & {
  process?: {
    env?: Record<string, string | undefined>;
  };
};

type Database = PostgresJsDatabase<typeof schema>;

let sqlClient: ReturnType<typeof postgres> | undefined;
let database: Database | undefined;

function getDatabaseUrl() {
  const databaseUrl = (globalThis as RuntimeGlobal).process?.env?.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is required to initialize @veriflow/db. Set it before using the database client."
    );
  }

  return databaseUrl;
}

export function getDb() {
  if (!database) {
    sqlClient = postgres(getDatabaseUrl(), {
      max: 1,
      prepare: false
    });
    database = drizzle(sqlClient, { schema });
  }

  return database;
}

export const db = new Proxy({} as Database, {
  get(_target, property) {
    const value = Reflect.get(getDb() as object, property);
    return typeof value === "function" ? value.bind(getDb()) : value;
  }
});

export { schema };
