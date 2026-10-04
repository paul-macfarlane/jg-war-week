import { type Page, type TestInfo, expect, test } from "@playwright/test";

import {
  addE2eHost,
  deleteXiCompetition,
  runQuery,
  xiCompetitionId,
} from "./db";
import { E2E_BASE_URL } from "./env";
import {
  E2E_HOST_EMAIL,
  E2E_PARTICIPANT_EMAIL,
  asOrganizer,
  signIn,
} from "./session";

// Epic R20 (.scratch/competition-results/spec.md), the Participant
// Competition page shell: no Point Entries section, the description above
// the results with Show more, Manage for whoever runs the Competition, and
// no Individual/Team choice in a free-for-all War Week. Seeded XI
// Competitions are read only; every Competition this spec adds is named
// `E2E R20 …` and deleted in `finally`.

const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1440, height: 900 };
const VIEWPORTS = [
  ["1440", DESKTOP],
  ["390", PHONE],
] as const;

const SEEDED = [
  "Speed Chess", // Placement
  "Bouncy Pong", // Head-to-head
  "Tuesday Stairs", // Best score
  "Daily Workout Check-in", // Participation
];
const BRACKET = "E2E R20 Bracket";
const LONG = "E2E R20 Long description";
const OTHER = "E2E R20 Other";
const FFA_INDIVIDUAL = "E2E R20 Free-for-all individual";
const FFA_TEAM = "E2E R20 Free-for-all team";

function paragraph(text: string) {
  return { type: "paragraph", content: [{ type: "text", text }] };
}

const SHORT_DOC = { type: "doc", content: [paragraph("A short description.")] };
const LONG_DOC = {
  type: "doc",
  content: Array.from({ length: 14 }, (_, i) =>
    paragraph(
      `Paragraph ${i + 1}: the rules run long enough that the page has to clamp them, so a Participant sees the results first and the rest on request.`,
    ),
  ),
};

async function addCompetition(
  edition: string,
  name: string,
  {
    format = "placement",
    scoring = "individual",
    description = null,
  }: {
    format?: string;
    scoring?: string;
    description?: unknown;
  } = {},
): Promise<string> {
  const [{ id }] = await runQuery<{ id: string }>(
    `insert into competition (war_week_id, name, scoring, format, description)
     select id, $1, $2, $3, $4::jsonb from war_week where edition = $5
     returning id`,
    [
      name,
      scoring,
      format,
      description === null ? null : JSON.stringify(description),
      edition,
    ],
  );
  return id;
}

async function deleteCompetition(edition: string, name: string) {
  await runQuery(
    `delete from competition c using war_week w
     where c.war_week_id = w.id and w.edition = $1 and c.name = $2`,
    [edition, name],
  );
}

async function shoot(page: Page, testInfo: TestInfo, name: string) {
  await page.screenshot({
    path: testInfo.outputPath(`${name}.png`),
    fullPage: true,
    animations: "disabled",
  });
}

test("r20 no Participant Competition page renders a Point Entries section", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  try {
    await addCompetition("xi", BRACKET, { format: "bracket" });
    await signIn(page.context(), E2E_PARTICIPANT_EMAIL);
    for (const [viewport, size] of VIEWPORTS) {
      await page.setViewportSize(size);
      for (const name of [...SEEDED, BRACKET]) {
        const id = await xiCompetitionId(name);
        await page.goto(`/xi/competitions/${id}`);
        await expect(
          page.getByRole("heading", { level: 1, name, exact: true }),
        ).toBeVisible();
        await expect(
          page.getByRole("heading", { name: "Points Entries" }),
        ).toHaveCount(0);
        await expect(page.getByRole("main")).not.toContainText(
          "Points Entries",
        );
        await shoot(
          page,
          testInfo,
          `${name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${viewport}`,
        );
      }
    }
  } finally {
    await deleteXiCompetition(BRACKET);
  }
});

