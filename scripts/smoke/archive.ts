import { backgroundColorScheme } from "@/lib/theme";

import { BASE_URL, fail, ok, runQuery, signedInFetch } from "./harness";

export async function assertHistory() {
  const check =
    "GET /history lists every complete War Week, newest first, each in its own theme";
  try {
    const res = await signedInFetch(`${BASE_URL}/history`);
    const body = await res.text();
    const complete = await runQuery<{
      edition: string;
      primary: string;
      background: string;
    }>(
      `select edition, primary_color as primary, background_color as background
         from war_week
         where status = 'complete' order by year desc`,
    );
    const positions = complete.map((w) => body.indexOf(`href="/${w.edition}"`));
    const checks = {
      allListed: positions.every((p) => p >= 0),
      newestFirst: positions.every((p, i) => i === 0 || p > positions[i - 1]),
      // Each base primary under its own scheme's prefix.
      ownThemes: complete.every((w) =>
        body.includes(
          `--${backgroundColorScheme(w.background)}-primary:${w.primary}`,
        ),
      ),
      excludesLive: !body.includes("The Matrix"),
    };
    if (
      res.status === 200 &&
      complete.length === 10 &&
      Object.values(checks).every(Boolean)
    ) {
      ok(check);
    } else {
      fail(
        check,
        `status=${res.status} complete=${complete.length} ${JSON.stringify(checks)}`,
      );
    }
  } catch (error) {
    fail(check, String(error));
  }
}

export async function assertArchiveDetail() {
  const check =
    "GET /viii renders 2023 in its Harry Potter theme with stored winner, Houses, Awards, highlights and wiki link";
  try {
    const res = await signedInFetch(`${BASE_URL}/viii`);
    const body = await res.text();
    const [viii] = await runQuery<{ background: string }>(
      "select background_color as background from war_week where edition = 'viii'",
    );
    const checks = {
      theme: body.includes(
        `--${backgroundColorScheme(viii.background)}-primary:#740001`,
      ),
      storyTheme: body.includes("Harry Potter: The Houses of Hogwarts"),
      winner: body.includes("Winner") && body.includes("Slytherin"),
      houses: ["Gryffindor", "Hufflepuff", "Ravenclaw"].every((h) =>
        body.includes(h),
      ),
      awards: body.includes("House Cup"),
      highlights: body.includes("Highlights"),
      wiki: body.includes(
        'href="https://sites.google.com/jahnelgroup.com/jahnel-group-wiki/war-week-2023"',
      ),
      noSlack: !body.includes("Join the Slack channel"),
    };
    if (res.status === 200 && Object.values(checks).every(Boolean)) {
      ok(check);
    } else {
      fail(check, `status=${res.status} ${JSON.stringify(checks)}`);
    }
  } catch (error) {
    fail(check, String(error));
  }

  const linkOnlyCheck =
    "GET /i, /ii, /iii render as link-only cards with the wiki link";
  try {
    const results = await Promise.all(
      [
        ["i", 2016],
        ["ii", 2017],
        ["iii", 2018],
      ].map(async ([edition, year]) => {
        const res = await signedInFetch(`${BASE_URL}/${edition}`);
        const body = await res.text();
        return {
          edition,
          status: res.status,
          linkOnly: body.includes("lives on") && !body.includes("Awards</h2>"),
          wiki: body.includes(
            `href="https://sites.google.com/jahnelgroup.com/jahnel-group-wiki/war-week-${year}"`,
          ),
        };
      }),
    );
    if (results.every((r) => r.status === 200 && r.linkOnly && r.wiki)) {
      ok(linkOnlyCheck);
    } else {
      fail(linkOnlyCheck, JSON.stringify(results));
    }
  } catch (error) {
    fail(linkOnlyCheck, String(error));
  }
}
