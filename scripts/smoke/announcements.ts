import {
  ADMIN_REFUSAL_TEXT,
  BASE_URL,
  SMOKE_ORGANIZER_EMAIL,
  type SmokeSession,
  callAction,
  fail,
  ok,
  runQuery,
  serverActionIds,
  signedInFetch,
  xiWarWeekId,
} from "./harness";

// Announcements the smoke creates carry this title prefix so cleanup can
// find them (and never touch a seeded Announcement).
export const SMOKE_ANNOUNCEMENT_PREFIX = "smoke-announcement-";

export async function smokeAnnouncements() {
  return runQuery<{
    id: string;
    title: string;
    author_email: string;
    published_at: string;
    pinned: boolean;
    body: string;
  }>(
    `select id, title, author_email, published_at, pinned, body::text as body
     from announcement where title like $1 order by published_at desc`,
    [`${SMOKE_ANNOUNCEMENT_PREFIX}%`],
  );
}

export async function deleteSmokeAnnouncements() {
  await runQuery(`delete from announcement where title like $1`, [
    `${SMOKE_ANNOUNCEMENT_PREFIX}%`,
  ]);
}

/** AC1: pinned first, then newest first; AC2: an allow-listed embed. */
export async function assertAnnouncementFeed() {
  const redirectCheck =
    "GET /xi/news permanently redirects (308) to /xi/announcements";
  try {
    const res = await fetch(`${BASE_URL}/xi/news`, { redirect: "manual" });
    const location = res.headers.get("location") ?? "";
    if (
      res.status === 308 &&
      new URL(location, BASE_URL).pathname === "/xi/announcements"
    ) {
      ok(redirectCheck);
    } else {
      fail(redirectCheck, `status=${res.status} location=${location}`);
    }
  } catch (error) {
    fail(redirectCheck, String(error));
  }

  const check =
    "GET /xi/announcements orders the pinned welcome first, then Wellness Wednesday, then Tournament Night recap";
  let body = "";
  try {
    const res = await signedInFetch(`${BASE_URL}/xi/announcements`);
    body = await res.text();
    const positions = {
      welcome: body.indexOf("Welcome to War Week XI"),
      wellness: body.indexOf("Wellness Wednesday is here"),
      recap: body.indexOf("Tournament Night recap"),
    };
    const ordered =
      positions.welcome >= 0 &&
      positions.wellness > positions.welcome &&
      positions.recap > positions.wellness;
    if (res.status === 200 && ordered) {
      ok(check);
    } else {
      fail(
        check,
        `status=${res.status} positions=${JSON.stringify(positions)}`,
      );
    }
  } catch (error) {
    fail(check, String(error));
    return;
  }

  const embedCheck =
    "GET /xi/announcements embeds the welcome Announcement's video as a YouTube iframe";
  if (
    /<iframe[^>]*src="https:\/\/www\.youtube-nocookie\.com\/embed\/vKQi3bBA1y8"/.test(
      body,
    )
  ) {
    ok(embedCheck);
  } else {
    fail(embedCheck, "no matching iframe src found");
  }
}

/** AC3: the pinned Announcement shows on the edition home. */
export async function assertAnnouncementHomePinned() {
  const check = "GET /xi shows a Pinned section with the welcome Announcement";
  try {
    const res = await signedInFetch(`${BASE_URL}/xi`);
    const body = await res.text();
    if (
      res.status === 200 &&
      body.includes(">Pinned<") &&
      body.includes("Welcome to War Week XI")
    ) {
      ok(check);
    } else {
      fail(check, `status=${res.status}`);
    }
  } catch (error) {
    fail(check, String(error));
  }

  const badgeCheck = "GET /xi/announcements and /xi both show the Pinned badge";
  const pinnedBadge = /<span[^>]*>Pinned<\/span>/;
  try {
    const feed = await (
      await signedInFetch(`${BASE_URL}/xi/announcements`)
    ).text();
    const home = await (await signedInFetch(`${BASE_URL}/xi`)).text();
    if (pinnedBadge.test(feed) && pinnedBadge.test(home)) {
      ok(badgeCheck);
    } else {
      fail(badgeCheck, "Pinned badge markup missing on one of the pages");
    }
  } catch (error) {
    fail(badgeCheck, String(error));
  }
}

