import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import type { DBTx } from "@/db";
import { isLocalDatabaseUrl } from "@/db/local-url";
import { inRolledBackTransaction } from "@/db/test-transaction";

// Runs only against a local Postgres (see vitest.config.ts).
const isLocalDatabase = isLocalDatabaseUrl(
  process.env.DATABASE_URL,
  process.env.DATABASE_DRIVER,
);

const NEO = "neo@jahnelgroup.com";
const TRINITY = "trinity@jahnelgroup.com";
const MORPHEUS = "morpheus@jahnelgroup.com";
const NOBODY = "nobody@jahnelgroup.com";
const HOST = "games-test-host@jahnelgroup.com";
const ORGANIZER = "games-test-organizer@jahnelgroup.com";

const NOT_LINKED = "Your sign-in doesn't match a Participant of this War Week.";
const NOT_A_PLAYER = "You're not a player in this Game.";
const NOT_THE_LOGGER =
  "Only the player who logged this Game can change it. Ask the Host.";
const CLOSED = "This Competition is closed.";
const GAME_MISSING = "That Game no longer exists.";

/**
 * A War Week with Red (Neo, Morpheus) and Blue (Trinity, Cypher with no
 * email), a second War Week with Smith, and four Competitions: Pong
 * (individual head-to-head, open), Duel (individual Best of 3 between Neo
 * and Trinity), Bowl (individual best-score, open) and Trivia (points).
 * Pong and Bowl give 10, 6, 3 and count toward the Team.
 */
