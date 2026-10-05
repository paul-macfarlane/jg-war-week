import { type Locator, type Page, expect } from "@playwright/test";

import { runQuery, xiParticipantId } from "./db";

/**
 * What the R23 League specs share: a round's Matches as the page's lines,
 * Matches written by SQL, and the Record result form driven as a person.
 */

/** A round's section on a League page. */
export function roundSection(page: Page, round: number): Locator {
  return page.locator(`section[aria-label="Round ${round}"]`);
}

/** Every Match row of a round, in order. */
export function matchRows(page: Page, round: number): Locator {
  return roundSection(page, round).locator('li[data-slot="league-match"]');
}

/** A round's Match lines as shown ("Ada v Bo", "Ada 1–0 Bo", "Ada has a bye"). */
export async function matchLines(page: Page, round: number): Promise<string[]> {
  const texts = await matchRows(page, round).allInnerTexts();
  return texts.map((text) => text.split("\n")[0].trim());
}

/** The Match row whose line is `line`, in a round. */
export function matchRow(page: Page, round: number, line: string): Locator {
  return matchRows(page, round).filter({
    has: page.getByText(line, { exact: true }),
  });
}

/** The Record result / Edit result form that is open. */
export function resultDialog(page: Page): Locator {
  return page.getByRole("dialog", { name: /^(Record|Edit) result$/ });
}

/**
 * Records a Match from its round: opens the form, presses the result
 * (`pick` is the toggle's text: "<A> won", "Draw" or "<B> won"), saves, and
 * waits for the toast and the form to close.
 */
export async function recordMatch(
  page: Page,
  round: number,
  line: string,
  pick: string,
  toast = "Result recorded",
) {
  await matchRow(page, round, line)
    .getByRole("button", { name: /^Record result$|^Edit/ })
    .click();
  const form = resultDialog(page);
  await expect(form).toBeVisible();
  await form
    .getByRole("group", { name: "Result" })
    .getByRole("button", { name: pick, exact: true })
    .click();
  await form.getByRole("button", { name: "Save result" }).click();
  await expect(page.getByText(toast, { exact: true })).toBeVisible();
  await expect(form).toBeHidden();
}

/** A League Match to write by SQL: names are XI Participants; `b` null is a bye / sit-out. */
export type SqlMatch = {
  round: number;
  position: number;
  a: string;
  b: string | null;
  result?: "a" | "b" | "draw";
};

/** An Entrant's id in a Competition, by the Participant's display name. */
async function entrantId(competitionId: string, name: string) {
  const [row] = await runQuery<{ id: string }>(
    `select id from entrant where competition_id = $1 and participant_id = $2`,
    [competitionId, await xiParticipantId(name)],
  );
  if (!row) throw new Error(`${name} is not an Entrant`);
  return row.id;
}

/** Inserts League Matches (the Entrants are already in). */
export async function addLeagueMatches(
  competitionId: string,
  matches: SqlMatch[],
) {
  for (const match of matches) {
    await runQuery(
      `insert into league_match
         (competition_id, round, position, entrant_a_id, entrant_b_id,
          result, recorded_at)
       values ($1, $2, $3, $4, $5, $6::league_result,
         case when $6::text is null then null else now() end)`,
      [
        competitionId,
        match.round,
        match.position,
        await entrantId(competitionId, match.a),
        match.b === null ? null : await entrantId(competitionId, match.b),
        match.result ?? null,
      ],
    );
  }
}

/** A Match's stored result and who recorded it, by the Participants' names. */
export async function storedMatch(competitionId: string, a: string) {
  const [row] = await runQuery<{
    result: string | null;
    recorded_by: string | null;
  }>(
    `select m.result::text as result, rp.display_name as recorded_by
     from league_match m
     join entrant e on e.id = m.entrant_a_id
     left join participant rp on rp.id = m.recorded_by_participant_id
     where m.competition_id = $1 and e.participant_id = $2`,
    [competitionId, await xiParticipantId(a)],
  );
  return row;
}
