import { describe, expect, it } from "vitest";

import { isLocalDatabaseUrl } from "@/db/local-url";
import { inRolledBackTransaction } from "@/db/test-transaction";

// Runs only against a local Postgres (CI's service or docker compose; see
// vitest.config.ts), never a hosted database.
const isLocalDatabase = isLocalDatabaseUrl(
  process.env.DATABASE_URL,
  process.env.DATABASE_DRIVER,
);

const EMAIL = "pm-save@jahnelgroup.com";
const SET_URL = "https://images.example.test/me.png";

describe.skipIf(!isLocalDatabase)("saveProfile", () => {
  it("creates, updates and, with both fields empty, deletes the Profile", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { eq } = await import("drizzle-orm");
      const { profile } = await import("@/db/schema");
      const { saveProfile } = await import("@/mutations/profile");
      const stored = () =>
        tx
          .select({ name: profile.name, imageUrl: profile.imageUrl })
          .from(profile)
          .where(eq(profile.email, EMAIL));

      await saveProfile(
        "PM-Save@JahnelGroup.com",
        { name: "Pat", imageUrl: null },
        tx,
      );
      expect(await stored()).toEqual([{ name: "Pat", imageUrl: null }]);

      await saveProfile(EMAIL, { name: null, imageUrl: SET_URL }, tx);
      expect(await stored()).toEqual([{ name: null, imageUrl: SET_URL }]);

      await saveProfile(EMAIL, { name: null, imageUrl: null }, tx);
      expect(await stored()).toEqual([]);
    });
  });
});