/** AC4: Organizer-only create/edit/pin/unpin/delete, recording author/published-at. */
export async function assertAnnouncementActions(sessions: {
  organizer: SmokeSession;
  notOrganizer: SmokeSession;
}) {
  const ids = serverActionIds();
  const actions = [
    "createAnnouncement",
    "updateAnnouncement",
    "deleteAnnouncement",
    "pinAnnouncement",
    "unpinAnnouncement",
  ];
  const missing = actions.filter((name) => !ids[name]);
  if (missing.length > 0) {
    fail("server action ids in the build manifest", missing.join(", "));
    return;
  }

  const run = async (check: string, body: () => Promise<string | null>) => {
    try {
      const problem = await body();
      if (problem === null) ok(check);
      else fail(check, problem);
    } catch (error) {
      fail(check, String(error));
    }
  };

  const validBody = {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "smoke body" }] },
    ],
  };
  const editedTitle = `${SMOKE_ANNOUNCEMENT_PREFIX}edited`;

  try {
    await deleteSmokeAnnouncements();

    await run(
      "createAnnouncement rejects a signed-in JG user off the allowlist",
      async () => {
        const result = await callAction(
          ids.createAnnouncement,
          [
            await xiWarWeekId(),
            {
              title: `${SMOKE_ANNOUNCEMENT_PREFIX}refused`,
              body: validBody,
              pinned: false,
            },
          ],
          sessions.notOrganizer,
        );
        const rows = await smokeAnnouncements();
        return !result.ok &&
          result.error === "Only an Organizer can post Announcements." &&
          rows.length === 0
          ? null
          : `result=${JSON.stringify(result)} rows=${rows.length}`;
      },
    );

    await run(
      "createAnnouncement strips a body video node from a disallowed host",
      async () => {
        const result = await callAction(
          ids.createAnnouncement,
          [
            await xiWarWeekId(),
            {
              title: `${SMOKE_ANNOUNCEMENT_PREFIX}bad-video`,
              body: {
                type: "doc",
                content: [
                  ...validBody.content,
                  {
                    type: "video",
                    attrs: { src: "https://evil.example.com/watch?v=1" },
                  },
                ],
              },
              pinned: false,
            },
          ],
          sessions.organizer,
        );
        const rows = await smokeAnnouncements();
        const stored = rows[0]?.body ?? "";
        await deleteSmokeAnnouncements();
        return result.ok &&
          rows.length === 1 &&
          !stored.includes("evil.example.com") &&
          !stored.includes('"video"')
          ? null
          : `result=${JSON.stringify(result)} rows=${JSON.stringify(rows)}`;
      },
    );

    await run(
      "createAnnouncement as an Organizer saves a valid Announcement with author-email and a recent published-at",
      async () => {
        const result = await callAction(
          ids.createAnnouncement,
          [
            await xiWarWeekId(),
            {
              title: `${SMOKE_ANNOUNCEMENT_PREFIX}created`,
              body: validBody,
              pinned: false,
            },
          ],
          sessions.organizer,
        );
        const rows = await smokeAnnouncements();
        const row = rows[0];
        const publishedRecent =
          row != null &&
          Date.now() - new Date(row.published_at).getTime() < 60_000;
        return result.ok &&
          rows.length === 1 &&
          row.author_email === SMOKE_ORGANIZER_EMAIL &&
          publishedRecent
          ? null
          : `result=${JSON.stringify(result)} rows=${JSON.stringify(rows)}`;
      },
    );

    const [created] = await smokeAnnouncements();

    if (!created) {
      fail(
        "look up the just-created smoke Announcement",
        "smokeAnnouncements() returned no rows",
      );
    } else {
      await run(
        "updateAnnouncement, pinAnnouncement, unpinAnnouncement and deleteAnnouncement each reject a non-Organizer and leave the row unchanged",
        async () => {
          const update = await callAction(
            ids.updateAnnouncement,
            [
              created.id,
              {
                title: "should-not-apply",
                body: validBody,
                pinned: true,
              },
            ],
            sessions.notOrganizer,
          );
          const pin = await callAction(
            ids.pinAnnouncement,
            [created.id],
            sessions.notOrganizer,
          );
          const unpin = await callAction(
            ids.unpinAnnouncement,
            [created.id],
            sessions.notOrganizer,
          );
          const remove = await callAction(
            ids.deleteAnnouncement,
            [created.id],
            sessions.notOrganizer,
          );
          const [row] = await smokeAnnouncements();
          const refused = [update, pin, unpin, remove].every(
            (result) =>
              !result.ok &&
              /^Only an Organizer can (change Announcements|delete Announcements|pin Announcements|unpin Announcements)\.$/.test(
                result.error,
              ),
          );
          const unchanged =
            row != null &&
            row.title === created.title &&
            row.pinned === created.pinned;
          return refused && unchanged
            ? null
            : `update=${JSON.stringify(update)} pin=${JSON.stringify(pin)} unpin=${JSON.stringify(unpin)} delete=${JSON.stringify(remove)} row=${JSON.stringify(row)}`;
        },
      );

      await run(
        "updateAnnouncement changes the title and keeps author-email and published-at",
        async () => {
          const result = await callAction(
            ids.updateAnnouncement,
            [
              created.id,
              {
                title: editedTitle,
                body: validBody,
                pinned: false,
              },
            ],
            sessions.organizer,
          );
          const [row] = await smokeAnnouncements();
          return result.ok &&
            row?.title === editedTitle &&
            row.author_email === created.author_email &&
            new Date(row.published_at).getTime() ===
              new Date(created.published_at).getTime()
            ? null
            : `result=${JSON.stringify(result)} row=${JSON.stringify(row)}`;
        },
      );

      await run(
        "pinAnnouncement pins it, and it now sorts first on /xi/announcements",
        async () => {
          const result = await callAction(
            ids.pinAnnouncement,
            [created.id],
            sessions.organizer,
          );
          const [row] = await smokeAnnouncements();
          const body = await (
            await signedInFetch(`${BASE_URL}/xi/announcements`)
          ).text();
          const welcomePos = body.indexOf("Welcome to War Week XI");
          const editedPos = body.indexOf(editedTitle);
          return result.ok &&
            row?.pinned === true &&
            editedPos >= 0 &&
            editedPos < welcomePos
            ? null
            : `result=${JSON.stringify(result)} pinned=${row?.pinned} welcomePos=${welcomePos} editedPos=${editedPos}`;
        },
      );

      await run(
        "unpinAnnouncement unpins it, and the welcome Announcement sorts first again",
        async () => {
          const result = await callAction(
            ids.unpinAnnouncement,
            [created.id],
            sessions.organizer,
          );
          const [row] = await smokeAnnouncements();
          const body = await (
            await signedInFetch(`${BASE_URL}/xi/announcements`)
          ).text();
          const welcomePos = body.indexOf("Welcome to War Week XI");
          const editedPos = body.indexOf(editedTitle);
          return result.ok &&
            row?.pinned === false &&
            welcomePos >= 0 &&
            welcomePos < editedPos
            ? null
            : `result=${JSON.stringify(result)} pinned=${row?.pinned} welcomePos=${welcomePos} editedPos=${editedPos}`;
        },
      );

      await run("deleteAnnouncement as an Organizer removes it", async () => {
        const result = await callAction(
          ids.deleteAnnouncement,
          [created.id],
          sessions.organizer,
        );
        const rows = await smokeAnnouncements();
        return result.ok && rows.length === 0
          ? null
          : `result=${JSON.stringify(result)} rows=${rows.length}`;
      });
    }

    await run(
      "deleteAnnouncement of an id that no longer exists says so",
      async () => {
        const result = await callAction(
          ids.deleteAnnouncement,
          ["00000000-0000-4000-8000-000000000000"],
          sessions.organizer,
        );
        return !result.ok && /no longer exists/.test(result.error)
          ? null
          : `result=${JSON.stringify(result)}`;
      },
    );
  } finally {
    await deleteSmokeAnnouncements().catch((error) =>
      fail("delete smoke Announcements", String(error)),
    );
  }
}

