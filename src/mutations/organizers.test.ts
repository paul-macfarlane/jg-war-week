import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { DBTx } from "@/db";
import { isLocalDatabaseUrl } from "@/db/local-url";
import type { MutationResult } from "@/mutations/types";

// Runs only against a local Postgres (CI's service or docker compose; see
// vitest.config.ts), never a hosted database.
const isLocalDatabase = isLocalDatabaseUrl(
  process.env.DATABASE_URL,
  process.env.DATABASE_DRIVER,
);

class Rollback extends Error {}

/** Runs `body` in a transaction that is always rolled back. */
async function inRolledBackTransaction(body: (tx: DBTx) => Promise<void>) {
  const { withTransaction } = await import("@/db");
  await withTransaction(async (tx) => {
    await body(tx);
    throw new Rollback();
  }).catch((error) => {
    if (!(error instanceof Rollback)) throw error;
  });
}

const jason = "jason@jahnelgroup.com";
const jz = "jz@jahnelgroup.com";

/** Only `emails` are Organizers (inside the rolled-back transaction). */
async function onlyOrganizers(tx: DBTx, emails: string[]) {
  const { organizer } = await import("@/db/schema");
  await tx.delete(organizer);
  if (emails.length) {
    await tx.insert(organizer).values(emails.map((email) => ({ email })));
  }
}

async function organizerRows(tx: DBTx) {
  const { getOrganizers } = await import("@/queries/organizers");
  return getOrganizers(tx);
}

describe.skipIf(!isLocalDatabase)("addOrganizer", () => {
  it("adds a JG email lowercased, recording who added it", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { addOrganizer } = await import("@/mutations/organizers");
      await onlyOrganizers(tx, [jason]);

      expect(await addOrganizer(" JZ@JahnelGroup.com ", jason, tx)).toEqual({
        ok: true,
      });

      const rows = await organizerRows(tx);
      expect(rows.map(({ email, addedBy }) => ({ email, addedBy }))).toEqual([
        { email: jason, addedBy: null },
        { email: jz, addedBy: jason },
      ]);
    });
  });

  it("refuses an email outside @jahnelgroup.com", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { addOrganizer } = await import("@/mutations/organizers");
      await onlyOrganizers(tx, [jason]);

      for (const email of [
        "someone@gmail.com",
        "someone@jahnelgroup.com.evil.com",
        "a@b@jahnelgroup.com",
        "not-an-email",
      ]) {
        expect(await addOrganizer(email, jason, tx)).toEqual({
          ok: false,
          error: "An Organizer needs an @jahnelgroup.com email.",
        });
      }
      expect((await organizerRows(tx)).map((r) => r.email)).toEqual([jason]);
    });
  });

  it("refuses an email already on the list, ignoring case", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { addOrganizer } = await import("@/mutations/organizers");
      await onlyOrganizers(tx, [jason]);

      expect(await addOrganizer("Jason@JahnelGroup.com", jz, tx)).toEqual({
        ok: false,
        error: "jason@jahnelgroup.com is already an Organizer.",
      });
      expect((await organizerRows(tx)).map((r) => r.email)).toEqual([jason]);
    });
  });
});

describe.skipIf(!isLocalDatabase)("removeOrganizer", () => {
  it("removes another Organizer, ignoring case", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { removeOrganizer } = await import("@/mutations/organizers");
      await onlyOrganizers(tx, [jason, jz]);

      expect(await removeOrganizer("JZ@jahnelgroup.com", jason, tx)).toEqual({
        ok: true,
      });
      expect((await organizerRows(tx)).map((r) => r.email)).toEqual([jason]);
    });
  });

  it("lets an Organizer remove themselves while another remains", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { removeOrganizer } = await import("@/mutations/organizers");
      await onlyOrganizers(tx, [jason, jz]);

      expect(await removeOrganizer(jason, jason, tx)).toEqual({ ok: true });
      expect((await organizerRows(tx)).map((r) => r.email)).toEqual([jz]);
    });
  });

  it("refuses removing the last Organizer", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { removeOrganizer } = await import("@/mutations/organizers");
      await onlyOrganizers(tx, [jason]);

      expect(await removeOrganizer(jason, jason, tx)).toEqual({
        ok: false,
        error: "The last Organizer can't be removed.",
      });
      expect((await organizerRows(tx)).map((r) => r.email)).toEqual([jason]);
    });
  });

  it("says so when the email isn't an Organizer", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { removeOrganizer } = await import("@/mutations/organizers");
      await onlyOrganizers(tx, [jason]);

      expect(await removeOrganizer(jz, jason, tx)).toEqual({
        ok: false,
        error: "jz@jahnelgroup.com isn't an Organizer.",
      });
    });
  });
});

