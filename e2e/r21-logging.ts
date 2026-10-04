import type { Page, TestInfo } from "@playwright/test";

import { runQuery, xiParticipantId } from "./db";
import { E2E_HOST_EMAIL } from "./session";

/**
 * What the R21 logging specs share (Epic R21, deliverable D4): their own
 * XI Competitions, made by SQL and deleted in `finally`, a Host row for
 * the e2e Host, and screenshots of a final state at both viewports.
 */

const VIEWPORTS = [
  { name: "1440", width: 1440, height: 900 },
  { name: "390", width: 390, height: 844 },
] as const;

/** Screenshots `page` at 1440×900 and 390×844 as `<step>-<width>.png`. */
export async function shoot(page: Page, testInfo: TestInfo, step: string) {
  for (const { name, width, height } of VIEWPORTS) {
    await page.setViewportSize({ width, height });
    await page.screenshot({
      path: testInfo.outputPath(`${step}-${name}.png`),
      fullPage: true,
      animations: "disabled",
    });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
}

/** The columns a spec sets on its own Competition. */
export type CompetitionColumns = {
  format: "placement" | "bracket" | "head-to-head" | "best-score";
  scoring?: "individual" | "team";
  scoreDirection?: "none" | "higher" | "lower";
  scoreUnit?: string | null;
  seriesConfig?: { drawsAllowed: boolean; bestOf: 1 | 3 | 5 | 7 } | null;
  bracketConfig?: Record<string, unknown> | null;
  selfReport?: boolean;
  maxAttempts?: number | null;
  placementPoints?: number[];
};

/** Adds an XI Competition by SQL, hosted by the e2e Host. Returns its id. */
export async function addXiCompetition(
  name: string,
  columns: CompetitionColumns,
): Promise<string> {
  const [{ id }] = await runQuery<{ id: string }>(
    `insert into competition
       (war_week_id, name, scoring, format, score_direction, score_unit,
        series_config, bracket_config, self_report, max_attempts,
        placement_points)
     select id, $1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10
     from war_week where edition = 'xi'
     returning id`,
    [
      name,
      columns.scoring ?? "individual",
      columns.format,
      columns.scoreDirection ??
        (columns.format === "best-score" ? "higher" : "none"),
      columns.scoreUnit ?? null,
      columns.seriesConfig === undefined
        ? columns.format === "head-to-head"
          ? JSON.stringify({ drawsAllowed: false, bestOf: 3 })
          : null
        : JSON.stringify(columns.seriesConfig),
      columns.bracketConfig ? JSON.stringify(columns.bracketConfig) : null,
      columns.selfReport ?? false,
      columns.maxAttempts ?? null,
      columns.placementPoints ?? [5, 2, 1],
    ],
  );
  await runQuery(
    `insert into competition_host (competition_id, email) values ($1, $2)`,
    [id, E2E_HOST_EMAIL],
  );
  return id;
}

/** Enters XI Participants, by name, as the Competition's Entrants in order. */
export async function addEntrants(id: string, names: string[]) {
  for (const [i, name] of names.entries()) {
    await runQuery(
      `insert into entrant (competition_id, participant_id, seed_position)
       values ($1, $2, $3)`,
      [id, await xiParticipantId(name), i + 1],
    );
  }
}

/** Turns "Participants can log their own results" on or off, as a Host would. */
export async function setSelfReport(id: string, on: boolean) {
  await runQuery(`update competition set self_report = $2 where id = $1`, [
    id,
    on,
  ]);
}

/** Deletes the spec's own XI Competitions (and their generated entries). */
export async function deleteCompetitions(...names: string[]) {
  await runQuery(
    `delete from competition c using war_week w
     where c.war_week_id = w.id and w.edition = 'xi' and c.name = any($1)`,
    [names],
  );
}

/** A Participant's Attempts on a Competition, oldest first. */
export async function attemptsOf(id: string, name: string) {
  return runQuery<{ id: string; score: number }>(
    `select a.id, a.score::float as score from attempt a
     where a.competition_id = $1 and a.participant_id = $2
     order by a.recorded_at, a.created_at`,
    [id, await xiParticipantId(name)],
  );
}
