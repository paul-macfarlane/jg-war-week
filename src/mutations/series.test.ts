import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import type { DBTx } from "@/db";
import { isLocalDatabaseUrl } from "@/db/local-url";
import { inRolledBackTransaction } from "@/db/test-transaction";
import {
  HOST,
  type LoggedFixture,
  MORPHEUS,
  NEO,
  NOBODY,
  ORGANIZER,
  TRINITY,
  beat,
  loggedFixture as fixture,
} from "@/mutations/logged-results.fixture";

// Runs only against a local Postgres (see vitest.config.ts).
const isLocalDatabase = isLocalDatabaseUrl(
  process.env.DATABASE_URL,
  process.env.DATABASE_DRIVER,
);

const NOT_LINKED = "Your sign-in doesn't match a Participant of this War Week.";
const NOT_A_PLAYER = "You're not a player in this Match.";
const NOT_THE_LOGGER =
  "Only the player who logged this Match can change it. Ask the Host.";
const CLOSED = "This Competition is closed.";
const MATCH_MISSING = "That Match no longer exists.";
const NOT_AN_ENTRANT =
  "A Match is played between this Competition's 2 Entrants.";

async function load() {
  return import("@/mutations/series");
}

describe.skipIf(!isLocalDatabase)("logMatch", () => {
  it("lets either Entrant log a Match between the two, stored by Entrant, and it counts at once", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { logMatch } = await load();
      const { getLoggedResultsView } = await import("@/queries/logged-results");
      const f = await fixture(tx);

      const result = await logMatch(
        f.ids.pong,
        beat(f.ids.neo, f.ids.trinity),
        f.ctx(NEO),
        tx,
      );
      expect(result).toEqual({ ok: true, resultId: expect.any(String) });
      if (!result.ok) return;

      const [row] = await f.matchRows(f.ids.pong);
      expect(row.loggedByEmail).toBe(NEO);
      expect(row.loggedByParticipantId).toBe(f.ids.neo);
      const sides = await tx
        .select({
          participantId: f.schema.entrant.participantId,
          place: f.schema.seriesMatchEntrant.place,
        })
        .from(f.schema.seriesMatchEntrant)
        .innerJoin(
          f.schema.entrant,
          eq(f.schema.entrant.id, f.schema.seriesMatchEntrant.entrantId),
        )
        .where(eq(f.schema.seriesMatchEntrant.seriesMatchId, result.resultId))
        .orderBy(f.schema.seriesMatchEntrant.place);
      expect(sides).toEqual([
        { participantId: f.ids.neo, place: 1 },
        { participantId: f.ids.trinity, place: 2 },
      ]);

      expect(
        await logMatch(
          f.ids.pong,
          beat(f.ids.trinity, f.ids.neo),
          f.ctx(TRINITY),
          tx,
        ),
      ).toMatchObject({ ok: true });
      const view = await getLoggedResultsView(f.ids.pong, NEO, tx);
      expect(
        view!.leaderboard.map((r) => [r.name, r.rank, r.wins, r.losses]).sort(),
      ).toEqual([
        ["Neo", 1, 1, 1],
        ["Trinity", 1, 1, 1],
      ]);
    });
  });

  it("refuses no link, a non-player and a player who isn't an Entrant", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { logMatch } = await load();
      const f = await fixture(tx);

      expect(
        await logMatch(
          f.ids.pong,
          beat(f.ids.neo, f.ids.trinity),
          f.ctx(NOBODY),
          tx,
        ),
      ).toEqual({ ok: false, error: NOT_LINKED });
      expect(
        await logMatch(
          f.ids.pong,
          beat(f.ids.neo, f.ids.trinity),
          f.ctx(MORPHEUS),
          tx,
        ),
      ).toEqual({ ok: false, error: NOT_A_PLAYER });
      for (const email of [NEO, HOST]) {
        expect(
          await logMatch(
            f.ids.pong,
            beat(f.ids.neo, f.ids.morpheus),
            f.ctx(email),
            tx,
          ),
        ).toEqual({ ok: false, error: NOT_AN_ENTRANT });
      }
      expect(await f.matchRows(f.ids.pong)).toEqual([]);
    });
  });

  it("lets a Host log, recording no logging Participant; a team Head-to-head takes its two Teams", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { logMatch } = await load();
      const f = await fixture(tx);

      expect(
        await logMatch(
          f.ids.pong,
          beat(f.ids.neo, f.ids.trinity),
          f.ctx(HOST),
          tx,
        ),
      ).toMatchObject({ ok: true });
      const [row] = await f.matchRows(f.ids.pong);
      expect(row.loggedByParticipantId).toBeNull();

      // Morpheus is on Red, an Entrant Team.
      expect(
        await logMatch(
          f.ids.relay,
          beat(f.ids.blue, f.ids.red),
          f.ctx(MORPHEUS),
          tx,
        ),
      ).toMatchObject({ ok: true });
    });
  });

  it("refuses everyone, an Organizer included, once the Competition is closed", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { logMatch, updateMatch, deleteMatch } = await load();
      const f = await fixture(tx);
      const logged = await logMatch(
        f.ids.pong,
        beat(f.ids.neo, f.ids.trinity),
        f.ctx(NEO),
        tx,
      );
      if (!logged.ok) throw new Error(logged.error);
      await f.setCompetition(f.ids.pong, { closedAt: new Date() });

      for (const email of [NEO, HOST, ORGANIZER]) {
        expect(
          await logMatch(
            f.ids.pong,
            beat(f.ids.neo, f.ids.trinity),
            f.ctx(email),
            tx,
          ),
        ).toEqual({ ok: false, error: CLOSED });
        expect(
          await updateMatch(
            f.ids.pong,
            logged.resultId,
            beat(f.ids.trinity, f.ids.neo),
            f.ctx(email),
            tx,
          ),
        ).toEqual({ ok: false, error: CLOSED });
        expect(
          await deleteMatch(f.ids.pong, logged.resultId, f.ctx(email), tx),
        ).toEqual({ ok: false, error: CLOSED });
      }
      expect(await f.matchRows(f.ids.pong)).toHaveLength(1);
    });
  });

  it("refuses a Participant once the series is decided, but not a Host; nothing refuses by time", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { logMatch } = await load();
      const f = await fixture(tx);
      for (let i = 0; i < 2; i++) {
        expect(
          await logMatch(
            f.ids.pong,
            beat(f.ids.neo, f.ids.trinity),
            f.ctx(NEO),
            tx,
          ),
        ).toMatchObject({ ok: true });
      }

      expect(
        await logMatch(
          f.ids.pong,
          beat(f.ids.trinity, f.ids.neo),
          f.ctx(TRINITY),
          tx,
        ),
      ).toEqual({
        ok: false,
        error: "This series is decided, so logging is closed.",
      });
      expect(
        await logMatch(
          f.ids.pong,
          beat(f.ids.trinity, f.ids.neo),
          f.ctx(HOST),
          tx,
        ),
      ).toMatchObject({ ok: true });
    });
  });

  it("refuses a player of another War Week, a Team in an individual Competition, a repeated player and one side", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { logMatch } = await load();
      const f = await fixture(tx);
      const individual = "Every player must be a Participant of this War Week.";

      expect(
        await logMatch(
          f.ids.pong,
          beat(f.ids.neo, f.ids.smith),
          f.ctx(HOST),
          tx,
        ),
      ).toEqual({ ok: false, error: individual });
      expect(
        await logMatch(
          f.ids.pong,
          beat(f.ids.red, f.ids.blue),
          f.ctx(HOST),
          tx,
        ),
      ).toEqual({ ok: false, error: individual });
      expect(
        await logMatch(f.ids.pong, beat(f.ids.neo, f.ids.neo), f.ctx(HOST), tx),
      ).toEqual({ ok: false, error: "Choose each player only once." });
      expect(
        await logMatch(
          f.ids.pong,
          { players: [{ id: f.ids.neo, place: 1, score: null }] },
          f.ctx(HOST),
          tx,
        ),
      ).toEqual({
        ok: false,
        error: "A Head-to-head Match has exactly 2 players.",
      });
      expect(await f.matchRows(f.ids.pong)).toEqual([]);
    });
  });

  it("refuses another Format and another War Week's Competition", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { logMatch } = await load();
      const f = await fixture(tx);

      expect(
        await logMatch(
          f.ids.trivia,
          beat(f.ids.red, f.ids.blue),
          f.ctx(HOST),
          tx,
        ),
      ).toEqual({
        ok: false,
        error: "This Competition isn't run as Head-to-head or Best score.",
      });
      expect(
        await logMatch(
          f.ids.bowl,
          beat(f.ids.neo, f.ids.trinity),
          f.ctx(HOST),
          tx,
        ),
      ).toEqual({
        ok: false,
        error: "This Competition isn't run as Head-to-head.",
      });
      expect(
        await logMatch(
          f.ids.pong,
          beat(f.ids.neo, f.ids.trinity),
          { warWeekId: f.ids.red, actorEmail: HOST },
          tx,
        ),
      ).toEqual({ ok: false, error: "That Competition no longer exists." });
    });
  });
});

