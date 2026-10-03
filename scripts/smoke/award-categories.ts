import { readFileSync } from "node:fs";
import path from "node:path";

import { SEEDED_AWARD_CATEGORIES } from "@/lib/award-categories";
import { localSeedFiles } from "@/seed/local-files";

import { BASE_URL, fail, ok, runQuery, signedInFetch } from "./harness";

/**
 * Right after the seed load (twice): the seven seeded Categories exist, the
 * demo XI "Black Midnight" Award is tagged, and the tagged seeded Awards are
 * exactly the seed files' tagged Awards, so loading twice changed nothing.
 */
export async function assertAwardCategoriesSeeded() {
  const keysCheck = "the seven seeded Award Category keys exist";
  const tagCheck =
    "after loading the seeds twice, the demo XI Black Midnight Award is tagged and seeded Awards carry exactly the seeds' Categories";
  try {
    const rows = await runQuery<{ key: string }>(
      "select key from award_category where key is not null order by key",
    );
    const expectedKeys = SEEDED_AWARD_CATEGORIES.map((c) => c.key).sort();
    if (
      JSON.stringify(rows.map((r) => r.key)) === JSON.stringify(expectedKeys)
    ) {
      ok(keysCheck);
    } else {
      fail(keysCheck, `keys=${JSON.stringify(rows.map((r) => r.key))}`);
    }

    const tagged = localSeedFiles().flatMap((file) => {
      const seed = JSON.parse(
        readFileSync(path.resolve(process.cwd(), file), "utf-8"),
      ) as { edition: string; awards?: { key: string; category?: string }[] };
      return (seed.awards ?? []).flatMap((a) =>
        a.category ? [`${seed.edition}/${a.key}=${a.category}`] : [],
      );
    });
    const stored = await runQuery<{ tag: string }>(
      `select w.edition || '/' || a.seed_key || '=' || c.key as tag
         from award a
         join war_week w on w.id = a.war_week_id
         join award_category c on c.id = a.category_id
         where a.seed_key is not null order by 1`,
    );
    const [midnight] = await runQuery<{ key: string | null }>(
      `select c.key from award a
         join war_week w on w.id = a.war_week_id
         left join award_category c on c.id = a.category_id
         where w.edition = 'xi' and a.name = 'Black Midnight'`,
    );
    if (
      midnight?.key === "black-midnight" &&
      // Sorted here: the database's collation orders text differently.
      JSON.stringify(stored.map((r) => r.tag).sort()) ===
        JSON.stringify([...tagged].sort())
    ) {
      ok(tagCheck);
    } else {
      fail(
        tagCheck,
        `midnight=${midnight?.key} stored=${stored.length} seeds=${tagged.length}`,
      );
    }
  } catch (error) {
    fail(keysCheck, String(error));
  }
}

/** /xi/awards groups the tagged demo Award under its Category's through-the-years link. */
export async function assertAwardsPageGrouped() {
  const check =
    "GET /xi/awards groups Black Midnight under its Category heading, linked to /history/awards/<id>, with the rest under Other Awards";
  try {
    const [category] = await runQuery<{ id: string }>(
      "select id from award_category where key = 'black-midnight'",
    );
    const res = await signedInFetch(`${BASE_URL}/xi/awards`);
    const body = await res.text();
    const linked = body.includes(`href="/history/awards/${category?.id}"`);
    const other = body.includes("Other Awards");
    if (res.status === 200 && linked && other) {
      ok(check);
    } else {
      fail(check, `status=${res.status} linked=${linked} other=${other}`);
    }
  } catch (error) {
    fail(check, String(error));
  }
}
