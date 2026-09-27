import { Pool } from "@neondatabase/serverless";
import { ExtractTablesWithRelations } from "drizzle-orm";
import {
  NeonDatabase,
  NeonQueryResultHKT,
  drizzle as drizzleNeon,
} from "drizzle-orm/neon-serverless";
import {
  NodePgDatabase,
  NodePgQueryResultHKT,
  drizzle as drizzlePg,
} from "drizzle-orm/node-postgres";
import { PgTransaction } from "drizzle-orm/pg-core";

import * as schema from "./schema";

export type DB = NodePgDatabase<typeof schema> | NeonDatabase<typeof schema>;

export type DBTx = PgTransaction<
  NodePgQueryResultHKT | NeonQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

export type DBOrTx = DB | DBTx;

let db: DB;
if (process.env.DATABASE_DRIVER === "neon") {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
  db = drizzleNeon(pool, { schema });
} else {
  db = drizzlePg(process.env.DATABASE_URL!, { schema });
}

export { db };
