import postgres from "postgres";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

let database: PostgresJsDatabase<typeof schema> | undefined;

export function getDatabase() {
  if (database) return database;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("متغیر DATABASE_URL تنظیم نشده است.");
  const configuredPoolSize = Number.parseInt(process.env.DATABASE_POOL_MAX ?? "", 10);
  const poolSize = Number.isInteger(configuredPoolSize) && configuredPoolSize > 0
    ? configuredPoolSize
    : process.env.VERCEL
      ? 1
      : process.env.NODE_ENV === "production" ? 10 : 3;
  const client = postgres(connectionString, {
    max: poolSize,
    prepare: false,
    idle_timeout: 20,
  });
  database = drizzle(client, { schema });
  return database;
}
