import type { DBTx } from "@/db";

class Rollback extends Error {}

/**
 * Runs `body` in a transaction that is always rolled back, so a DB test
 * against local Postgres leaves no rows behind. `@/db` loads lazily, so a
 * test file that skips without a local database never connects.
 */
export async function inRolledBackTransaction(
  body: (tx: DBTx) => Promise<void>,
): Promise<void> {
  const { db } = await import("@/db");
  await db
    .transaction(async (tx) => {
      await body(tx);
      throw new Rollback();
    })
    .catch((error) => {
      if (!(error instanceof Rollback)) throw error;
    });
}