describe.skipIf(!isLocalDatabase)("updateMatch and deleteMatch", () => {
  async function loggedByNeo(f: LoggedFixture, tx: DBTx) {
    const { logMatch } = await load();
    const logged = await logMatch(
      f.ids.pong,
      beat(f.ids.neo, f.ids.trinity),
      f.ctx(NEO),
      tx,
    );
    if (!logged.ok) throw new Error(logged.error);
    return logged.resultId;
  }

  it("lets the logger edit their Match, keeping its recorded time, and delete it", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { updateMatch, deleteMatch } = await load();
      const { getLoggedResultsView } = await import("@/queries/logged-results");
      const f = await fixture(tx);
      const matchId = await loggedByNeo(f, tx);
      const old = new Date("2099-01-02T12:00:00Z");
      await tx
        .update(f.schema.seriesMatch)
        .set({ recordedAt: old, updatedAt: old })
        .where(eq(f.schema.seriesMatch.id, matchId));

      expect(
        await updateMatch(
          f.ids.pong,
          matchId,
          beat(f.ids.trinity, f.ids.neo),
          f.ctx(NEO),
          tx,
        ),
      ).toEqual({ ok: true });
      const [row] = await f.matchRows(f.ids.pong);
      expect(row.recordedAt).toEqual(old);
      expect(row.updatedAt).not.toEqual(old);
      const view = await getLoggedResultsView(f.ids.pong, NEO, tx);
      expect(view!.results[0].players.map((p) => [p.name, p.place])).toEqual([
        ["Trinity", 1],
        ["Neo", 2],
      ]);

      expect(await deleteMatch(f.ids.pong, matchId, f.ctx(NEO), tx)).toEqual({
        ok: true,
      });
      expect(await f.matchRows(f.ids.pong)).toEqual([]);
    });
  });

  it("refuses another player, and lets a Host and an Organizer change any Match", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { updateMatch, deleteMatch } = await load();
      const f = await fixture(tx);
      const first = await loggedByNeo(f, tx);

      expect(
        await updateMatch(
          f.ids.pong,
          first,
          beat(f.ids.trinity, f.ids.neo),
          f.ctx(TRINITY),
          tx,
        ),
      ).toEqual({ ok: false, error: NOT_THE_LOGGER });
      expect(await deleteMatch(f.ids.pong, first, f.ctx(TRINITY), tx)).toEqual({
        ok: false,
        error: NOT_THE_LOGGER,
      });
      expect(
        await updateMatch(
          f.ids.pong,
          first,
          beat(f.ids.trinity, f.ids.neo),
          f.ctx(HOST),
          tx,
        ),
      ).toEqual({ ok: true });
      expect(
        await deleteMatch(f.ids.pong, first, f.ctx(ORGANIZER), tx),
      ).toEqual({ ok: true });
    });
  });

  it("says a Match of another Competition no longer exists, even to a Host", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { logMatch, updateMatch, deleteMatch } = await load();
      const f = await fixture(tx);
      const relayMatch = await logMatch(
        f.ids.relay,
        beat(f.ids.red, f.ids.blue),
        f.ctx(HOST),
        tx,
      );
      if (!relayMatch.ok) throw new Error(relayMatch.error);

      for (const email of [NEO, HOST]) {
        expect(
          await updateMatch(
            f.ids.pong,
            relayMatch.resultId,
            beat(f.ids.neo, f.ids.trinity),
            f.ctx(email),
            tx,
          ),
        ).toEqual({ ok: false, error: MATCH_MISSING });
        expect(
          await deleteMatch(f.ids.pong, relayMatch.resultId, f.ctx(email), tx),
        ).toEqual({ ok: false, error: MATCH_MISSING });
      }
      expect(await f.matchRows(f.ids.relay)).toHaveLength(1);
    });
  });
});

