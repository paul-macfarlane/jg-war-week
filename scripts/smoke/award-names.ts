import { BASE_URL, fail, ok, runQuery, signedInFetch } from "./harness";
import type { SmokeSession } from "./harness";

/** The seven former Award Category names, always offered as presets. */
const FORMER_CATEGORY_NAMES = [
  "War Week MVP",
  "Billable Hours Champ",
  "Black Midnight",
  "Grow",
  "Grind",
  "Serve",
  "Inspire",
];

/**
 * Right after the seed load (twice): Award Categories are gone, the aligned
 * seed names are in (Billable Hours Champ in iv, v and viii; the retired
 * spellings nowhere), and loading twice left one row per seeded Award.
 */
export async function assertAwardNamesSeeded() {
  const check =
    "after loading the seeds twice, Award Categories are gone, Billable Hours Champ is in iv, v and viii, and no retired Award spelling remains";
  try {
    const gone = await runQuery<{ n: number }>(
      `select count(*)::int as n from information_schema.tables
         where table_name = 'award_category'`,
    );
    const champs = await runQuery<{ edition: string; n: number }>(
      `select w.edition, count(*)::int as n from award a
         join war_week w on w.id = a.war_week_id
         where a.name = 'Billable Hours Champ'
         group by w.edition order by w.edition`,
    );
    const retired = await runQuery<{ name: string }>(
      `select name from award where name in ('Billing Hours Champ',
         'Chess Tourney Champion', 'Chess Tournament Winners',
         'Stairs Challenge Winners', 'Mario Kart Winner',
         'Battle of the Memes Winner')`,
    );
    const duplicates = await runQuery<{ edition: string }>(
      `select w.edition from award a join war_week w on w.id = a.war_week_id
         where a.seed_key is not null
         group by w.edition, a.seed_key having count(*) > 1`,
    );
    const editions = champs.map((c) => c.edition).sort();
    if (
      gone[0]?.n === 0 &&
      JSON.stringify(editions) === JSON.stringify(["iv", "v", "viii"]) &&
      retired.length === 0 &&
      duplicates.length === 0
    ) {
      ok(check);
    } else {
      fail(
        check,
        `categoryTable=${gone[0]?.n} champs=${JSON.stringify(editions)} retired=${JSON.stringify(retired)} duplicates=${duplicates.length}`,
      );
    }
  } catch (error) {
    fail(check, String(error));
  }
}

/**
 * The Add Award form offers presets: every past Award name and the seven
 * former Category names; the Awards admin has no Category UI.
 */
export async function assertAwardPresets(sessions: {
  organizer: SmokeSession;
}) {
  const check =
    "GET /admin/awards offers presets with a past Award name and the seven former Category names, and has no Categories section";
  try {
    const res = await fetch(`${BASE_URL}/admin/awards`, {
      headers: { cookie: sessions.organizer.cookie },
    });
    const body = await res.text();
    // The presets travel as props to the Add Award form (in the page's
    // flight data, where the quotes are escaped), whether or not it's open.
    const offers = (name: string) =>
      body.includes(`\\"name\\":\\"${name}\\"`) ||
      body.includes(`"name":"${name}"`);
    const missing = [
      ...FORMER_CATEGORY_NAMES,
      "Chess Tournament Champion",
    ].filter((name) => !offers(name));
    const noCategoryUi =
      !body.includes(">Categories<") && !body.includes("Award Categories");
    if (res.status === 200 && missing.length === 0 && noCategoryUi) {
      ok(check);
    } else {
      fail(
        check,
        `status=${res.status} missing=${JSON.stringify(missing)} noCategoryUi=${noCategoryUi}`,
      );
    }
  } catch (error) {
    fail(check, String(error));
  }
}

/** /xi/awards lists the Awards flat, each name linking to its history by slug. */
export async function assertAwardsPageLinksByName() {
  const check =
    "GET /xi/awards links an Award's name to /history/awards/<slug> with no Category headings";
  try {
    const res = await signedInFetch(`${BASE_URL}/xi/awards`);
    const body = await res.text();
    const linked = body.includes('href="/history/awards/black-midnight"');
    const headed = body.includes("Other Awards");
    if (res.status === 200 && linked && !headed) {
      ok(check);
    } else {
      fail(check, `status=${res.status} linked=${linked} headed=${headed}`);
    }
  } catch (error) {
    fail(check, String(error));
  }
}
