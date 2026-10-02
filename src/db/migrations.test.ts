import { sql } from "drizzle-orm";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { isLocalDatabaseUrl } from "@/db/local-url";
import { inRolledBackTransaction } from "@/db/test-transaction";

const isLocalDatabase = isLocalDatabaseUrl(
  process.env.DATABASE_URL,
  process.env.DATABASE_DRIVER,
);

const DRIZZLE_DIR = path.resolve(__dirname, "../../drizzle");

/** A committed migration's statements, found by its fixed tag. */
function statementsOf(tag: string): string[] {
  const file = readdirSync(DRIZZLE_DIR).find((f) => f.endsWith(`_${tag}.sql`));
  if (!file) throw new Error(`No migration tagged ${tag}`);
  return readFileSync(path.join(DRIZZLE_DIR, file), "utf-8")
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean);
}

const paragraph = {
  type: "paragraph",
  content: [{ type: "text", text: "Kickoff at nine." }],
};

describe.skipIf(!isLocalDatabase)(
  "moving Announcement videos into the body",
  () => {
    it("appends each video link as a video node, in order, then drops the column", async () => {
      await inRolledBackTransaction(async (tx) => {
        await tx.execute(sql`create schema r11_migration_test`);
        await tx.execute(sql`set local search_path to r11_migration_test`);
        await tx.execute(sql`
        create table announcement (
          id uuid primary key,
          body jsonb not null,
          video_urls varchar(500)[] not null default '{}'
        )`);
        const withLinks = "00000000-0000-0000-0000-000000000001";
        const withoutLinks = "00000000-0000-0000-0000-000000000002";
        const body = JSON.stringify({ type: "doc", content: [paragraph] });
        await tx.execute(sql`
        insert into announcement (id, body, video_urls) values
          (${withLinks}, ${body}::jsonb,
            array['https://www.youtube.com/watch?v=aaa','https://vimeo.com/123']),
          (${withoutLinks}, ${body}::jsonb, '{}')`);

        for (const tag of [
          "announcement-videos-into-body",
          "drop-announcement-video-urls",
        ]) {
          for (const statement of statementsOf(tag)) {
            await tx.execute(sql.raw(statement));
          }
        }

        const rows = (await tx.execute(sql`select id, body from announcement`))
          .rows as { id: string; body: unknown }[];
        const bodyOf = (id: string) => rows.find((r) => r.id === id)?.body;
        expect(bodyOf(withLinks)).toEqual({
          type: "doc",
          content: [
            paragraph,
            {
              type: "video",
              attrs: { src: "https://www.youtube.com/watch?v=aaa" },
            },
            { type: "video", attrs: { src: "https://vimeo.com/123" } },
          ],
        });
        expect(bodyOf(withoutLinks)).toEqual({
          type: "doc",
          content: [paragraph],
        });

        const columns = (
          await tx.execute(sql`
          select column_name from information_schema.columns
          where table_schema = 'r11_migration_test'
            and table_name = 'announcement'`)
        ).rows.map((r) => (r as { column_name: string }).column_name);
        expect(columns).not.toContain("video_urls");
      });
    });
  },
);
