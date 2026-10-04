import { localSeedFiles, scaleSeedFiles } from "@/seed/local-files";

import {
  BASE_URL,
  fail,
  ok,
  runCheck,
  runQuery,
  runStep,
  signedInFetch,
} from "./harness";

// Literals from seeds/demo/xii-scale.json and src/seed/scale.ts, not
// imported: that module opens the app's database client on import.
const BRACKET = "Ping Pong Bracket";
const BRACKET_ENTRANTS = 64;

/** Each public table's row count. */
async function rowCounts(): Promise<Record<string, number>> {
  const tables = await runQuery<{ tablename: string }>(
    "select tablename from pg_tables where schemaname = 'public' order by tablename",
  );
  const counts: Record<string, number> = {};
  for (const { tablename } of tables) {
    const [row] = await runQuery<{ n: number }>(
      `select count(*)::int as n from "${tablename}"`,
    );
    counts[tablename] = row.n;
  }
  return counts;
}

/** Loads the `seed:demo:scale` set (with `--reset` or not) and its fixture. */
function loadScale(reset: boolean, attempt: number): boolean {
  const flags = reset ? ["--reset"] : [];
  return (
    runStep(
      "pnpm",
      ["seed:load", ...flags, ...scaleSeedFiles()],
      `pnpm ${["seed:load", ...flags].join(" ")} with the XII scale demo (load ${attempt})`,
    ) &&
    runStep(
      "pnpm",
      ["exec", "tsx", "scripts/seed-scale.ts"],
      `the XII scale fixture (load ${attempt})`,
    )
  );
}

/**
 * The last phase (ticket 106): loads every committed seed plus the
 * 100-Participant XII demo with `--reset`, then again without, checks no
 * row count changed and that XII has 100 Participants and a 64-Entrant
 * Bracket, requests its main pages, then puts `localSeedFiles()` back with
 * `--reset` so later runs see the usual state.
 */
export async function assertScaleSeed() {
  try {
    if (!loadScale(true, 1)) return;
    const first = await rowCounts();
    if (!loadScale(false, 2)) return;
    const second = await rowCounts();

    await runCheck(
      "the XII scale demo loads twice with no row count changing",
      async () => {
        const changed = Object.keys({ ...first, ...second }).filter(
          (table) => first[table] !== second[table],
        );
        return changed.length === 0
          ? null
          : changed.map((t) => `${t} ${first[t]} -> ${second[t]}`).join(", ");
      },
    );
    await runCheck(
      `the XII scale demo has 100 Participants and ${BRACKET_ENTRANTS} Entrants in ${BRACKET}`,
      async () => {
        const [row] = await runQuery<{
          participants: number;
          entrants: number;
        }>(
          `select
             (select count(*)::int from participant p join war_week w
               on w.id = p.war_week_id where w.edition = 'xii') as participants,
             (select count(*)::int from entrant e
               join competition c on c.id = e.competition_id
               join war_week w on w.id = c.war_week_id
               where w.edition = 'xii' and c.name = $1) as entrants`,
          [BRACKET],
        );
        return row.participants === 100 && row.entrants === BRACKET_ENTRANTS
          ? null
          : `participants=${row.participants} entrants=${row.entrants}`;
      },
    );

    const [bracket] = await runQuery<{ id: string }>(
      `select c.id from competition c join war_week w on w.id = c.war_week_id
       where w.edition = 'xii' and c.name = $1`,
      [BRACKET],
    );
    for (const path of [
      "/xii",
      "/xii/leaderboard",
      "/xii/competitions",
      `/xii/competitions/${bracket?.id}`,
    ]) {
      await runCheck(`the XII scale demo's ${path} answers 200`, async () => {
        const res = await signedInFetch(`${BASE_URL}${path}`);
        return res.status === 200 ? null : `status ${res.status}`;
      });
    }
  } catch (error) {
    fail("the XII scale demo phase", String(error));
  } finally {
    const files = localSeedFiles();
    if (
      runStep(
        "pnpm",
        ["seed:load", "--reset", ...files],
        `pnpm seed:load --reset (${files.length} seeds) puts the usual state back`,
      )
    ) {
      ok("the XII scale demo phase restored localSeedFiles()");
    }
  }
}