async function fixture(tx: DBTx) {
  const schema = await import("@/db/schema");
  const warWeek = async (n: number) => {
    const [row] = await tx
      .insert(schema.warWeek)
      .values({
        edition: `g${n}`,
        editionNumber: 9200 + n,
        year: 9200 + n,
        startDate: "2099-01-01",
        endDate: "2099-01-05",
        storyTheme: "Games test",
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
    return row.id;
  };
  const warWeekId = await warWeek(1);
  const otherWarWeekId = await warWeek(2);
  const [red, blue] = await tx
    .insert(schema.team)
    .values([
      { warWeekId, name: "Red", color: "#f00" },
      { warWeekId, name: "Blue", color: "#00f" },
    ])
    .returning({ id: schema.team.id });
  const [neo, trinity, morpheus, cypher] = await tx
    .insert(schema.participant)
    .values([
      { warWeekId, displayName: "Neo", email: NEO, teamId: red.id },
      { warWeekId, displayName: "Trinity", email: TRINITY, teamId: blue.id },
      { warWeekId, displayName: "Morpheus", email: MORPHEUS, teamId: red.id },
      { warWeekId, displayName: "Cypher", teamId: blue.id },
    ])
    .returning({ id: schema.participant.id });
  const [smith] = await tx
    .insert(schema.participant)
    .values({ warWeekId: otherWarWeekId, displayName: "Smith", email: NEO })
    .returning({ id: schema.participant.id });
  const [pong, duel, bowl, trivia] = await tx
    .insert(schema.competition)
    .values([
      {
        warWeekId,
        name: "Pong",
        scoring: "individual" as const,
        countsTowardTeam: true,
        format: "head-to-head" as const,
        gameConfig: { drawsAllowed: false, bestOf: null },
        entrantsOpen: true,
        placementPoints: [10, 6, 3],
      },
      {
        warWeekId,
        name: "Duel",
        scoring: "individual" as const,
        format: "head-to-head" as const,
        gameConfig: { drawsAllowed: false, bestOf: 3 as const },
        entrantsOpen: false,
        placementPoints: [10, 6],
      },
      {
        warWeekId,
        name: "Bowl",
        scoring: "individual" as const,
        countsTowardTeam: true,
        format: "best-score" as const,
        gameConfig: { count: "best", betterIs: "higher", unit: "pins" },
        entrantsOpen: true,
        placementPoints: [10, 6, 3],
      },
      {
        warWeekId,
        name: "Trivia",
        scoring: "team" as const,
        format: "placement" as const,
      },
    ])
    .returning({ id: schema.competition.id });
  await tx.insert(schema.entrant).values([
    { competitionId: duel.id, participantId: neo.id, seedPosition: 1 },
    { competitionId: duel.id, participantId: trinity.id, seedPosition: 2 },
  ]);
  await tx.insert(schema.competitionHost).values(
    [pong.id, duel.id, bowl.id].map((competitionId) => ({
      competitionId,
      email: HOST,
    })),
  );
  await tx
    .insert(schema.organizer)
    .values({ email: ORGANIZER })
    .onConflictDoNothing();

  const setCompetition = (
    id: string,
    values: Partial<typeof schema.competition.$inferInsert>,
  ) =>
    tx
      .update(schema.competition)
      .set(values)
      .where(eq(schema.competition.id, id));
  const gameRows = (competitionId: string) =>
    tx
      .select({
        id: schema.game.id,
        loggedByEmail: schema.game.loggedByEmail,
        loggedByParticipantId: schema.game.loggedByParticipantId,
        loggedAt: schema.game.loggedAt,
        updatedAt: schema.game.updatedAt,
      })
      .from(schema.game)
      .where(eq(schema.game.competitionId, competitionId));
  const playerRows = (gameId: string) =>
    tx
      .select({
        teamId: schema.gamePlayer.teamId,
        participantId: schema.gamePlayer.participantId,
        place: schema.gamePlayer.place,
        score: schema.gamePlayer.score,
      })
      .from(schema.gamePlayer)
      .where(eq(schema.gamePlayer.gameId, gameId));

  return {
    schema,
    warWeekId,
    ctx: (actorEmail: string) => ({ warWeekId, actorEmail }),
    ids: {
      red: red.id,
      blue: blue.id,
      neo: neo.id,
      trinity: trinity.id,
      morpheus: morpheus.id,
      cypher: cypher.id,
      smith: smith.id,
      pong: pong.id,
      duel: duel.id,
      bowl: bowl.id,
      trivia: trivia.id,
    },
    setCompetition,
    gameRows,
    playerRows,
  };
}

/** A head-to-head Game `winner` won against `loser`. */
const beat = (winner: string, loser: string) => ({
  players: [
    { id: winner, place: 1, score: null },
    { id: loser, place: 2, score: null },
  ],
});

const scored = (id: string, score: number) => ({
  players: [{ id, place: null, score }],
});

async function load() {
  return import("@/mutations/games");
}

describe.skipIf(!isLocalDatabase)("logGame", () => {
  it("lets a linked player log a Game they play in, and it counts at once", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { logGame } = await load();
      const { getGamesView } = await import("@/queries/games");
      const f = await fixture(tx);

      const result = await logGame(
        f.ids.pong,
        beat(f.ids.neo, f.ids.trinity),
        f.ctx(NEO),
        tx,
      );
      expect(result).toEqual({ ok: true, gameId: expect.any(String) });

      const [row] = await f.gameRows(f.ids.pong);
      expect(row.loggedByEmail).toBe(NEO);
      expect(row.loggedByParticipantId).toBe(f.ids.neo);

      const view = await getGamesView(f.ids.pong, NEO, tx);
      expect(
        view!.leaderboard.map((r) => [r.name, r.rank, r.wins, r.losses]),
      ).toEqual([
        ["Neo", 1, 1, 0],
        ["Trinity", 2, 0, 1],
      ]);
    });
  });

  it("refuses a sign-in that links no Participant", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { logGame } = await load();
      const f = await fixture(tx);

      expect(
        await logGame(
          f.ids.pong,
          beat(f.ids.cypher, f.ids.trinity),
          f.ctx(NOBODY),
          tx,
        ),
      ).toEqual({ ok: false, error: NOT_LINKED });
      expect(await f.gameRows(f.ids.pong)).toEqual([]);
    });
  });

  it("refuses a linked Participant who isn't a player in the Game", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { logGame } = await load();
      const f = await fixture(tx);

      expect(
        await logGame(
          f.ids.pong,
          beat(f.ids.neo, f.ids.trinity),
          f.ctx(MORPHEUS),
          tx,
        ),
      ).toEqual({ ok: false, error: NOT_A_PLAYER });
    });
  });

  it("lets a Host log any Game, recording no logging Participant", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { logGame } = await load();
      const f = await fixture(tx);

      expect(
        await logGame(
          f.ids.pong,
          beat(f.ids.neo, f.ids.trinity),
          f.ctx(HOST),
          tx,
        ),
      ).toMatchObject({ ok: true });
      const [row] = await f.gameRows(f.ids.pong);
      expect(row.loggedByEmail).toBe(HOST);
      expect(row.loggedByParticipantId).toBeNull();
    });
  });

  it("refuses everyone, an Organizer included, once the Competition is closed", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { logGame, updateGame, deleteGame } = await load();
      const f = await fixture(tx);
      const logged = await logGame(
        f.ids.pong,
        beat(f.ids.neo, f.ids.trinity),
        f.ctx(NEO),
        tx,
      );
      if (!logged.ok) throw new Error(logged.error);
      await f.setCompetition(f.ids.pong, { finalizedAt: new Date() });

      for (const email of [NEO, HOST, ORGANIZER]) {
        expect(
          await logGame(
            f.ids.pong,
            beat(f.ids.neo, f.ids.trinity),
            f.ctx(email),
            tx,
          ),
        ).toEqual({ ok: false, error: CLOSED });
        expect(
          await updateGame(
            f.ids.pong,
            logged.gameId,
            beat(f.ids.trinity, f.ids.neo),
            f.ctx(email),
            tx,
          ),
        ).toEqual({ ok: false, error: CLOSED });
        expect(
          await deleteGame(f.ids.pong, logged.gameId, f.ctx(email), tx),
        ).toEqual({ ok: false, error: CLOSED });
      }
      expect(await f.gameRows(f.ids.pong)).toHaveLength(1);
    });
  });

  it("re-checks under the lock: a log after Close is refused", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { logGame, closeGames } = await load();
      const f = await fixture(tx);

      expect(await closeGames(f.ids.pong, f.ctx(HOST), tx)).toEqual({
        ok: true,
      });
      expect(
        await logGame(
          f.ids.pong,
          beat(f.ids.neo, f.ids.trinity),
          f.ctx(NEO),
          tx,
        ),
      ).toEqual({ ok: false, error: CLOSED });
    });
  });

  it("refuses a Participant after the logging close time, and allows a Host", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { logGame } = await load();
      const f = await fixture(tx);
      await f.setCompetition(f.ids.pong, {
        loggingClosesAt: new Date("2020-01-01T00:00:00Z"),
      });

      expect(
        await logGame(
          f.ids.pong,
          beat(f.ids.neo, f.ids.trinity),
          f.ctx(NEO),
          tx,
        ),
      ).toEqual({
        ok: false,
        error: "Logging is closed for this Competition.",
      });
      expect(
        await logGame(
          f.ids.pong,
          beat(f.ids.neo, f.ids.trinity),
          f.ctx(HOST),
          tx,
        ),
      ).toMatchObject({ ok: true });
    });
  });

  it("stops a Participant's logging once a Best of is decided, but not a Host's", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { logGame } = await load();
      const f = await fixture(tx);
      for (let i = 0; i < 2; i++) {
        expect(
          await logGame(
            f.ids.duel,
            beat(f.ids.neo, f.ids.trinity),
            f.ctx(NEO),
            tx,
          ),
        ).toMatchObject({ ok: true });
      }

      expect(
        await logGame(
          f.ids.duel,
          beat(f.ids.trinity, f.ids.neo),
          f.ctx(TRINITY),
          tx,
        ),
      ).toEqual({
        ok: false,
        error: "This Best of is decided, so logging is closed.",
      });
      expect(
        await logGame(
          f.ids.duel,
          beat(f.ids.trinity, f.ids.neo),
          f.ctx(HOST),
          tx,
        ),
      ).toMatchObject({ ok: true });
    });
  });

  it("refuses a player off the fixed Entrant list", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { logGame } = await load();
      const f = await fixture(tx);

      expect(
        await logGame(
          f.ids.duel,
          beat(f.ids.neo, f.ids.morpheus),
          f.ctx(NEO),
          tx,
        ),
      ).toEqual({
        ok: false,
        error: "Every player must be an Entrant of this Competition.",
      });
      expect(
        await logGame(
          f.ids.duel,
          beat(f.ids.neo, f.ids.morpheus),
          f.ctx(HOST),
          tx,
        ),
      ).toEqual({
        ok: false,
        error: "Every player must be an Entrant of this Competition.",
      });
    });
  });

  it("refuses a player of another War Week, a Team in an individual Competition, and a repeated player", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { logGame } = await load();
      const f = await fixture(tx);
      const individual = "Every player must be a Participant of this War Week.";

      expect(
        await logGame(f.ids.pong, beat(f.ids.neo, f.ids.smith), f.ctx(NEO), tx),
      ).toEqual({ ok: false, error: individual });
      expect(
        await logGame(f.ids.pong, beat(f.ids.red, f.ids.blue), f.ctx(HOST), tx),
      ).toEqual({ ok: false, error: individual });
      expect(
        await logGame(f.ids.pong, beat(f.ids.neo, f.ids.neo), f.ctx(HOST), tx),
      ).toEqual({ ok: false, error: "Choose each player only once." });
      expect(await f.gameRows(f.ids.pong)).toEqual([]);
    });
  });

  it("refuses the wrong number of players for the Format", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { logGame } = await load();
      const f = await fixture(tx);

      expect(
        await logGame(
          f.ids.bowl,
          {
            players: [
              { id: f.ids.neo, place: null, score: 1 },
              { id: f.ids.trinity, place: null, score: 2 },
            ],
          },
          f.ctx(HOST),
          tx,
        ),
      ).toEqual({
        ok: false,
        error: "A best-score Game has exactly 1 player.",
      });
      expect(
        await logGame(
          f.ids.pong,
          { players: [{ id: f.ids.neo, place: 1, score: null }] },
          f.ctx(HOST),
          tx,
        ),
      ).toEqual({
        ok: false,
        error: "A head-to-head Game has exactly 2 players.",
      });
    });
  });

  it("refuses a Competition not run as Games, and one of another War Week", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { logGame } = await load();
      const f = await fixture(tx);

      expect(
        await logGame(
          f.ids.trivia,
          beat(f.ids.red, f.ids.blue),
          f.ctx(HOST),
          tx,
        ),
      ).toEqual({ ok: false, error: "This Competition isn't run as Games." });
      expect(
        await logGame(
          f.ids.pong,
          beat(f.ids.neo, f.ids.trinity),
          { warWeekId: f.ids.red, actorEmail: HOST },
          tx,
        ),
      ).toEqual({ ok: false, error: "That Competition no longer exists." });
    });
  });
});

