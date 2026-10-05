import { type BrowserContext, expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

import { runQuery } from "./db";
import { E2E_BASE_URL } from "./env";
import {
  addEntrants,
  addXiCompetition,
  deleteCompetitions,
  setSelfReport,
  shoot,
} from "./r21-logging";
import {
  addLeagueMatches,
  matchLines,
  matchRow,
  matchRows,
  recordMatch,
  storedMatch,
} from "./r23-league";
import { participantPageAs } from "./session";

// Epic R23, AC 4 (.scratch/league/spec.md, decision 8): with self-report
// on, a player records their own Match from the Participant page, the
// other player edits it, and a non-player sees no Record result and a
// direct server-action call by them is refused ("You're not a player in
// this Match.", NOT_A_PLAYER); with it off, a player and a non-player are
// both refused ("Self-report is off for this Competition.",
// SELF_REPORT_OFF). The League is this spec's own, made by SQL, deleted in
// `finally`.

const ASHLEY = "Ashley Schuliger";
const SAM = "Sam Schantz";
const GRAHAM = "Graham Macbeth";
const BRANDON = "Brandon Badgett";
const NOT_A_PLAYER = "You're not a player in this Match.";
const SELF_REPORT_OFF = "Self-report is off for this Competition.";

/** The build's id for a server action, by its exported name. */
function actionId(exportedName: string): string {
  const manifest = JSON.parse(
    readFileSync(
      path.resolve(
        process.cwd(),
        ".next/server/server-reference-manifest.json",
      ),
      "utf-8",
    ),
  ) as { node: Record<string, { exportedName?: string }> };
  const found = Object.entries(manifest.node).find(
    ([, action]) => action.exportedName === exportedName,
  );
  if (!found) throw new Error(`No server action named ${exportedName}`);
  return found[0];
}

/**
 * Calls `recordLeagueResult` the way the browser does, as the context's
 * signed-in person, and returns the action's `{ ok, error }` reply.
 */
async function callRecord(
  context: BrowserContext,
  competitionId: string,
  matchId: string,
  result: "a" | "b" | "draw",
): Promise<{ ok: boolean; error?: string }> {
  const res = await context.request.post(
    `${E2E_BASE_URL}/xi/competitions/${competitionId}`,
    {
      headers: {
        "next-action": actionId("recordLeagueResult"),
        "content-type": "text/plain;charset=UTF-8",
        accept: "text/x-component",
        origin: E2E_BASE_URL,
      },
      data: JSON.stringify([
        competitionId,
        matchId,
        { result, scoreA: "", scoreB: "" },
      ]),
    },
  );
  const body = await res.text();
  const line = body.split("\n").find((l) => /^\d+:\{"ok":/.test(l));
  if (res.status() !== 200 || !line) {
    throw new Error(`status=${res.status()} body=${body.slice(0, 300)}`);
  }
  return JSON.parse(line.slice(line.indexOf(":") + 1));
}

test("r23 AC4 a League's players record and edit their own Match with self-report on, a non-player and every player are refused, and with it off all are refused", async ({
  browser,
}, testInfo) => {
  test.setTimeout(240_000);
  const name = `E2E R23 Self-report ${Date.now()}`;
  const id = await addXiCompetition(name, {
    format: "league",
    selfReport: true,
  });
  await addEntrants(id, [ASHLEY, SAM, GRAHAM, BRANDON]);
  await addLeagueMatches(id, [
    { round: 1, position: 0, a: ASHLEY, b: SAM },
    { round: 1, position: 1, a: GRAHAM, b: BRANDON },
  ]);
  const [{ match }] = await runQuery<{ match: string }>(
    `select m.id as match from league_match m
     join entrant e on e.id = m.entrant_a_id
     join participant p on p.id = e.participant_id
     where m.competition_id = $1 and p.display_name = $2`,
    [id, ASHLEY],
  );
  const opened: Awaited<ReturnType<typeof participantPageAs>>[] = [];
  try {
    const open = async (displayName: string) => {
      const session = await participantPageAs(browser, displayName);
      opened.push(session);
      return session;
    };
    const ashley = await open(ASHLEY);
    const sam = await open(SAM);
    const graham = await open(GRAHAM);
    // A player records their own Match.
    const mine = ashley.page;
    await mine.goto(`/xi/competitions/${id}`);
    await expect(matchRows(mine, 1)).toHaveCount(2);
    await expect(
      matchRow(mine, 1, `${ASHLEY} v ${SAM}`).getByRole("button", {
        name: "Record result",
      }),
    ).toBeVisible();
    await shoot(mine, testInfo, "player-before");
    await recordMatch(mine, 1, `${ASHLEY} v ${SAM}`, `${ASHLEY} won`);
    await expect
      .poll(() => matchLines(mine, 1))
      .toEqual([`${ASHLEY} 1–0 ${SAM}`, `${GRAHAM} v ${BRANDON}`]);
    expect(await storedMatch(id, ASHLEY)).toEqual({
      result: "a",
      recorded_by: ASHLEY,
    });
    await shoot(mine, testInfo, "player-recorded");

    // The other player edits it.
    const other = sam.page;
    await other.goto(`/xi/competitions/${id}`);
    await recordMatch(
      other,
      1,
      `${ASHLEY} 1–0 ${SAM}`,
      "Draw",
      "Result updated",
    );
    await expect
      .poll(() => matchLines(other, 1))
      .toEqual([`${ASHLEY} ½–½ ${SAM}`, `${GRAHAM} v ${BRANDON}`]);
    expect(await storedMatch(id, ASHLEY)).toEqual({
      result: "draw",
      recorded_by: SAM,
    });

    // A non-player (Graham plays the other Match) has no button on this one.
    const outsider = graham.page;
    await outsider.goto(`/xi/competitions/${id}`);
    await expect(matchRows(outsider, 1)).toHaveCount(2);
    await expect(
      matchRow(outsider, 1, `${ASHLEY} ½–½ ${SAM}`).getByRole("button"),
    ).toHaveCount(0);
    await expect(
      matchRow(outsider, 1, `${GRAHAM} v ${BRANDON}`).getByRole("button", {
        name: "Record result",
      }),
    ).toBeVisible();
    await shoot(outsider, testInfo, "non-player");
    // A direct call is refused and writes nothing.
    expect(await callRecord(graham.context, id, match, "b")).toMatchObject({
      ok: false,
      error: NOT_A_PLAYER,
    });
    expect((await storedMatch(id, ASHLEY)).result).toBe("draw");

    // Self-report off: the player and the non-player are both refused.
    await setSelfReport(id, false);
    for (const who of [ashley, graham]) {
      expect(await callRecord(who.context, id, match, "b")).toMatchObject({
        ok: false,
        error: SELF_REPORT_OFF,
      });
    }
    expect((await storedMatch(id, ASHLEY)).result).toBe("draw");
    await mine.goto(`/xi/competitions/${id}`);
    await expect(matchRows(mine, 1)).toHaveCount(2);
    await expect(
      mine.getByRole("button", { name: /Record result|Edit/ }),
    ).toHaveCount(0);
    await shoot(mine, testInfo, "self-report-off");
  } finally {
    for (const session of opened.reverse()) await session.close();
    await deleteCompetitions(name);
  }
});
