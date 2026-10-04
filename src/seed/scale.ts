import { and, asc, count, eq, like } from "drizzle-orm";

import { DBOrTx, db } from "@/db";
import {
  competition,
  competitionHost,
  entrant,
  game,
  heat,
  heatEntrant,
  participant,
  participation,
  warWeek,
} from "@/db/schema";
import {
  generateBracket,
  recordHeatResult,
  replaceEntrants,
} from "@/mutations/brackets";
import { logGame } from "@/mutations/games";
import { markParticipant } from "@/mutations/participation";
import { setCompetitionHosts } from "@/mutations/setup";
import type { MutationContext } from "@/mutations/types";

export const BRACKET = "Ping Pong Bracket";
export const BRACKET_ENTRANTS = 64;
/** How many of the Bracket's 32 Round 1 Heats get a Heat Result. */
export const RECORDED_ROUND_ONE = 20;
export const PARTICIPATION = "Morning Stretch";
export const PARTICIPATION_TICKS = 72;
export const HEAD_TO_HEAD = "Cornhole";
export const HEAD_TO_HEAD_GAMES = 40;
export const BEST_SCORE = "Darts";
export const BEST_SCORE_GAMES = 60;

/** A fixed-seed generator (mulberry32), so every load draws the same Bracket. */
function seededRng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function check(result: { ok: boolean; error?: string }, what: string) {
  if (!result.ok) throw new Error(`${what}: ${result.error}`);
}

/**
 * What the seed format can't express for the 100-Participant XII demo
 * (`seeds/demo/xii-scale.json`), written through the app's own mutations:
 * the Hosts (its @jahnelgroup.com Participants), the 64-Entrant Bracket
 * generated with Round 1 partly recorded, Participation ticks and the
 * Head-to-head and Best score Games. Each part is skipped when it is
 * already there, so a reload with the fixture changes no row count.
 */
export async function applyScaleFixture(dbOrTx: DBOrTx = db) {
  const [ww] = await dbOrTx
    .select({ id: warWeek.id })
    .from(warWeek)
    .where(eq(warWeek.edition, "xii"));
  if (!ww) throw new Error("War Week XII isn't loaded");

  const competitions = new Map(
    (
      await dbOrTx
        .select({ id: competition.id, name: competition.name })
        .from(competition)
        .where(eq(competition.warWeekId, ww.id))
    ).map((c) => [c.name, c.id]),
  );
  const idOf = (name: string) => {
    const id = competitions.get(name);
    if (!id) throw new Error(`War Week XII has no Competition "${name}"`);
    return id;
  };
  const people = await dbOrTx
    .select({ id: participant.id, email: participant.email })
    .from(participant)
    .where(eq(participant.warWeekId, ww.id))
    .orderBy(asc(participant.displayName));
  const hosts = (
    await dbOrTx
      .select({ email: participant.email })
      .from(participant)
      .where(
        and(
          eq(participant.warWeekId, ww.id),
          like(participant.email, "%@jahnelgroup.com"),
        ),
      )
      .orderBy(asc(participant.email))
  ).map((h) => h.email as string);
  if (hosts.length === 0) throw new Error("War Week XII has no JG Hosts");

  const ctxFor = (index: number): MutationContext => ({
    warWeekId: ww.id,
    actorEmail: hosts[index % hosts.length],
  });

  const hosted = [BRACKET, PARTICIPATION, HEAD_TO_HEAD, BEST_SCORE];
  for (const [i, name] of hosted.entries()) {
    const id = idOf(name);
    const [{ n }] = await dbOrTx
      .select({ n: count() })
      .from(competitionHost)
      .where(eq(competitionHost.competitionId, id));
    if (n === 0) {
      check(
        await setCompetitionHosts(
          id,
          [hosts[i % hosts.length]],
          ctxFor(i),
          dbOrTx,
        ),
        `Hosts of ${name}`,
      );
    }
  }

  await buildBracket(dbOrTx, idOf(BRACKET), people, ctxFor(0));
  await tickParticipation(dbOrTx, idOf(PARTICIPATION), people, ctxFor(1));
  await logGames(dbOrTx, idOf(HEAD_TO_HEAD), people, ctxFor(2), "head-to-head");
  await logGames(dbOrTx, idOf(BEST_SCORE), people, ctxFor(3), "best-score");
}