describe.skipIf(!isLocalDatabase)("updateGame and deleteGame", () => {
  async function loggedByNeo(f: Awaited<ReturnType<typeof fixture>>, tx: DBTx) {
    const { logGame } = await load();
    const logged = await logGame(
      f.ids.pong,
      beat(f.ids.neo, f.ids.trinity),
      f.ctx(NEO),
      tx,
    );
    if (!logged.ok) throw new Error(logged.error);
    return logged.gameId;
  }

  it("lets the logger edit their Game, replacing its players and keeping its logged-at time", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { updateGame } = await load();
      const f = await fixture(tx);
      const gameId = await loggedByNeo(f, tx);
      const old = new Date("2099-01-02T12:00:00Z");
      await tx
        .update(f.schema.game)
        .set({ loggedAt: old, updatedAt: old })
        .where(eq(f.schema.game.id, gameId));

      expect(
        await updateGame(
          f.ids.pong,
          gameId,
          beat(f.ids.trinity, f.ids.neo),
          f.ctx(NEO),
          tx,
        ),
      ).toEqual({ ok: true });

      const [row] = await f.gameRows(f.ids.pong);
      expect(row.loggedAt).toEqual(old);
      expect(row.updatedAt).not.toEqual(old);
      const players = await f.playerRows(gameId);
      expect(
        players
          .map((p) => [p.participantId, p.place])
          .sort((a, b) => Number(a[1]) - Number(b[1])),
      ).toEqual([
        [f.ids.trinity, 1],
        [f.ids.neo, 2],
      ]);
    });
  });

  it("lets the logger delete their Game", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { deleteGame } = await load();
      const f = await fixture(tx);
      const gameId = await loggedByNeo(f, tx);

      expect(await deleteGame(f.ids.pong, gameId, f.ctx(NEO), tx)).toEqual({
        ok: true,
      });
      expect(await f.gameRows(f.ids.pong)).toEqual([]);
      expect(await f.playerRows(gameId)).toEqual([]);
    });
  });

  it("refuses another player in the Game", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { updateGame, deleteGame } = await load();
      const f = await fixture(tx);
      const gameId = await loggedByNeo(f, tx);

      expect(
        await updateGame(
          f.ids.pong,
          gameId,
          beat(f.ids.trinity, f.ids.neo),
          f.ctx(TRINITY),
          tx,
        ),
      ).toEqual({ ok: false, error: NOT_THE_LOGGER });
      expect(await deleteGame(f.ids.pong, gameId, f.ctx(TRINITY), tx)).toEqual({
        ok: false,
        error: NOT_THE_LOGGER,
      });
      expect(await f.gameRows(f.ids.pong)).toHaveLength(1);
    });
  });

  it("refuses an edit that moves the Game off its logger", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { updateGame } = await load();
      const f = await fixture(tx);
      const gameId = await loggedByNeo(f, tx);

      expect(
        await updateGame(
          f.ids.pong,
          gameId,
          beat(f.ids.trinity, f.ids.morpheus),
          f.ctx(NEO),
          tx,
        ),
      ).toEqual({ ok: false, error: NOT_A_PLAYER });
    });
  });

  it("lets a Host and an Organizer edit and delete any Game", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { updateGame, deleteGame } = await load();
      const f = await fixture(tx);
      const first = await loggedByNeo(f, tx);
      const second = await loggedByNeo(f, tx);

      expect(
        await updateGame(
          f.ids.pong,
          first,
          beat(f.ids.trinity, f.ids.morpheus),
          f.ctx(HOST),
          tx,
        ),
      ).toEqual({ ok: true });
      expect(
        await updateGame(
          f.ids.pong,
          second,
          beat(f.ids.morpheus, f.ids.neo),
          f.ctx(ORGANIZER),
          tx,
        ),
      ).toEqual({ ok: true });
      expect(await deleteGame(f.ids.pong, first, f.ctx(HOST), tx)).toEqual({
        ok: true,
      });
      expect(
        await deleteGame(f.ids.pong, second, f.ctx(ORGANIZER), tx),
      ).toEqual({ ok: true });
      expect(await f.gameRows(f.ids.pong)).toEqual([]);
    });
  });

  it("says a Game of another Competition no longer exists, even to a Host", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { logGame, updateGame, deleteGame } = await load();
      const f = await fixture(tx);
      const bowlGame = await logGame(
        f.ids.bowl,
        scored(f.ids.neo, 200),
        f.ctx(NEO),
        tx,
      );
      if (!bowlGame.ok) throw new Error(bowlGame.error);

      for (const email of [NEO, HOST]) {
        expect(
          await updateGame(
            f.ids.pong,
            bowlGame.gameId,
            beat(f.ids.neo, f.ids.trinity),
            f.ctx(email),
            tx,
          ),
        ).toEqual({ ok: false, error: GAME_MISSING });
        expect(
          await deleteGame(f.ids.pong, bowlGame.gameId, f.ctx(email), tx),
        ).toEqual({ ok: false, error: GAME_MISSING });
      }
      expect(await f.gameRows(f.ids.bowl)).toHaveLength(1);
    });
  });
});