/** AC5: unsafe content is stripped on write, not just rejected outright. */
export async function assertAnnouncementUnsafeContentStripped(sessions: {
  organizer: SmokeSession;
}) {
  const ids = serverActionIds();
  if (!ids.createAnnouncement) {
    fail(
      "server action id createAnnouncement in the build manifest",
      "missing",
    );
    return;
  }

  const check =
    "createAnnouncement strips a javascript: link, a data: image and an unrecognized iframe block on write";
  const unsafeBody = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "click",
            marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
          },
        ],
      },
      { type: "image", attrs: { src: "data:image/png;base64,AAAA", alt: "" } },
      { type: "iframe", attrs: { src: "https://evil.example.com" } },
    ],
  };

  try {
    await deleteSmokeAnnouncements();
    const result = await callAction(
      ids.createAnnouncement,
      [
        await xiWarWeekId(),
        {
          title: `${SMOKE_ANNOUNCEMENT_PREFIX}unsafe`,
          body: unsafeBody,
          pinned: false,
        },
      ],
      sessions.organizer,
    );
    const rows = await smokeAnnouncements();
    const storedBody = rows[0]?.body ?? "";
    const clean =
      !storedBody.includes("javascript:") &&
      !storedBody.includes("data:image") &&
      !storedBody.includes('"iframe"');
    if (!result.ok || rows.length !== 1 || !clean) {
      fail(check, `result=${JSON.stringify(result)} body=${storedBody}`);
      return;
    }

    const feed = await (
      await signedInFetch(`${BASE_URL}/xi/announcements`)
    ).text();
    if (feed.includes("javascript:")) {
      fail(check, "rendered /xi/announcements still contains javascript:");
      return;
    }
    ok(check);
  } catch (error) {
    fail(check, String(error));
  } finally {
    await deleteSmokeAnnouncements().catch((error) =>
      fail("delete smoke Announcements", String(error)),
    );
  }
}

