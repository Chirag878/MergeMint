import { defineConfig } from "drizzle-kit";
import { env } from "@veriflow/env";

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: env.DATABASE_URL
  },
  strict: true,
  verbose: true
});