describe.skipIf(!isLocalDatabase)("closeGames and reopenGames", () => {
  it("awards Placement Points from the leaderboard, ties sharing them, and Reopen withdraws only those", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { logGame, closeGames, reopenGames } = await load();
      const { getStandings } = await import("@/queries/standings");
      const { getGamesLeaderboard } = await import("@/queries/games");
      const { placingsOf } = await import("@/lib/games/leaderboard");
      const { pointsFor } = await import("@/lib/bracket/points");
      const f = await fixture(tx);
      // Neo and Trinity tie at 42 pins; Morpheus is third with 30.
      for (const [id, score] of [
        [f.ids.neo, 30],
        [f.ids.neo, 42],
        [f.ids.trinity, 42],
        [f.ids.morpheus, 30],
      ] as const) {
        const r = await logGame(f.ids.bowl, scored(id, score), f.ctx(HOST), tx);
        expect(r).toMatchObject({ ok: true });
      }
      // A non-generated Points Entry (inserted directly) on the same Competition.
      await tx.insert(f.schema.pointsEntry).values({
        warWeekId: f.warWeekId,
        competitionId: f.ids.bowl,
        participantId: f.ids.cypher,
        points: 5,
        note: "Style points",
        enteredByEmail: HOST,
      });
      const warWeek = { id: f.warWeekId, mode: "teams" as const };
      const totals = async () => {
        const s = await getStandings(warWeek, tx);
        return {
          individual: Object.fromEntries(
            s.individual.map((r) => [r.name, r.total]),
          ),
          team: Object.fromEntries(s.team.map((r) => [r.name, r.total])),
        };
      };
      const entries = () =>
        tx
          .select({
            participantId: f.schema.pointsEntry.participantId,
            teamId: f.schema.pointsEntry.teamId,
            points: f.schema.pointsEntry.points,
            note: f.schema.pointsEntry.note,
            generated: f.schema.pointsEntry.generatedByBracket,
          })
          .from(f.schema.pointsEntry)
          .where(eq(f.schema.pointsEntry.competitionId, f.ids.bowl));
      const generated = async () =>
        (await entries())
          .filter((e) => e.generated)
          .map((e) => ({ participantId: e.participantId, points: e.points }))
          .sort(
            (a, b) =>
              b.points - a.points ||
              a.participantId!.localeCompare(b.participantId!),
          );
      const before = await totals();
      expect(before.individual).toEqual({ Cypher: 5 });

      expect(await closeGames(f.ids.bowl, f.ctx(HOST), tx)).toEqual({
        ok: true,
      });

      const tied = [f.ids.neo, f.ids.trinity].sort();
      expect(await generated()).toEqual([
        { participantId: tied[0], points: 10 },
        { participantId: tied[1], points: 10 },
        { participantId: f.ids.morpheus, points: 3 },
      ]);
      // The same rows the leaderboard feeds to the Bracket's points rule.
      const rows = await getGamesLeaderboard(f.ids.bowl, tx);
      expect(
        pointsFor(placingsOf(rows), { placementPoints: [10, 6, 3] })
          .map((p) => ({ participantId: p.entrantId, points: p.points }))
          .sort(
            (a, b) =>
              b.points - a.points ||
              a.participantId.localeCompare(b.participantId),
          ),
      ).toEqual(await generated());
      expect(
        (await entries()).filter((e) => e.generated).map((e) => e.note),
      ).toEqual(["From best score", "From best score", "From best score"]);

      const after = await totals();
      expect(after.individual).toEqual({
        Cypher: 5,
        Neo: 10,
        Trinity: 10,
        Morpheus: 3,
      });
      expect(after.team.Red - before.team.Red).toBe(13);
      expect(after.team.Blue - before.team.Blue).toBe(10);

      expect(await closeGames(f.ids.bowl, f.ctx(HOST), tx)).toEqual({
        ok: false,
        error: "This Competition is already closed.",
      });

      expect(await reopenGames(f.ids.bowl, f.ctx(HOST), tx)).toEqual({
        ok: true,
      });
      expect(await generated()).toEqual([]);
      expect(await entries()).toEqual([
        {
          participantId: f.ids.cypher,
          teamId: null,
          points: 5,
          note: "Style points",
          generated: false,
        },
      ]);
      expect(await totals()).toEqual(before);
      const [comp] = await tx
        .select({ finalizedAt: f.schema.competition.finalizedAt })
        .from(f.schema.competition)
        .where(eq(f.schema.competition.id, f.ids.bowl));
      expect(comp.finalizedAt).toBeNull();
    });
  });

  it("refuses a Competition not run as Games", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { closeGames, reopenGames } = await load();
      const f = await fixture(tx);
      const notGames = {
        ok: false,
        error: "This Competition isn't run as Games.",
      };
      expect(await closeGames(f.ids.trivia, f.ctx(HOST), tx)).toEqual(notGames);
      expect(await reopenGames(f.ids.trivia, f.ctx(HOST), tx)).toEqual(
        notGames,
      );
    });
  });
});