type Person = { id: string };

async function buildBracket(
  dbOrTx: DBOrTx,
  competitionId: string,
  people: Person[],
  ctx: MutationContext,
) {
  const [{ n }] = await dbOrTx
    .select({ n: count() })
    .from(entrant)
    .where(eq(entrant.competitionId, competitionId));
  if (n > 0) return;
  // A stride-37 shuffle (37 shares no factor with 100, so each key is
  // distinct), so the Entrants are spread over the roster, not just A to M.
  const order = people
    .map((p, i) => ({ p, key: (i * 37) % people.length }))
    .sort((a, b) => a.key - b.key)
    .slice(0, BRACKET_ENTRANTS)
    .map(({ p }) => p.id);
  check(
    await replaceEntrants(
      competitionId,
      { targetIds: order, format: "bracket" },
      ctx,
      dbOrTx,
    ),
    "Bracket Entrants",
  );
  check(
    await generateBracket(competitionId, { rng: seededRng(106) }, ctx, dbOrTx),
    "Generate",
  );
  const roundOne = await dbOrTx
    .select({ id: heat.id, position: heat.position })
    .from(heat)
    .where(and(eq(heat.competitionId, competitionId), eq(heat.round, 1)))
    .orderBy(asc(heat.position));
  for (const h of roundOne.slice(0, RECORDED_ROUND_ONE)) {
    const slots = await dbOrTx
      .select({ entrantId: heatEntrant.entrantId, slot: heatEntrant.slot })
      .from(heatEntrant)
      .where(eq(heatEntrant.heatId, h.id))
      .orderBy(asc(heatEntrant.slot));
    const ids = slots.map((s) => s.entrantId);
    // The upset every fourth Heat: slot 1 wins.
    const order = h.position % 4 === 0 ? [...ids].reverse() : ids;
    check(
      await recordHeatResult(
        competitionId,
        h.id,
        {
          order,
          scores: {
            [order[0]]: "21",
            [order[1]]: String(10 + (h.position % 10)),
          },
        },
        ctx,
        dbOrTx,
      ),
      `Round 1 Match ${h.position}`,
    );
  }
}

async function tickParticipation(
  dbOrTx: DBOrTx,
  competitionId: string,
  people: Person[],
  ctx: MutationContext,
) {
  const [{ n }] = await dbOrTx
    .select({ n: count() })
    .from(participation)
    .where(eq(participation.competitionId, competitionId));
  if (n > 0) return;
  for (const p of people.filter((_, i) => i % 25 < 18)) {
    check(await markParticipant(competitionId, p.id, ctx, dbOrTx), "Tick");
  }
}

async function logGames(
  dbOrTx: DBOrTx,
  competitionId: string,
  people: Person[],
  ctx: MutationContext,
  format: "head-to-head" | "best-score",
) {
  const [{ n }] = await dbOrTx
    .select({ n: count() })
    .from(game)
    .where(eq(game.competitionId, competitionId));
  if (n > 0) return;
  const total =
    format === "head-to-head" ? HEAD_TO_HEAD_GAMES : BEST_SCORE_GAMES;
  for (let g = 0; g < total; g++) {
    const pick = (k: number) => people[(g * 7 + k * 31) % people.length].id;
    const players =
      format === "head-to-head"
        ? [
            { id: pick(0), place: 1, score: null },
            { id: pick(1), place: 2, score: null },
          ]
        : [{ id: pick(0), place: null, score: 20 + ((g * 13) % 160) }];
    check(
      await logGame(competitionId, { players }, ctx, dbOrTx),
      `${format} result ${g + 1}`,
    );
  }
}