describe.skipIf(!isLocalDatabase)("Organizer queries", () => {
  it("lists Organizers by email and matches an email ignoring case", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { isOrganizerEmail } = await import("@/queries/organizers");
      await onlyOrganizers(tx, [jz, jason]);

      expect((await organizerRows(tx)).map((r) => r.email)).toEqual([
        jason,
        jz,
      ]);
      expect(await isOrganizerEmail(" Jason@JahnelGroup.com", tx)).toBe(true);
      expect(await isOrganizerEmail("tony@jahnelgroup.com", tx)).toBe(false);
    });
  });
});

/**
 * The last-Organizer lock across two connections. This commits, so it runs
 * with only its own two Organizers: the committed list is set aside first
 * and put back afterwards (and a crashed run's fixtures are cleared before).
 */
describe.skipIf(!isLocalDatabase)("removeOrganizer on two connections", () => {
  const raceA = "zz-race-organizers-a@jahnelgroup.com";
  const raceB = "zz-race-organizers-b@jahnelgroup.com";
  let setAside: { email: string; addedBy: string | null; createdAt: Date }[] =
    [];

  async function clearFixtures() {
    const { db } = await import("@/db");
    const { organizer } = await import("@/db/schema");
    const { inArray } = await import("drizzle-orm");
    await db.delete(organizer).where(inArray(organizer.email, [raceA, raceB]));
  }

  beforeEach(async () => {
    const { db } = await import("@/db");
    const { organizer } = await import("@/db/schema");
    await clearFixtures();
    setAside = await db.delete(organizer).returning({
      email: organizer.email,
      addedBy: organizer.addedBy,
      createdAt: organizer.createdAt,
    });
    await db.insert(organizer).values([{ email: raceA }, { email: raceB }]);
  });

  afterEach(async () => {
    const { db } = await import("@/db");
    const { organizer } = await import("@/db/schema");
    await clearFixtures();
    if (setAside.length) {
      await db.insert(organizer).values(setAside).onConflictDoNothing();
    }
    setAside = [];
  });

  it("leaves exactly one Organizer when the last two are removed at once", async () => {
    const { db } = await import("@/db");
    const schema = await import("@/db/schema");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { removeOrganizer } = await import("@/mutations/organizers");
    const second = drizzle(process.env.DATABASE_URL!, { schema });
    const blocker = drizzle(process.env.DATABASE_URL!, { schema });
    try {
      // A third connection holds the rows while both removals start, so
      // both are in flight together before either can commit.
      let removals: Promise<MutationResult[]> | undefined;
      await blocker.transaction(async (tx) => {
        await tx.select().from(schema.organizer).for("update");
        removals = Promise.all([
          removeOrganizer(raceA, raceB, db),
          removeOrganizer(raceB, raceA, second),
        ]);
        await new Promise((resolve) => setTimeout(resolve, 300));
      });
      const results = await removals!;

      expect(results.filter((r) => r.ok)).toHaveLength(1);
      expect(results.filter((r) => !r.ok)).toEqual([
        { ok: false, error: "The last Organizer can't be removed." },
      ]);
      const left = await db
        .select({ email: schema.organizer.email })
        .from(schema.organizer);
      expect(left).toHaveLength(1);
    } finally {
      await second.$client.end();
      await blocker.$client.end();
    }
  });
});