describe.skipIf(!isLocalDatabase)("setGamesSettings", () => {
  const settings = {
    entrantsOpen: false,
    loggingClosesAt: null,
    selfEnroll: false,
    entrantLimit: null,
    enrollClosesAt: null,
  };

  it("saves the Format's settings and the Entrant and logging rules", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { setGamesSettings } = await load();
      const f = await fixture(tx);
      const closes = new Date("2099-01-04T17:00:00Z");

      expect(
        await setGamesSettings(
          f.ids.pong,
          {
            ...settings,
            gameConfig: { drawsAllowed: true, bestOf: null },
            loggingClosesAt: closes,
            selfEnroll: true,
            entrantLimit: 8,
          },
          f.ctx(HOST),
          tx,
        ),
      ).toEqual({ ok: true });
      const [row] = await tx
        .select({
          gameConfig: f.schema.competition.gameConfig,
          entrantsOpen: f.schema.competition.entrantsOpen,
          loggingClosesAt: f.schema.competition.loggingClosesAt,
          selfEnroll: f.schema.competition.selfEnroll,
          entrantLimit: f.schema.competition.entrantLimit,
        })
        .from(f.schema.competition)
        .where(eq(f.schema.competition.id, f.ids.pong));
      expect(row).toEqual({
        gameConfig: { drawsAllowed: true, bestOf: null },
        entrantsOpen: false,
        loggingClosesAt: closes,
        selfEnroll: true,
        entrantLimit: 8,
      });
    });
  });

  it("allows a Best of only on a fixed list of exactly two Entrants, without enrollment", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { setGamesSettings } = await load();
      const f = await fixture(tx);
      const bestOf = { drawsAllowed: false, bestOf: 5 as const };

      expect(
        await setGamesSettings(
          f.ids.pong,
          { ...settings, gameConfig: bestOf, entrantsOpen: true },
          f.ctx(HOST),
          tx,
        ),
      ).toEqual({ ok: false, error: "A Best of needs a fixed Entrant list." });
      expect(
        await setGamesSettings(
          f.ids.pong,
          { ...settings, gameConfig: bestOf },
          f.ctx(HOST),
          tx,
        ),
      ).toEqual({ ok: false, error: "A Best of needs exactly 2 Entrants." });
      expect(
        await setGamesSettings(
          f.ids.duel,
          { ...settings, gameConfig: bestOf, selfEnroll: true },
          f.ctx(HOST),
          tx,
        ),
      ).toEqual({
        ok: false,
        error: "A Best of is set by the Host; enrollment is off.",
      });
      expect(
        await setGamesSettings(
          f.ids.duel,
          { ...settings, gameConfig: bestOf },
          f.ctx(HOST),
          tx,
        ),
      ).toEqual({ ok: true });
    });
  });

  it("refuses enrollment when everyone can play, a change of Format, and any change while closed", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { setGamesSettings } = await load();
      const f = await fixture(tx);
      const config = { drawsAllowed: false, bestOf: null };

      expect(
        await setGamesSettings(
          f.ids.pong,
          {
            ...settings,
            gameConfig: config,
            entrantsOpen: true,
            selfEnroll: true,
          },
          f.ctx(HOST),
          tx,
        ),
      ).toEqual({
        ok: false,
        error: "Everyone can play already; there's no list to enroll in.",
      });
      expect(
        await setGamesSettings(
          f.ids.pong,
          {
            ...settings,
            gameConfig: { count: "best", betterIs: "higher", unit: "" },
          },
          f.ctx(HOST),
          tx,
        ),
      ).toEqual({
        ok: false,
        error:
          "A Head-to-head or Best score Competition keeps its Format; add a new Competition to play another.",
      });
      await f.setCompetition(f.ids.pong, { finalizedAt: new Date() });
      expect(
        await setGamesSettings(
          f.ids.pong,
          { ...settings, gameConfig: config },
          f.ctx(HOST),
          tx,
        ),
      ).toEqual({ ok: false, error: "Reopen the Competition first." });
    });
  });
});

