/**
 * The regression checklist's page driver (`docs/regression-checklist.md`,
 * Setup). Signs a browser in as one of the checklist's accounts through
 * `e2e/session.ts` and runs the page basics (theme check, no horizontal
 * scroll, no clipped text, a full-page screenshot) on any page.
 *
 * Needs the production server the e2e flows use, on port 3200, with the e2e
 * secret (never real OAuth), and the same env in the shell that runs this:
 *   export DATABASE_URL='postgres://postgres:postgres@localhost:2345/war_weeker?sslmode=disable' DATABASE_DRIVER=pg
 *   BETTER_AUTH_SECRET=e2e-only-secret-never-used-in-production \
 *     BETTER_AUTH_URL=http://localhost:3200 GOOGLE_CLIENT_ID= GOOGLE_CLIENT_SECRET= \
 *     pnpm start -p 3200
 *
 * From the command line, one role, one width, any number of paths; prints
 * one JSON line per page:
 *   BETTER_AUTH_SECRET=e2e-only-secret-never-used-in-production \
 *     pnpm tsx scripts/regression/driver.ts <role> <width> <outRoot> <path>...
 * e.g. `organizer 390 test-results/run/checklist /admin /admin/points`
 * writes `test-results/run/checklist/admin-390/page.png` and
 * `.../admin-points-390/page.png`; `--tag=ffa` makes them `admin-ffa-390/`
 * and `admin-points-ffa-390/`, so the two passes don't overwrite each other. Roles: organizer, host, participant
 * (`e2e-participant@jahnelgroup.com`, linked once the Organizer run puts
 * that email on a Participant), unlinked, anon. From a script, import
 * `openAs` and `pageBasics` instead.
 */
import {
  type Browser,
  type BrowserContext,
  type Page,
  chromium,
} from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

import { warWeekThemeStyle } from "@/lib/theme";

import { runQuery } from "../../e2e/db";
import { E2E_BASE_URL } from "../../e2e/env";
import { asHost, asOrganizer, signIn } from "../../e2e/session";

export const ROLES = [
  "organizer",
  "host",
  "participant",
  "unlinked",
  "anon",
] as const;
export type Role = (typeof ROLES)[number];

/** The checklist's two viewports, by width. */
export const VIEWPORTS = {
  1440: { width: 1440, height: 900 },
  390: { width: 390, height: 844 },
} as const;
export type Width = keyof typeof VIEWPORTS;

/** A fresh context at `width`, signed in as `role`, and a page in it. */
export async function openAs(
  browser: Browser,
  role: Role,
  width: Width,
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    baseURL: E2E_BASE_URL,
    viewport: VIEWPORTS[width],
    ...(width === 390 ? { isMobile: true, hasTouch: true } : {}),
  });
  if (role === "organizer") await asOrganizer(context);
  else if (role === "host") await asHost(context);
  else if (role === "participant")
    await signIn(context, "e2e-participant@jahnelgroup.com");
  else if (role === "unlinked")
    await signIn(context, "e2e-unlinked@jahnelgroup.com");
  return { context, page: await context.newPage() };
}

/** `warWeekThemeStyle` for the current War Week, read from the database. */
export async function expectedTheme(): Promise<Record<string, string>> {
  const [row] = await runQuery(
    `select primary_color as "primaryColor",
       primary_foreground_color as "primaryForegroundColor",
       accent_color as "accentColor", background_color as "backgroundColor",
       foreground_color as "foregroundColor", font_preset as "fontPreset",
       override_primary_color as "overridePrimaryColor",
       override_primary_foreground_color as "overridePrimaryForegroundColor",
       override_accent_color as "overrideAccentColor",
       override_background_color as "overrideBackgroundColor",
       override_foreground_color as "overrideForegroundColor"
     from war_week
     order by case status when 'live' then 0 when 'upcoming' then 1 else 2 end,
       case when status = 'upcoming' then start_date end asc,
       start_date desc
     limit 1`,
  );
  return warWeekThemeStyle(
    row as Parameters<typeof warWeekThemeStyle>[0],
  ) as Record<string, string>;
}

export type Basics = {
  url: string;
  /** Theme variables on `[data-theme-root]` that differ from expected. */
  themeDiffs: string[];
  themeRoot: boolean;
  scrollWidth: number;
  clientWidth: number;
  /** Visible text elements past the viewport's left or right edge. */
  clipped: string[];
  screenshot: string;
};

/**
 * The checklist's page basics on the page as it stands: theme check, no
 * horizontal scroll, no clipped text, and a full-page screenshot at
 * `<dir>/<name>.png`.
 */
export async function pageBasics(
  page: Page,
  dir: string,
  name = "page",
): Promise<Basics> {
  const expected = await expectedTheme();
  const found = await page.evaluate((keys) => {
    const root = document.querySelector<HTMLElement>("[data-theme-root]");
    const vars: Record<string, string> = {};
    for (const key of keys)
      vars[key] = root?.style.getPropertyValue(key).trim() ?? "";
    const width = document.documentElement.clientWidth;
    const clipped = [
      ...document.querySelectorAll<HTMLElement>("h1,h2,h3,p,li,a,button,span"),
    ]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return (
          r.width > 0 &&
          r.height > 0 &&
          getComputedStyle(el).visibility !== "hidden" &&
          !el.closest("[aria-hidden='true'],.sr-only") &&
          (r.left < -1 || r.right > width + 1)
        );
      })
      .map((el) => `${el.tagName}: ${el.textContent?.trim().slice(0, 40)}`);
    return {
      themeRoot: !!root,
      vars,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: width,
      clipped,
    };
  }, Object.keys(expected));
  mkdirSync(dir, { recursive: true });
  const screenshot = path.join(dir, `${name}.png`);
  await page.screenshot({ path: screenshot, fullPage: true });
  return {
    url: page.url(),
    themeDiffs: Object.keys(expected).filter(
      (key) => found.vars[key] !== String(expected[key]),
    ),
    themeRoot: found.themeRoot,
    scrollWidth: found.scrollWidth,
    clientWidth: found.clientWidth,
    clipped: found.clipped,
    screenshot,
  };
}

/** `/admin/setup/war-week` → `admin-setup-war-week`; `/` → `root`. */
export function pageSlug(urlPath: string): string {
  return (
    urlPath
      .split("?")[0]
      .replace(/^\/+|\/+$/g, "")
      .replace(/[^a-z0-9]+/gi, "-") || "root"
  );
}

async function main() {
  const args = process.argv.slice(2);
  const tag = args.find((arg) => arg.startsWith("--tag="))?.slice(6);
  const [role, widthArg, outRoot, ...paths] = args.filter(
    (arg) => !arg.startsWith("--tag="),
  );
  const width = Number(widthArg) as Width;
  if (!ROLES.includes(role as Role) || !(width in VIEWPORTS) || !outRoot) {
    throw new Error(
      "usage: driver.ts <organizer|host|participant|unlinked|anon> <1440|390> <outRoot> [--tag=<pass>] <path>...",
    );
  }
  const browser = await chromium.launch();
  try {
    const { context, page } = await openAs(browser, role as Role, width);
    for (const urlPath of paths) {
      await page.goto(urlPath, { waitUntil: "networkidle" });
      const basics = await pageBasics(
        page,
        path.join(
          outRoot,
          [pageSlug(urlPath), tag, width].filter(Boolean).join("-"),
        ),
      );
      console.log(JSON.stringify(basics));
    }
    await context.close();
  } finally {
    await browser.close();
  }
}

if (process.argv[1]?.endsWith("driver.ts")) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
