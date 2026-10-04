import { BASE_URL, fail, ok, signedInFetch } from "./harness";

/**
 * /history and /history/awards list Award names; a name's page is 200 with
 * every War Week that has it, newest first (Billable Hours Champ: viii, v
 * and iv together); an old numeric/uuid Category id and an unknown slug 404.
 */
export async function assertAwardHistoryRoute() {
  const check =
    "GET /history/awards lists Award names, /history/awards/billable-hours-champ is 200 with viii, v and iv newest first, and an old Category id or an unknown slug is 404";
  try {
    const history = await (await signedInFetch(`${BASE_URL}/history`)).text();
    const index = await signedInFetch(`${BASE_URL}/history/awards`);
    const indexBody = await index.text();
    const res = await signedInFetch(
      `${BASE_URL}/history/awards/billable-hours-champ`,
    );
    const body = await res.text();
    const viii = body.indexOf('href="/viii"');
    const v = body.indexOf('href="/v"');
    const iv = body.indexOf('href="/iv"');
    const oldCategoryId = await signedInFetch(
      `${BASE_URL}/history/awards/00000000-0000-4000-8000-000000000000`,
    );
    const unknown = await signedInFetch(
      `${BASE_URL}/history/awards/no-such-award-name`,
    );
    const checks = {
      listedOnHistory:
        history.includes("Awards through the years") &&
        history.includes('href="/history/awards/billable-hours-champ"'),
      listedOnIndex:
        indexBody.includes('href="/history/awards/billable-hours-champ"') &&
        indexBody.includes('href="/history/awards/chess-tournament-champion"'),
      grouped: viii >= 0 && v > viii && iv > v,
      recipients: body.includes("Akshay Palekar"),
    };
    if (
      index.status === 200 &&
      res.status === 200 &&
      oldCategoryId.status === 404 &&
      unknown.status === 404 &&
      Object.values(checks).every(Boolean)
    ) {
      ok(check);
    } else {
      fail(
        check,
        `index=${index.status} page=${res.status} oldCategoryId=${oldCategoryId.status} unknown=${unknown.status} ${JSON.stringify(checks)}`,
      );
    }
  } catch (error) {
    fail(check, String(error));
  }
}