describe.skipIf(!isLocalDatabase)("setSeriesConfig", () => {
  it("saves draws and a Best of, and requires the Best of", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { setSeriesConfig } = await load();
      const f = await fixture(tx);

      expect(
        await setSeriesConfig(
          f.ids.pong,
          { drawsAllowed: true, bestOf: 1 },
          f.ctx(HOST),
          tx,
        ),
      ).toEqual({ ok: true });
      const [saved] = await tx
        .select({ seriesConfig: f.schema.competition.seriesConfig })
        .from(f.schema.competition)
        .where(eq(f.schema.competition.id, f.ids.pong));
      expect(saved.seriesConfig).toEqual({ drawsAllowed: true, bestOf: 1 });
      expect(
        await setSeriesConfig(
          f.ids.pong,
          { drawsAllowed: true, bestOf: null } as never,
          f.ctx(HOST),
          tx,
        ),
      ).toEqual({ ok: false, error: "Best of is 1, 3, 5 or 7." });
    });
  });

  it("won't shorten the Best of below its Matches, or turn draws off while a Match is a draw", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { logMatch, setSeriesConfig } = await load();
      const f = await fixture(tx);
      for (const players of [
        beat(f.ids.red, f.ids.blue),
        {
          players: [
            { id: f.ids.red, place: 1, score: null },
            { id: f.ids.blue, place: 1, score: null },
          ],
        },
      ]) {
        expect(
          await logMatch(f.ids.relay, players, f.ctx(HOST), tx),
        ).toMatchObject({ ok: true });
      }

      expect(
        await setSeriesConfig(
          f.ids.relay,
          { drawsAllowed: true, bestOf: 1 },
          f.ctx(HOST),
          tx,
        ),
      ).toEqual({ ok: false, error: "These Matches don't fit a Best of 1." });
      expect(
        await setSeriesConfig(
          f.ids.relay,
          { drawsAllowed: false, bestOf: 3 },
          f.ctx(HOST),
          tx,
        ),
      ).toEqual({
        ok: false,
        error:
          "A Match here is a draw. Delete or edit it before turning draws off.",
      });
    });
  });
});

