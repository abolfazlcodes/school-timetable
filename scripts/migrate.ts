import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { loadEnvFile } from "node:process";
import postgres from "postgres";

if (existsSync(".env.local")) loadEnvFile(".env.local");
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL تنظیم نشده است.");

const sql = postgres(connectionString, { max: 1 });

try {
  await sql`CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`;
  const migrationsUrl = new URL("../migrations/", import.meta.url);
  const migrationNames = (await readdir(migrationsUrl)).filter((name) => /^\d+.*\.sql$/.test(name)).sort();
  for (const migrationName of migrationNames) {
    const applied = await sql<{ name: string }[]>`SELECT name FROM schema_migrations WHERE name = ${migrationName}`;
    if (applied[0]) {
      console.log(`Migration already applied: ${migrationName}`);
      continue;
    }
    const migration = await readFile(new URL(migrationName, migrationsUrl), "utf8");
    await sql.begin(async (transaction) => {
      await transaction.unsafe(migration);
      await transaction`INSERT INTO schema_migrations (name) VALUES (${migrationName})`;
    });
    console.log(`Migration applied: ${migrationName}`);
  }
} finally {
  await sql.end();
}
