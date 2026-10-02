import {
  BASE_URL,
  type SmokeSession,
  callAction,
  fail,
  ok,
  runCheck,
  runQuery,
  serverActionIds,
  signedInFetch,
  xiWarWeekId,
} from "./harness";

/**
 * Creates XII from XI, ends XI (the Winner is computed from its Standings,
 * never sent by the caller) and starts XII through the lifecycle actions,
 * checks the site follows, that an Organizer can still
 * pick and correct XI once it's in the Archive, and that a Participant
 * can't reopen XI or create the next War Week. Then puts XI back (`live`,
 * no Winner) and deletes XII by SQL so the smoke can run again.
 */
export async function assertWarWeekLifecycle(sessions: {
  organizer: SmokeSession;
  notOrganizer: SmokeSession;
}) {
  const check =
    "lifecycle: create XII, end XI with a Winner, start XII; an Organizer corrects XI but a Participant can't reopen it; then restore";
  const restore = async () => {
    await runQuery("delete from war_week where edition in ('xii', 'xiii')");
    await runQuery(
      "update war_week set status = 'live', winner = null, highlights = '{}' where edition = 'xi'",
    );
  };
  try {
    const ids = serverActionIds();
    const missing = [
      "createNextWarWeek",
      "endWarWeek",
      "startWarWeek",
      "reopenWarWeek",
      "selectAdminEdition",
      "updateWarWeekSettingsFields",
    ].filter((name) => !ids[name]);
    if (missing.length > 0) {
      fail(check, `missing action ids: ${missing.join(", ")}`);
      return;
    }
    await restore();
    const editionId = async (edition: string) =>
      (
        await runQuery<{ id: string }>(
          "select id from war_week where edition = $1",
          [edition],
        )
      )[0]?.id;
    const xiId = await editionId("xi");
    const xId = await editionId("x");
    const problems: string[] = [];
    const expectRefused = async (
      label: string,
      name: string,
      args: unknown[],
    ) => {
      const result = await callAction(ids[name], args, sessions.notOrganizer);
      if (
        result.ok ||
        !/^Only an Organizer can (start|end|reopen) a War Week\.$/.test(
          result.error,
        )
      ) {
        problems.push(`${label}: ${JSON.stringify(result)}`);
      }
    };
    const expectOk = async (label: string, name: string, args: unknown[]) => {
      const result = await callAction(ids[name], args, sessions.organizer);
      if (!result.ok) problems.push(`${label}: ${JSON.stringify(result)}`);
    };

    await expectRefused("non-Organizer ends XI", "endWarWeek", [
      xiId,
      { highlights: "" },
    ]);
    await expectRefused(
      "non-Organizer reopens X (forged id)",
      "reopenWarWeek",
      [xId],
    );
    await expectOk("create XII", "createNextWarWeek", [
      xiId,
      {
        edition: "XII",
        editionNumber: "12",
        year: "2027",
        startDate: "2027-02-21",
        endDate: "2027-02-26",
        storyTheme: "Smoke XII",
        copySettings: true,
      },
    ]);
    const xiiId = await editionId("xii");
    if (!xiiId) problems.push("XII was not created");
    const early = await callAction(
      ids.startWarWeek,
      [xiiId],
      sessions.organizer,
    );
    if (early.ok || early.error !== "End XI first.") {
      problems.push(`start XII while XI is live: ${JSON.stringify(early)}`);
    }
    await expectOk("end XI", "endWarWeek", [xiId, { highlights: "" }]);
    const [xiEnded] = await runQuery<{ winner: string | null }>(
      "select winner from war_week where edition = 'xi'",
    );
    await expectRefused("non-Organizer starts XII", "startWarWeek", [xiiId]);
    await expectOk("start XII", "startWarWeek", [xiiId]);
    await expectRefused("non-Organizer ends XII", "endWarWeek", [
      xiiId,
      { highlights: "" },
    ]);

    const root = await signedInFetch(`${BASE_URL}/`, { redirect: "manual" });
    if (!root.headers.get("location")?.endsWith("/xii")) {
      problems.push(`/ goes to ${root.headers.get("location")}`);
    }
    const history = await (await signedInFetch(`${BASE_URL}/history`)).text();
    if (!history.includes('href="/xi"')) {
      problems.push("/history lacks XI");
    }
    if (xiEnded.winner && !history.includes(xiEnded.winner)) {
      problems.push(
        `/history lacks the computed Winner ${JSON.stringify(xiEnded.winner)}`,
      );
    }
    const archiveAdmin = await (
      await fetch(`${BASE_URL}/admin/settings`, {
        headers: { cookie: `${sessions.organizer.cookie}; admin_edition=xi` },
      })
    ).text();
    if (!archiveAdmin.includes("Editing the Archive: War Week XI")) {
      problems.push("the switcher can't edit XI");
    }

    // A current (XII) Organizer may reopen XI, the latest ended edition,
    // but the one-live rule still waits for XII to end.
    const reopenWhileLive = await callAction(
      ids.reopenWarWeek,
      [xiId],
      sessions.organizer,
    );
    if (reopenWhileLive.ok || reopenWhileLive.error !== "End XII first.") {
      problems.push(
        `XII Organizer reopens XI while XII is live: ${JSON.stringify(reopenWhileLive)}`,
      );
    }

    // Organizers are global: the smoke Organizer picks XI in the switcher
    // and corrects its highlights now that it's in the Archive.
    const selected = await callAction(
      ids.selectAdminEdition,
      ["xi"],
      sessions.organizer,
    );
    if (!selected.ok) {
      problems.push(`Organizer selects XI: ${JSON.stringify(selected)}`);
    }
    const [xi] = await runQuery<Record<string, string | string[] | null>>(
      `select story_theme, start_date::text, end_date::text, mode,
         team_label, leader_title, slack_channel_url, wiki_url,
         primary_color, primary_foreground_color,
         accent_color, background_color, foreground_color,
         override_primary_color, override_primary_foreground_color,
         override_accent_color, override_background_color,
         override_foreground_color, logo_url, banner_url, font_preset, winner
       from war_week where edition = 'xi'`,
    );
    const saved = await callAction(
      ids.updateWarWeekSettingsFields,
      [
        xiId,
        {
          storyTheme: xi.story_theme,
          startDate: xi.start_date,
          endDate: xi.end_date,
          mode: xi.mode,
          teamLabel: xi.team_label,
          leaderTitle: xi.leader_title,
          slackChannelUrl: xi.slack_channel_url,
          wikiUrl: xi.wiki_url ?? "",
          primaryColor: xi.primary_color,
          primaryForegroundColor: xi.primary_foreground_color,
          accentColor: xi.accent_color,
          backgroundColor: xi.background_color,
          foregroundColor: xi.foreground_color,
          // Sent as read, so this save never clears one.
          overridePrimaryColor: xi.override_primary_color ?? "",
          overridePrimaryForegroundColor:
            xi.override_primary_foreground_color ?? "",
          overrideAccentColor: xi.override_accent_color ?? "",
          overrideBackgroundColor: xi.override_background_color ?? "",
          overrideForegroundColor: xi.override_foreground_color ?? "",
          logoUrl: xi.logo_url ?? "",
          bannerUrl: xi.banner_url ?? "",
          fontPreset: xi.font_preset,
          winner: xi.winner ?? "",
          highlights: "Smoke XI highlight",
        },
      ],
      sessions.organizer,
    );
    const [xiAfter] = await runQuery<{ highlights: string[] }>(
      "select highlights from war_week where edition = 'xi'",
    );
    if (!saved.ok || xiAfter.highlights.join() !== "Smoke XI highlight") {
      problems.push(
        `Organizer saves XI highlights: ${JSON.stringify(saved)} ${JSON.stringify(xiAfter.highlights)}`,
      );
    }
    const takeover = await callAction(
      ids.reopenWarWeek,
      [xiId],
      sessions.notOrganizer,
    );
    if (
      takeover.ok ||
      takeover.error !== "Only an Organizer can reopen a War Week."
    ) {
      problems.push(`Participant reopens XI: ${JSON.stringify(takeover)}`);
    }
    const createFromXi = await callAction(
      ids.createNextWarWeek,
      [
        xiId,
        {
          edition: "XIII",
          editionNumber: "13",
          year: "2028",
          startDate: "2028-02-21",
          endDate: "2028-02-26",
          storyTheme: "Smoke XIII",
        },
      ],
      sessions.notOrganizer,
    );
    if (
      createFromXi.ok ||
      createFromXi.error !== "Only an Organizer can create the next War Week."
    ) {
      problems.push(
        `Participant creates XIII: ${JSON.stringify(createFromXi)}`,
      );
    }

    if (problems.length === 0) ok(check);
    else fail(check, problems.join("; "));
  } catch (error) {
    fail(check, String(error));
  } finally {
    await restore().catch((error) =>
      fail("restore XI after the lifecycle check", String(error)),
    );
  }
}