test("r20 the description renders above the results and a long one expands with Show more", async ({
  page,
}, testInfo) => {
  try {
    const shortId = await addCompetition("xi", OTHER, {
      description: SHORT_DOC,
    });
    const longId = await addCompetition("xi", LONG, {
      description: LONG_DOC,
    });
    await signIn(page.context(), E2E_PARTICIPANT_EMAIL);
    for (const [viewport, size] of VIEWPORTS) {
      await page.setViewportSize(size);

      await page.goto(`/xi/competitions/${shortId}`);
      await expect(
        page.getByRole("region", { name: "Placements" }),
      ).toBeVisible();
      const shortDescription = page.locator(
        '[data-slot="competition-description"]',
      );
      await expect(shortDescription).toHaveCount(1);
      await expect(shortDescription).toContainText("A short description.");
      // Content that fits has no Show more button.
      await expect(page.getByRole("button", { name: "Show more" })).toHaveCount(
        0,
      );

      await page.goto(`/xi/competitions/${longId}`);
      await expect(
        page.getByRole("region", { name: "Placements" }),
      ).toBeVisible();
      const description = page.locator('[data-slot="competition-description"]');
      // Streaming can leave the fallback beside the page for a moment.
      await expect(description).toHaveCount(1);
      await expect(description).toContainText("Paragraph 1:");
      const facts = await page
        .getByRole("heading", { level: 1, name: LONG })
        .boundingBox();
      const results = await page
        .getByRole("region", { name: "Placements" })
        .boundingBox();
      const clamped = await description.boundingBox();
      expect(facts).not.toBeNull();
      expect(results).not.toBeNull();
      expect(clamped).not.toBeNull();
      // Name, then description, then the results.
      expect(clamped!.y).toBeGreaterThan(facts!.y);
      expect(clamped!.y + clamped!.height).toBeLessThanOrEqual(results!.y + 1);
      // Clamped to about six lines (text-sm, 20px lines, plus paragraph gaps).
      expect(clamped!.height).toBeLessThanOrEqual(150);

      const more = page.getByRole("button", { name: "Show more" });
      await expect(more).toHaveAttribute("aria-expanded", "false");
      await shoot(page, testInfo, `description-clamped-${viewport}`);
      await more.click();
      const less = page.getByRole("button", { name: "Show less" });
      await expect(less).toHaveAttribute("aria-expanded", "true");
      const expanded = await description.boundingBox();
      expect(expanded!.height).toBeGreaterThan(clamped!.height + 50);
      const resultsAfter = await page
        .getByRole("region", { name: "Placements" })
        .boundingBox();
      expect(expanded!.y + expanded!.height).toBeLessThanOrEqual(
        resultsAfter!.y + 1,
      );
      await expect(page.getByText("Paragraph 14:")).toBeVisible();
      await shoot(page, testInfo, `description-expanded-${viewport}`);
      await less.click();
      await expect(
        page.getByRole("button", { name: "Show more" }),
      ).toHaveAttribute("aria-expanded", "false");
    }
  } finally {
    await deleteXiCompetition(LONG);
    await deleteXiCompetition(OTHER);
  }
});

