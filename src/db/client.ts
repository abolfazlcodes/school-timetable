import postgres from "postgres";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

let database: PostgresJsDatabase<typeof schema> | undefined;

export function getDatabase() {
  if (database) return database;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("متغیر DATABASE_URL تنظیم نشده است.");
  const client = postgres(connectionString, {
    max: process.env.NODE_ENV === "production" ? 10 : 3,
    prepare: false,
    idle_timeout: 20,
  });
  database = drizzle(client, { schema });
  return database;
}