/**
 * Ticket 03 AC2 (ADR 0003): a create writes to the War Week it posts, even
 * when the `admin_edition` cookie names another edition.
 */
export async function assertPostedWarWeekWins(sessions: {
  organizer: SmokeSession;
}) {
  const ids = serverActionIds();
  const question = "smoke-posted-war-week?";
  const faqCount = async (edition: string) => {
    const [row] = await runQuery<{ count: string }>(
      `select count(*) from faq_item f join war_week w on w.id = f.war_week_id where w.edition = $1`,
      [edition],
    );
    return Number(row.count);
  };
  const deleteRow = () =>
    runQuery(`delete from faq_item where question = $1`, [question]);

  try {
    await deleteRow();
    await runCheck(
      "createFaqItem posting XI's warWeekId with admin_edition=x in the cookie writes to XI and leaves X unchanged",
      async () => {
        const xBefore = await faqCount("x");
        const result = await callAction(
          ids.createFaqItem,
          [
            await xiWarWeekId(),
            {
              question,
              answer: {
                type: "doc",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "smoke" }],
                  },
                ],
              },
            },
          ],
          { cookie: `${sessions.organizer.cookie}; admin_edition=x` },
        );
        const editions = await runQuery<{ edition: string }>(
          `select w.edition from faq_item f join war_week w on w.id = f.war_week_id where f.question = $1`,
          [question],
        );
        const xAfter = await faqCount("x");
        return result.ok &&
          editions.length === 1 &&
          editions[0].edition === "xi" &&
          xAfter === xBefore
          ? null
          : `result=${JSON.stringify(result)} editions=${JSON.stringify(editions)} x=${xBefore}->${xAfter}`;
      },
    );
  } finally {
    await deleteRow().catch((error) =>
      fail("delete the posted-War-Week FAQ Item", String(error)),
    );
  }
}