test("r20 Manage shows to an Organizer and that Competition's Host only", async ({
  browser,
  context,
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  try {
    const mine = await addCompetition("xi", LONG, { description: SHORT_DOC });
    const other = await addCompetition("xi", OTHER);
    await addE2eHost(mine, E2E_HOST_EMAIL);
    const manage = (p: Page) =>
      p.getByRole("link", { name: "Manage", exact: true });

    await asOrganizer(context);
    for (const [viewport, size] of VIEWPORTS) {
      await page.setViewportSize(size);
      await page.goto(`/xi/competitions/${mine}`);
      await expect(manage(page)).toBeVisible();
      await expect(manage(page)).toHaveAttribute(
        "href",
        `/xi/competitions/${mine}/manage`,
      );
      await shoot(page, testInfo, `manage-organizer-${viewport}`);
    }
    await manage(page).click();
    await page.waitForURL(`**/admin/competitions/${mine}`);
    await expect(
      page.getByRole("heading", { level: 1, name: LONG, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Settings", exact: true }),
    ).toBeVisible();

    const hostContext = await browser.newContext({ baseURL: E2E_BASE_URL });
    const participantContext = await browser.newContext({
      baseURL: E2E_BASE_URL,
    });
    try {
      await signIn(hostContext, E2E_HOST_EMAIL);
      await signIn(participantContext, E2E_PARTICIPANT_EMAIL);
      const host = await hostContext.newPage();
      const participant = await participantContext.newPage();
      for (const [viewport, size] of VIEWPORTS) {
        await host.setViewportSize(size);
        await participant.setViewportSize(size);

        await host.goto(`/xi/competitions/${mine}`);
        await expect(manage(host)).toBeVisible();
        await shoot(host, testInfo, `manage-host-${viewport}`);

        await host.goto(`/xi/competitions/${other}`);
        await expect(
          host.getByRole("heading", { level: 1, name: OTHER }),
        ).toBeVisible();
        await expect(manage(host)).toHaveCount(0);

        await participant.goto(`/xi/competitions/${mine}`);
        await expect(
          participant.getByRole("heading", { level: 1, name: LONG }),
        ).toBeVisible();
        await expect(manage(participant)).toHaveCount(0);
        await shoot(participant, testInfo, `manage-participant-${viewport}`);
      }

      // The admin page still refuses the Host of another Competition and a
      // Participant.
      await host.goto(`/admin/competitions/${other}`);
      await expect(
        host.getByRole("heading", { name: "Organizers and Hosts only." }),
      ).toBeVisible();
      await participant.goto(`/admin/competitions/${mine}`);
      await expect(
        participant.getByRole("heading", {
          name: "Organizers and Hosts only.",
        }),
      ).toBeVisible();
      // And lets the Host of this one in.
      await host.goto(`/admin/competitions/${mine}`);
      await expect(
        host.getByRole("heading", { name: "Settings", exact: true }),
      ).toBeVisible();
    } finally {
      await hostContext.close();
      await participantContext.close();
    }
  } finally {
    await deleteXiCompetition(LONG);
    await deleteXiCompetition(OTHER);
  }
});

test("r20 Manage on a Competition of a War Week other than the admin default opens its admin page", async ({
  context,
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  try {
    const other = await addCompetition("xii", FFA_INDIVIDUAL);
    await asOrganizer(context);
    // The admin default is not XII: without the switch its Competition
    // would not be found in /admin.
    await page.goto("/admin/competitions");
    await expect(page.getByRole("main")).not.toContainText(FFA_INDIVIDUAL);

    for (const [viewport, size] of VIEWPORTS) {
      await page.setViewportSize(size);
      await page.goto(`/xii/competitions/${other}`);
      await page.getByRole("link", { name: "Manage", exact: true }).click();
      await page.waitForURL(`**/admin/competitions/${other}`);
      await expect(
        page.getByRole("heading", {
          level: 1,
          name: FFA_INDIVIDUAL,
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Settings", exact: true }),
      ).toBeVisible();
      await shoot(page, testInfo, `manage-other-war-week-${viewport}`);
      // Back to the admin default for the next viewport's round trip.
      await context.clearCookies({ name: "admin_edition" });
    }
  } finally {
    await deleteCompetition("xii", FFA_INDIVIDUAL);
  }
});

test("r20 a free-for-all War Week shows no Individual/Team choice, but a Team Competition still says Team", async ({
  context,
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  try {
    const [{ mode }] = await runQuery<{ mode: string }>(
      `select mode from war_week where edition = 'xii'`,
    );
    expect(mode).toBe("free-for-all");
    const individual = await addCompetition("xii", FFA_INDIVIDUAL);
    const team = await addCompetition("xii", FFA_TEAM, { scoring: "team" });
    await asOrganizer(context);
    await context.addCookies([
      { name: "admin_edition", value: "xii", url: E2E_BASE_URL },
    ]);
    const scoring = (p: Page) =>
      p.getByRole("combobox", { name: "Scoring", exact: true });

    for (const [viewport, size] of VIEWPORTS) {
      await page.setViewportSize(size);

      await page.goto(`/xii/competitions/${individual}`);
      await expect(
        page.getByRole("heading", { level: 1, name: FFA_INDIVIDUAL }),
      ).toBeVisible();
      await expect(page.getByRole("main")).not.toContainText("Individual");
      await expect(page.getByRole("main")).not.toContainText("Team");
      await shoot(page, testInfo, `ffa-individual-page-${viewport}`);

      await page.goto(`/admin/competitions/${individual}`);
      await expect(
        page.getByRole("heading", { name: "Settings", exact: true }),
      ).toBeVisible();
      await expect(scoring(page)).toHaveCount(0);
      await expect(
        page.getByRole("form", { name: "Competition settings" }),
      ).not.toContainText("Individual");
      await shoot(page, testInfo, `ffa-individual-settings-${viewport}`);

      await page.goto(`/xii/competitions/${team}`);
      await expect(
        page.getByRole("heading", { level: 1, name: FFA_TEAM }),
      ).toBeVisible();
      await expect(page.getByRole("main")).toContainText("Team");
      await shoot(page, testInfo, `ffa-team-page-${viewport}`);

      await page.goto(`/admin/competitions/${team}`);
      await expect(scoring(page)).toBeVisible();
      await shoot(page, testInfo, `ffa-team-settings-${viewport}`);
    }
  } finally {
    await deleteCompetition("xii", FFA_INDIVIDUAL);
    await deleteCompetition("xii", FFA_TEAM);
  }
});
