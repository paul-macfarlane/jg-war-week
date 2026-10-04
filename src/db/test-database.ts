import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import path from "node:path";
import { Client } from "pg";

/** The repo's committed migrations. */
export const DRIZZLE_DIR = path.resolve(__dirname, "../../drizzle");

/** `DATABASE_URL` pointed at the database `name` on the same server. */
export function databaseUrl(name: string): string {
  const url = new URL(process.env.DATABASE_URL!);
  url.pathname = `/${name}`;
  return url.toString();
}

/** Applies the migrations in `migrationsFolder` to the database at `url`. */
export async function migrateTo(url: string, migrationsFolder: string) {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await migrate(drizzle(client), { migrationsFolder });
  } finally {
    await client.end();
  }
}

/**
 * Creates a throwaway database on the local server, runs `body` with its
 * URL, then drops it, whatever `body` does. `migrations` is the folder to
 * migrate it with before `body` runs: pass `false` to start empty (a test
 * that migrates in stages itself).
 */
export async function withThrowawayDatabase(
  body: (url: string) => Promise<void>,
  { migrations = DRIZZLE_DIR }: { migrations?: string | false } = {},
): Promise<void> {
  const name = `throwaway_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  const server = new Client({ connectionString: databaseUrl("postgres") });
  await server.connect();
  try {
    await server.query(`create database "${name}"`);
    const url = databaseUrl(name);
    if (migrations) await migrateTo(url, migrations);
    await body(url);
  } finally {
    await server.query(`drop database if exists "${name}" with (force)`);
    await server.end();
  }
}