describe.skipIf(!isLocalDatabase)("a Head-to-head's two Entrants", () => {
  it("takes exactly 2, and can't change once a Match is logged", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { replaceEntrants } = await import("@/mutations/brackets");
      const { logMatch } = await load();
      const f = await fixture(tx);
      const replace = (targetIds: string[]) =>
        replaceEntrants(f.ids.pong, { targetIds }, f.ctx(HOST), tx);

      expect(await replace([f.ids.neo])).toEqual({
        ok: false,
        error: "A Head-to-head needs exactly 2 Entrants.",
      });
      expect(await replace([f.ids.neo, f.ids.morpheus])).toEqual({ ok: true });
      expect(await replace([f.ids.neo, f.ids.trinity])).toEqual({ ok: true });
      await logMatch(
        f.ids.pong,
        beat(f.ids.neo, f.ids.trinity),
        f.ctx(HOST),
        tx,
      );
      // The same two again changes nothing.
      expect(await replace([f.ids.neo, f.ids.trinity])).toEqual({ ok: true });
      expect(await replace([f.ids.neo, f.ids.morpheus])).toEqual({
        ok: false,
        error: "Neo has logged Matches. Delete them first.",
      });
      expect(await f.matchRows(f.ids.pong)).toHaveLength(1);
    });
  });
});