describe.skipIf(!isLocalDatabase)("setGamesSettings under logged Games", () => {
  const settings = {
    entrantsOpen: true,
    loggingClosesAt: null,
    selfEnroll: false,
    entrantLimit: null,
    enrollClosesAt: null,
  };
  const h2h = { drawsAllowed: false, bestOf: null };

  it("won't fix the list while someone off it has logged Games", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { logGame, setGamesSettings } = await load();
      const f = await fixture(tx);
      await logGame(
        f.ids.pong,
        beat(f.ids.neo, f.ids.trinity),
        f.ctx(HOST),
        tx,
      );
      await tx.insert(f.schema.entrant).values({
        competitionId: f.ids.pong,
        participantId: f.ids.neo,
        seedPosition: 1,
      });
      const fixed = { ...settings, gameConfig: h2h, entrantsOpen: false };

      expect(
        await setGamesSettings(f.ids.pong, fixed, f.ctx(HOST), tx),
      ).toEqual({
        ok: false,
        error:
          "Trinity has logged Games. Add them as an Entrant or delete their Games first.",
      });
      await tx.insert(f.schema.entrant).values({
        competitionId: f.ids.pong,
        participantId: f.ids.trinity,
        seedPosition: 2,
      });
      expect(
        await setGamesSettings(f.ids.pong, fixed, f.ctx(HOST), tx),
      ).toEqual({ ok: true });
    });
  });

  it("won't turn draws off while a Game is a draw", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { logGame, setGamesSettings } = await load();
      const f = await fixture(tx);
      await f.setCompetition(f.ids.pong, {
        gameConfig: { drawsAllowed: true, bestOf: null },
      });
      await logGame(
        f.ids.pong,
        {
          players: [
            { id: f.ids.neo, place: 1, score: null },
            { id: f.ids.trinity, place: 1, score: null },
          ],
        },
        f.ctx(HOST),
        tx,
      );

      expect(
        await setGamesSettings(
          f.ids.pong,
          { ...settings, gameConfig: h2h },
          f.ctx(HOST),
          tx,
        ),
      ).toEqual({
        ok: false,
        error:
          "A Game here is a draw. Delete or edit it before turning draws off.",
      });
      expect(
        await setGamesSettings(
          f.ids.pong,
          { ...settings, gameConfig: { drawsAllowed: true, bestOf: null } },
          f.ctx(HOST),
          tx,
        ),
      ).toEqual({ ok: true });
    });
  });

  it("won't turn a Best of on when the Games exceed it or aren't between its Entrants", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { logGame, setGamesSettings } = await load();
      const f = await fixture(tx);
      await f.setCompetition(f.ids.duel, { gameConfig: h2h });
      for (const [winner, loser] of [
        [f.ids.neo, f.ids.trinity],
        [f.ids.trinity, f.ids.neo],
        [f.ids.neo, f.ids.trinity],
        [f.ids.trinity, f.ids.neo],
      ]) {
        await logGame(f.ids.duel, beat(winner, loser), f.ctx(HOST), tx);
      }
      const bestOf = (n: 3 | 5) => ({
        ...settings,
        entrantsOpen: false,
        gameConfig: { drawsAllowed: false, bestOf: n },
      });

      expect(
        await setGamesSettings(f.ids.duel, bestOf(3), f.ctx(HOST), tx),
      ).toEqual({ ok: false, error: "These Games don't fit a Best of 3." });
      expect(
        await setGamesSettings(f.ids.duel, bestOf(5), f.ctx(HOST), tx),
      ).toEqual({ ok: true });

      // Pong: a Game with Morpheus, who isn't one of the two Entrants.
      await logGame(
        f.ids.pong,
        beat(f.ids.neo, f.ids.morpheus),
        f.ctx(HOST),
        tx,
      );
      await tx.insert(f.schema.entrant).values([
        {
          competitionId: f.ids.pong,
          participantId: f.ids.neo,
          seedPosition: 1,
        },
        {
          competitionId: f.ids.pong,
          participantId: f.ids.trinity,
          seedPosition: 2,
        },
      ]);
      expect(
        await setGamesSettings(f.ids.pong, bestOf(3), f.ctx(HOST), tx),
      ).toEqual({ ok: false, error: "These Games don't fit a Best of 3." });
    });
  });
});