/** /admin/announcements, its New form and the edit form for a seeded row. */
export async function assertAnnouncementAdminPages(sessions: {
  organizer: SmokeSession;
  notOrganizer: SmokeSession;
}) {
  const listCheck =
    "GET /admin/announcements as an Organizer lists the seeded titles and New Announcement, and refuses a non-Organizer";
  try {
    const organizerRes = await fetch(`${BASE_URL}/admin/announcements`, {
      headers: { cookie: sessions.organizer.cookie },
    });
    const organizerBody = await organizerRes.text();
    const titles = [
      "Welcome to War Week XI",
      "Tournament Night recap",
      "Wellness Wednesday is here",
    ];
    const hasAllTitles = titles.every((title) => organizerBody.includes(title));
    const notOrganizerRes = await fetch(`${BASE_URL}/admin/announcements`, {
      headers: { cookie: sessions.notOrganizer.cookie },
    });
    const notOrganizerBody = await notOrganizerRes.text();
    if (
      organizerRes.status === 200 &&
      hasAllTitles &&
      organizerBody.includes("New Announcement") &&
      notOrganizerRes.status === 200 &&
      notOrganizerBody.includes(ADMIN_REFUSAL_TEXT)
    ) {
      ok(listCheck);
    } else {
      fail(
        listCheck,
        `organizerStatus=${organizerRes.status} hasAllTitles=${hasAllTitles} notOrganizerStatus=${notOrganizerRes.status}`,
      );
    }
  } catch (error) {
    fail(listCheck, String(error));
  }

  const newCheck =
    "GET /admin/announcements/new as an Organizer shows the Announcement form";
  try {
    const res = await fetch(`${BASE_URL}/admin/announcements/new`, {
      headers: { cookie: sessions.organizer.cookie },
    });
    const body = await res.text();
    if (res.status === 200 && body.includes('aria-label="Announcement"')) {
      ok(newCheck);
    } else {
      fail(newCheck, `status=${res.status}`);
    }
  } catch (error) {
    fail(newCheck, String(error));
  }

  const editCheck =
    "GET /admin/announcements/[id] as an Organizer shows Edit Announcement for the seeded welcome Announcement";
  try {
    const [welcome] = await runQuery<{ id: string }>(
      `select a.id from announcement a join war_week w on w.id = a.war_week_id
       where w.edition = 'xi' and a.title = 'Welcome to War Week XI'`,
    );
    const res = await fetch(`${BASE_URL}/admin/announcements/${welcome.id}`, {
      headers: { cookie: sessions.organizer.cookie },
    });
    const body = await res.text();
    if (res.status === 200 && body.includes("Edit Announcement")) {
      ok(editCheck);
    } else {
      fail(editCheck, `status=${res.status}`);
    }
  } catch (error) {
    fail(editCheck, String(error));
  }
}
