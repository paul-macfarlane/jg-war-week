import { BASE_URL, fail, ok, runQuery, signedInFetch } from "./harness";

/**
 * /history lists "Awards through the years"; a seeded Category's page is 200
 * with its recipients newest War Week first; an unknown or malformed id is 404.
 */
export async function assertAwardHistoryRoute() {
  const check =
    "GET /history/awards/<War Week MVP> is 200 newest first and linked from /history; an unknown or malformed id is 404";
  try {
    const [category] = await runQuery<{ id: string }>(
      "select id from award_category where key = 'war-week-mvp'",
    );
    const history = await (await signedInFetch(`${BASE_URL}/history`)).text();
    const res = await signedInFetch(
      `${BASE_URL}/history/awards/${category?.id}`,
    );
    const body = await res.text();
    const v = body.indexOf('href="/v"');
    const iv = body.indexOf('href="/iv"');
    const unknown = await signedInFetch(
      `${BASE_URL}/history/awards/00000000-0000-4000-8000-000000000000`,
    );
    const malformed = await signedInFetch(`${BASE_URL}/history/awards/nope`);
    const checks = {
      listed:
        history.includes("Awards through the years") &&
        history.includes(`href="/history/awards/${category?.id}"`),
      newestFirst: v >= 0 && iv > v,
      recipients:
        body.includes("Ian Ballard") && body.includes("Anthony Conway"),
    };
    if (
      res.status === 200 &&
      unknown.status === 404 &&
      malformed.status === 404 &&
      Object.values(checks).every(Boolean)
    ) {
      ok(check);
    } else {
      fail(
        check,
        `status=${res.status} unknown=${unknown.status} malformed=${malformed.status} ${JSON.stringify(checks)}`,
      );
    }
  } catch (error) {
    fail(check, String(error));
  }
}
