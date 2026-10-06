import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

for (const envFile of [".env.local", ".env"]) {
  if (existsSync(envFile)) {
    loadEnvFile(envFile);
    break;
  }
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL is not configured. Add it to .env.local before starting development.");
  process.exit(1);
}

let hostname: string;

try {
  hostname = new URL(databaseUrl).hostname;
} catch {
  console.error("DATABASE_URL is invalid. Check the value in .env.local.");
  process.exit(1);
}

const isLocalDatabase = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";

if (!isLocalDatabase) {
  console.log("Remote PostgreSQL detected; local Docker startup skipped.");
  process.exit(0);
}

try {
  console.log("Ensuring the local PostgreSQL service is ready...");
  execFileSync("docker", ["compose", "up", "-d", "--wait", "postgres"], {
    stdio: "inherit",
  });
} catch {
  console.error(
    "Local PostgreSQL could not be started. Make sure Docker is running, then retry npm run dev.",
  );
  process.exit(1);
}
