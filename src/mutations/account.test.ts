import { describe, expect, it } from "vitest";

import type { DBTx } from "@/db";
import { isLocalDatabaseUrl } from "@/db/local-url";
import { inRolledBackTransaction } from "@/db/test-transaction";

// Runs only against a local Postgres (CI's service or docker compose; see
// vitest.config.ts), never a hosted database.
const isLocalDatabase = isLocalDatabaseUrl(
  process.env.DATABASE_URL,
  process.env.DATABASE_DRIVER,
);

const EMAIL = "da-leaver@jahnelgroup.com";
const OTHER = "da-other@jahnelgroup.com";

/**
 * A person with a user, session, sign-in account, Profile, a roster
 * Participant and a spot on the Organizer list, plus a second Organizer.
 * Every other Organizer is cleared first, so "last" is exact.
 */
async function fixture(tx: DBTx) {
  const schema = await import("@/db/schema");
  await tx.delete(schema.organizer);
  const [warWeek] = await tx
    .insert(schema.warWeek)
    .values({
      edition: "da1",
      editionNumber: 9401,
      year: 9401,
      startDate: "2099-01-01",
      endDate: "2099-01-05",
      storyTheme: "Delete account test",
      status: "upcoming",
      mode: "teams",
      teamLabel: "Team",
      leaderTitle: "Captain",
      slackChannelUrl: "https://example.slack.com/archives/x",
      primaryColor: "#000",
      primaryForegroundColor: "#fff",
      accentColor: "#000",
      backgroundColor: "#fff",
      foregroundColor: "#000",
      fontPreset: "sans",
    })
    .returning({ id: schema.warWeek.id });
  await tx.insert(schema.participant).values({
    warWeekId: warWeek.id,
    displayName: "Leaver R",
    email: EMAIL,
  });
  await tx
    .insert(schema.user)
    .values({ id: "da-user", name: "x", email: EMAIL });
  await tx.insert(schema.session).values({
    id: "da-session",
    token: "da-token",
    userId: "da-user",
    expiresAt: new Date("2099-01-01"),
  });
  await tx.insert(schema.account).values({
    id: "da-account",
    accountId: "g-1",
    providerId: "google",
    userId: "da-user",
  });
  await tx.insert(schema.profile).values({ email: EMAIL, name: "Leaver P" });
}

async function counts(tx: DBTx) {
  const schema = await import("@/db/schema");
  return {
    organizer: await tx.$count(schema.organizer),
    profile: await tx.$count(schema.profile),
    user: await tx.$count(schema.user),
    session: await tx.$count(schema.session),
    account: await tx.$count(schema.account),
    participant: (await tx.select().from(schema.participant)).filter(
      (p) => p.email === EMAIL,
    ).length,
  };
}

describe.skipIf(!isLocalDatabase)("deleteAccount", () => {
  it("removes the Organizer entry, Profile, user, session and account, and keeps the roster Participant", async () => {
    await inRolledBackTransaction(async (tx) => {
      const schema = await import("@/db/schema");
      const { deleteAccount } = await import("@/mutations/account");
      await fixture(tx);
      await tx
        .insert(schema.organizer)
        .values([{ email: EMAIL }, { email: OTHER }]);

      const result = await deleteAccount(EMAIL.toUpperCase(), tx);

      expect(result).toEqual({ ok: true });
      expect(await counts(tx)).toEqual({
        organizer: 1,
        profile: 0,
        user: 0,
        session: 0,
        account: 0,
        participant: 1,
      });
    });
  });

  it("refuses the last Organizer and deletes nothing", async () => {
    await inRolledBackTransaction(async (tx) => {
      const schema = await import("@/db/schema");
      const { deleteAccount } = await import("@/mutations/account");
      await fixture(tx);
      await tx.insert(schema.organizer).values({ email: EMAIL });

      const result = await deleteAccount(EMAIL, tx);

      expect(result).toEqual({
        ok: false,
        error: "The last Organizer can't be removed.",
      });
      expect(await counts(tx)).toEqual({
        organizer: 1,
        profile: 1,
        user: 1,
        session: 1,
        account: 1,
        participant: 1,
      });
    });
  });

  it("deletes someone who was never an Organizer", async () => {
    await inRolledBackTransaction(async (tx) => {
      const schema = await import("@/db/schema");
      const { deleteAccount } = await import("@/mutations/account");
      await fixture(tx);
      await tx.insert(schema.organizer).values({ email: OTHER });

      expect(await deleteAccount(EMAIL, tx)).toEqual({ ok: true });
      expect((await counts(tx)).user).toBe(0);
    });
  });
});
