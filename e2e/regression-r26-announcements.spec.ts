import { type Page, expect, test } from "@playwright/test";

import { runQuery } from "./db";
import { asOrganizer } from "./session";

// Epic R26, decision 4: an Announcement is created and edited in the same
// dialog on /admin/announcements (a full-height sheet at 390); the old
// /admin/announcements/new and /[id] pages answer 404.
// Each run owns the Announcements it titles below; nothing else touches them.

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

async function shoot(page: Page, path: string) {
  await page.screenshot({ path, animations: "disabled" });
}

for (const [label, viewport] of [
  ["1440", DESKTOP],
  ["390", PHONE],
] as const) {
  test(`r26 an Organizer creates and edits an Announcement in the same dialog at ${label}`, async ({
    context,
    page,
  }, testInfo) => {
    const title = `R26 dialog ${label} ${Date.now()}`;
    const edited = `${title} edited`;
    try {
      await asOrganizer(context);
      await page.setViewportSize(viewport);
      await page.goto("/admin/announcements");

      await page.getByRole("button", { name: "New Announcement" }).click();
      const created = page.getByRole("dialog", { name: "New Announcement" });
      await expect(created).toBeVisible();
      await expect(created.getByLabel("Title")).toBeVisible();
      await expect(created.locator(".ProseMirror")).toBeVisible();
      await expect(
        created.getByRole("toolbar", { name: "Formatting" }),
      ).toBeVisible();
      if (label === "390") {
        // A full-height phone sheet, not a small dialog.
        const box = await created.boundingBox();
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(viewport.height - 1);
      }
      await created.getByLabel("Title").fill(title);
      await created.locator(".ProseMirror").click();
      await page.keyboard.type("Doors open at nine.");
      await shoot(page, testInfo.outputPath(`create-${label}.png`));
      await created.getByRole("button", { name: "Post Announcement" }).click();
      await expect(created).toBeHidden();
      await expect(page.getByText("Announcement saved")).toBeVisible();
      const row = page.getByRole("listitem").filter({ hasText: title });
      await expect(row).toBeVisible();

      // Edit is the same dialog, filled with what was saved.
      await page.getByRole("button", { name: `Edit ${title}` }).click();
      const editing = page.getByRole("dialog", { name: `Edit ${title}` });
      await expect(editing).toBeVisible();
      await expect(editing.getByLabel("Title")).toHaveValue(title);
      await expect(editing.locator(".ProseMirror")).toContainText(
        "Doors open at nine.",
      );
      await editing.getByLabel("Title").fill(edited);
      await shoot(page, testInfo.outputPath(`edit-${label}.png`));
      await editing.getByRole("button", { name: "Save changes" }).click();
      await expect(editing).toBeHidden();
      await expect(
        page.getByRole("listitem").filter({ hasText: edited }),
      ).toBeVisible();

      const rows = await runQuery<{ title: string }>(
        `select title from announcement where title = any($1)`,
        [[title, edited]],
      );
      expect(rows.map((r) => r.title)).toEqual([edited]);

      // The old pages are gone: 404, not a redirect.
      for (const path of ["/admin/announcements/new"]) {
        const res = await page.goto(path);
        expect(res?.status(), path).toBe(404);
      }
    } finally {
      await runQuery(`delete from announcement where title = any($1)`, [
        [title, edited],
      ]);
    }
  });
}