describe.skipIf(!isLocalDatabase)("getGameLogFacts", () => {
  it("reads only the Format's player keys, so an extra player id can't make a non-player a player", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { getGameLogFacts } = await import("@/queries/games");
      const { postedGamePlayerIds } = await import("@/lib/games/input");
      const { gameLogError } = await import("@/lib/games/log-rule");
      const f = await fixture(tx);
      const posted = {
        playerA: f.ids.neo,
        playerB: f.ids.trinity,
        outcome: "a",
        player: f.ids.morpheus,
      };

      const facts = await getGameLogFacts(
        f.ids.pong,
        null,
        MORPHEUS,
        { playerIds: (gameFormat) => postedGamePlayerIds(gameFormat, posted) },
        tx,
      );
      expect(facts.gameLog.players).toEqual([
        { teamId: null, participantId: f.ids.neo },
        { teamId: null, participantId: f.ids.trinity },
      ]);
      expect(gameLogError(facts.gameLog)).toBe(NOT_A_PLAYER);
    });
  });
});

describe.skipIf(!isLocalDatabase)("getGamesView", () => {
  it("is null for an id that isn't a row id", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { getGamesView } = await import("@/queries/games");
      expect(await getGamesView("not-a-uuid", NEO, tx)).toBeNull();
    });
  });

  it("shows names, per-Game permissions for the viewer, and never an email", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { logGame } = await load();
      const { getGamesView } = await import("@/queries/games");
      const f = await fixture(tx);
      const mine = await logGame(
        f.ids.pong,
        beat(f.ids.neo, f.ids.trinity),
        f.ctx(NEO),
        tx,
      );
      const theirs = await logGame(
        f.ids.pong,
        beat(f.ids.trinity, f.ids.neo),
        f.ctx(TRINITY),
        tx,
      );
      if (!mine.ok || !theirs.ok) throw new Error("setup");

      const view = await getGamesView(f.ids.pong, NEO, tx);
      expect(view).not.toBeNull();
      expect(JSON.stringify(view)).not.toContain("@");
      expect(view!.viewerCanLog).toBe(true);
      expect(view!.linked).toEqual({
        participantId: f.ids.neo,
        teamId: f.ids.red,
      });
      const byId = new Map(view!.games.map((g) => [g.id, g]));
      expect(byId.get(mine.gameId)).toMatchObject({
        canEdit: true,
        canDelete: true,
      });
      expect(byId.get(theirs.gameId)).toMatchObject({
        canEdit: false,
        canDelete: false,
      });
      expect(
        byId.get(mine.gameId)!.players.map((p) => [p.name, p.place]),
      ).toEqual([
        ["Neo", 1],
        ["Trinity", 2],
      ]);
      // Open to everyone: every Participant of the War Week, by name.
      expect(view!.entrantOptions.map((o) => o.name)).toEqual([
        "Cypher",
        "Morpheus",
        "Neo",
        "Trinity",
      ]);

      const hostView = await getGamesView(f.ids.pong, HOST, tx);
      expect(JSON.stringify(hostView)).not.toContain("@");
      expect(hostView!.games.every((g) => g.canEdit && g.canDelete)).toBe(true);
      const anonymous = await getGamesView(f.ids.pong, null, tx);
      expect(anonymous!.viewerCanLog).toBe(false);
      expect(anonymous!.games.some((g) => g.canEdit)).toBe(false);
    });
  });

  it("names a decided Best of's winner, offers only its Entrants, and stops a Participant's logging", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { logGame } = await load();
      const { getGamesView } = await import("@/queries/games");
      const f = await fixture(tx);
      for (let i = 0; i < 2; i++) {
        await logGame(
          f.ids.duel,
          beat(f.ids.neo, f.ids.trinity),
          f.ctx(NEO),
          tx,
        );
      }

      const view = await getGamesView(f.ids.duel, TRINITY, tx);
      expect(view!.bestOfDecided).toBe(true);
      expect(view!.bestOfWinner).toBe("Neo");
      expect(view!.viewerCanLog).toBe(false);
      expect(view!.entrantOptions.map((o) => o.name)).toEqual([
        "Neo",
        "Trinity",
      ]);
      expect((await getGamesView(f.ids.duel, HOST, tx))!.viewerCanLog).toBe(
        true,
      );
    });
  });

  it("is null for a Competition not run as Games", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { getGamesView } = await import("@/queries/games");
      const f = await fixture(tx);
      expect(await getGamesView(f.ids.trivia, NEO, tx)).toBeNull();
    });
  });
});

describe.skipIf(!isLocalDatabase)("getLoggableCompetitions", () => {
  it("lists the open Games Competitions the linked Participant may log in now", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { getLoggableCompetitions } = await import("@/queries/games");
      const f = await fixture(tx);
      await f.setCompetition(f.ids.bowl, { finalizedAt: new Date() });
      const names = async (email: string) =>
        (await getLoggableCompetitions(f.warWeekId, email, tx)).map(
          (c) => c.name,
        );

      expect(await names(NEO)).toEqual(["Duel", "Pong"]);
      // Not a Duel Entrant.
      expect(await names(MORPHEUS)).toEqual(["Pong"]);
      expect(await names(NOBODY)).toEqual([]);

      await f.setCompetition(f.ids.pong, {
        loggingClosesAt: new Date("2020-01-01T00:00:00Z"),
      });
      expect(await names(NEO)).toEqual(["Duel"]);
    });
  });
});