describe.skipIf(!isLocalDatabase)(
  "getLoggedResultsView for a Head-to-head",
  () => {
    it("is null for an id that isn't a row id, and for another Format", async () => {
      await inRolledBackTransaction(async (tx) => {
        const { getLoggedResultsView } =
          await import("@/queries/logged-results");
        const f = await fixture(tx);
        expect(await getLoggedResultsView("not-a-uuid", NEO, tx)).toBeNull();
        expect(await getLoggedResultsView(f.ids.trivia, NEO, tx)).toBeNull();
      });
    });

    it("shows names, per-Match permissions for the viewer, its two Entrants, and never an email", async () => {
      await inRolledBackTransaction(async (tx) => {
        const { logMatch } = await load();
        const { getLoggedResultsView } =
          await import("@/queries/logged-results");
        const f = await fixture(tx);
        const mine = await logMatch(
          f.ids.pong,
          beat(f.ids.neo, f.ids.trinity),
          f.ctx(NEO),
          tx,
        );
        const theirs = await logMatch(
          f.ids.pong,
          beat(f.ids.trinity, f.ids.neo),
          f.ctx(TRINITY),
          tx,
        );
        if (!mine.ok || !theirs.ok) throw new Error("setup");

        const view = await getLoggedResultsView(f.ids.pong, NEO, tx);
        expect(JSON.stringify(view)).not.toContain("@");
        expect(view!.viewerCanLog).toBe(true);
        const byId = new Map(view!.results.map((g) => [g.id, g]));
        expect(byId.get(mine.resultId)).toMatchObject({
          canEdit: true,
          canDelete: true,
        });
        expect(byId.get(theirs.resultId)).toMatchObject({
          canEdit: false,
          canDelete: false,
        });
        expect(view!.playerOptions.map((o) => o.name)).toEqual([
          "Neo",
          "Trinity",
        ]);

        const hostView = await getLoggedResultsView(f.ids.pong, HOST, tx);
        expect(hostView!.results.every((g) => g.canEdit && g.canDelete)).toBe(
          true,
        );
        const anonymous = await getLoggedResultsView(f.ids.pong, null, tx);
        expect(anonymous!.viewerCanLog).toBe(false);
      });
    });

    it("names a decided series' Winner and stops a Participant's logging", async () => {
      await inRolledBackTransaction(async (tx) => {
        const { logMatch } = await load();
        const { getLoggedResultsView } =
          await import("@/queries/logged-results");
        const f = await fixture(tx);
        for (let i = 0; i < 2; i++) {
          await logMatch(
            f.ids.pong,
            beat(f.ids.neo, f.ids.trinity),
            f.ctx(NEO),
            tx,
          );
        }
        const view = await getLoggedResultsView(f.ids.pong, TRINITY, tx);
        expect(view!.decided).toBe(true);
        expect(view!.seriesWinner).toBe("Neo");
        expect(view!.viewerCanLog).toBe(false);
        expect(
          (await getLoggedResultsView(f.ids.pong, HOST, tx))!.viewerCanLog,
        ).toBe(true);
      });
    });
  },
);

describe.skipIf(!isLocalDatabase)("getLoggableCompetitions", () => {
  it("lists the open Head-to-heads the linked Participant plays in, and every open Best score", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { getLoggableCompetitions } =
        await import("@/queries/logged-results");
      const f = await fixture(tx);
      await f.setCompetition(f.ids.bowl, { closedAt: new Date() });
      const names = async (email: string) =>
        (await getLoggableCompetitions(f.warWeekId, email, tx)).map(
          (c) => c.name,
        );

      expect(await names(NEO)).toEqual(["Pong", "Relay", "Stairs"]);
      // Not a Pong Entrant; Red is a Relay Entrant.
      expect(await names(MORPHEUS)).toEqual(["Relay", "Stairs"]);
      expect(await names(NOBODY)).toEqual([]);
    });
  });
});
