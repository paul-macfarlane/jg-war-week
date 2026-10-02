import { describe, expect, it } from "vitest";

import {
  type RosterImportContext,
  importedMessage,
  mapColumns,
  parseRosterText,
  planRosterText,
  planSignature,
} from "@/lib/roster-import";

describe("parseRosterText", () => {
  it("splits cells pasted from Google Sheets on tabs, trimming them and dropping blank lines", () => {
    expect(
      parseRosterText(
        "Neo \tneo@jahnelgroup.com\tRed\n\n  \t \nTrinity\t\tBlue\r\n",
      ),
    ).toEqual([
      ["Neo", "neo@jahnelgroup.com", "Red"],
      ["Trinity", "", "Blue"],
    ]);
  });

  it("reads CSV with quoted commas, escaped quotes, newlines inside quotes and CRLF", () => {
    expect(
      parseRosterText(
        'name,email,company tag\r\n"Smith, Agent",smith@jahnelgroup.com,"The ""Matrix"""\r\n"Two\nLines",,LTI\r\n',
      ),
    ).toEqual([
      ["name", "email", "company tag"],
      ["Smith, Agent", "smith@jahnelgroup.com", 'The "Matrix"'],
      ["Two\nLines", "", "LTI"],
    ]);
  });

  it("reads a comma inside a cell as text when the paste is tab-separated", () => {
    expect(parseRosterText("Smith, Agent\tsmith@jahnelgroup.com")).toEqual([
      ["Smith, Agent", "smith@jahnelgroup.com"],
    ]);
  });
});

describe("mapColumns", () => {
  const leaderTitle = "Captain";

  it("maps a forgiving header row by name, case and punctuation aside, ignoring unknown headers", () => {
    expect(
      mapColumns(
        [
          ["Timestamp", "Email Address", "Full name", "Team Name", "Company"],
          ["1/1/2027", "neo@jahnelgroup.com", "Neo", "Red", "LTI"],
        ],
        { leaderTitle },
      ),
    ).toEqual({
      header: true,
      columns: { email: 1, name: 2, team: 3, companyTag: 4 },
    });
  });

  it("knows a Leader column by its synonyms and by the War Week's Leader Title", () => {
    for (const heading of ["Leader", "Is leader?", "CAPTAIN"]) {
      expect(mapColumns([["Name", heading]], { leaderTitle }).columns).toEqual({
        name: 0,
        leader: 1,
      });
    }
    expect(
      mapColumns([["Your name", "Head of House"]], {
        leaderTitle: "Head of House",
      }).columns,
    ).toEqual({ name: 0, leader: 1 });
  });

  it("knows a Team column by the War Week's Team Label", () => {
    expect(
      mapColumns([["Name", "House"]], { leaderTitle, teamLabel: "House" })
        .columns,
    ).toEqual({ name: 0, team: 1 });
  });

  it("reads a first row whose only heading-like cell is a Leader value as data", () => {
    expect(
      mapColumns([["Neo", "", "Red", "", "Captain"]], { leaderTitle }).header,
    ).toBe(false);
  });

  it("reads a first row holding an email as data, by position", () => {
    expect(
      mapColumns(
        [
          ["Name", "name@jahnelgroup.com", "Red"],
          ["Neo", "", "Red", "LTI"],
        ],
        { leaderTitle },
      ),
    ).toEqual({
      header: false,
      columns: { name: 0, email: 1, team: 2, companyTag: 3 },
    });
  });

  it("maps a headerless paste by position, up to the widest row", () => {
    expect(
      mapColumns([["Neo", "neo@jahnelgroup.com", "Red", "LTI", "yes"]], {
        leaderTitle,
      }),
    ).toEqual({
      header: false,
      columns: { name: 0, email: 1, team: 2, companyTag: 3, leader: 4 },
    });
    expect(mapColumns([["Neo"], ["Trinity"]], { leaderTitle })).toEqual({
      header: false,
      columns: { name: 0 },
    });
  });
});

const RED = "00000000-0000-4000-8000-000000000001";
const BLUE = "00000000-0000-4000-8000-000000000002";
const NEO = "00000000-0000-4000-8000-0000000000a1";
const TRINITY = "00000000-0000-4000-8000-0000000000a2";
const MORPHEUS = "00000000-0000-4000-8000-0000000000a3";

/** Neo leads Red; Trinity has no email or Team; Morpheus is in a Squad. */
const context: RosterImportContext = {
  mode: "teams",
  teamLabel: "House",
  leaderTitle: "Captain",
  teams: [
    { id: RED, name: "Red" },
    { id: BLUE, name: "Blue" },
  ],
  roster: [
    {
      id: NEO,
      displayName: "Neo",
      email: "neo@jahnelgroup.com",
      companyTag: "LTI",
      teamId: RED,
      isLeader: true,
      squadCount: 0,
    },
    {
      id: TRINITY,
      displayName: "Trinity",
      email: null,
      companyTag: null,
      teamId: null,
      isLeader: false,
      squadCount: 0,
    },
    {
      id: MORPHEUS,
      displayName: "Morpheus",
      email: "morpheus@jahnelgroup.com",
      companyTag: null,
      teamId: BLUE,
      isLeader: false,
      squadCount: 1,
    },
  ],
};

/** The planned entries, or the file-level error. */
function plan(text: string, ctx: RosterImportContext = context) {
  const result = planRosterText(text, ctx);
  return result.ok ? result.entries : result.error;
}

describe("planRosterText", () => {
  it("adds new rows and updates a roster email, matched ignoring case, listing what changes", () => {
    expect(
      plan(
        [
          "Name\tEmail\tHouse\tCompany tag",
          "Smith\tSmith@JahnelGroup.com\tblue\tIL",
          "Neo Anderson\tNEO@jahnelgroup.com\tBlue\t",
          "Oracle\t\t\t",
        ].join("\n"),
      ),
    ).toEqual([
      {
        row: 2,
        kind: "add",
        name: "Smith",
        values: {
          displayName: "Smith",
          email: "smith@jahnelgroup.com",
          teamId: BLUE,
          companyTag: "IL",
          isLeader: false,
        },
      },
      {
        row: 3,
        kind: "update",
        name: "Neo Anderson",
        id: NEO,
        values: {
          displayName: "Neo Anderson",
          email: "neo@jahnelgroup.com",
          teamId: BLUE,
          companyTag: null,
          isLeader: true,
        },
        changes: [
          "Name: Neo → Neo Anderson",
          "House: Red → Blue",
          "Company Tag: LTI → none",
        ],
      },
      {
        row: 4,
        kind: "add",
        name: "Oracle",
        values: {
          displayName: "Oracle",
          email: null,
          teamId: null,
          companyTag: null,
          isLeader: false,
        },
      },
    ]);
  });

  it("reads a headerless CSV by position and marks a row that changes nothing Unchanged", () => {
    expect(
      plan('Neo,neo@jahnelgroup.com,Red,LTI,yes\n"Smith, Agent",,Red,,x'),
    ).toEqual([
      { row: 1, kind: "unchanged", name: "Neo", id: NEO },
      {
        row: 2,
        kind: "add",
        name: "Smith, Agent",
        values: {
          displayName: "Smith, Agent",
          email: null,
          teamId: RED,
          companyTag: null,
          isLeader: true,
        },
      },
    ]);
  });

  it("leaves an absent column unchanged but clears a present, empty cell", () => {
    expect(plan("Neo\tneo@jahnelgroup.com")).toEqual([
      { row: 1, kind: "unchanged", name: "Neo", id: NEO },
    ]);
    expect(plan("Neo\tneo@jahnelgroup.com\t\t\t")).toEqual([
      expect.objectContaining({
        kind: "update",
        changes: [
          "House: Red → none",
          "Company Tag: LTI → none",
          "Captain: yes → no",
        ],
      }),
    ]);
  });

  it("reads a Leader cell as yes, y, true, x, 1, ✓, leader, captain or the Leader Title", () => {
    const leaders = ["Yes", "y", "TRUE", "x", "1", "✓", "Leader", "captain"];
    const text = [
      ...leaders.map((cell, i) => `L${i}\t\tRed\t\t${cell}`),
      "N1\t\tRed\t\tno",
      "N2\t\tRed\t\tmaybe",
    ].join("\n");
    const entries = plan(text);
    expect(
      Array.isArray(entries) &&
        entries.map((e) => (e.kind === "add" ? e.values.isLeader : e.kind)),
    ).toEqual([...leaders.map(() => true), false, false]);
    expect(
      plan("Ann\t\tRed\t\tHead of House", {
        ...context,
        leaderTitle: "Head of House",
      }),
    ).toEqual([
      expect.objectContaining({
        kind: "add",
        values: expect.objectContaining({ isLeader: true }),
      }),
    ]);
  });

  it("ignores the Team and Leader columns in a free-for-all", () => {
    expect(
      plan("Smith\t\tGreen\t\tyes", {
        ...context,
        mode: "free-for-all",
        teams: [],
      }),
    ).toEqual([
      expect.objectContaining({
        kind: "add",
        values: expect.objectContaining({ teamId: null, isLeader: false }),
      }),
    ]);
  });

  it("refuses each bad row with its reason, and never creates a Team", () => {
    const rows = [
      "Name\tEmail\tHouse\tLeader",
      "Bad\tnot-an-email\tRed\t",
      "Green\t\tGreen\t",
      "trinity \t\t\t",
      "Twin\t\t\t",
      "TWIN\t\t\t",
      "First\tsame@jahnelgroup.com\t\t",
      "Second\tSAME@jahnelgroup.com\t\t",
      "Loner\t\t\tyes",
      "Morpheus\tmorpheus@jahnelgroup.com\tRed\t",
      "Trinity\tneo@jahnelgroup.com\tRed\tyes",
      "\t\tRed\t",
    ];
    const entries = plan(rows.join("\n"));
    expect(
      Array.isArray(entries) &&
        entries.map((e) => [e.row, e.kind === "error" ? e.error : e.kind]),
    ).toEqual([
      [2, "Email must be a valid email."],
      [3, 'No House named "Green".'],
      [4, 'There\'s already a Participant named "trinity".'],
      [5, "add"],
      [6, 'Another row already has the name "TWIN".'],
      [7, "add"],
      [8, "Another row already has same@jahnelgroup.com."],
      [9, "A Leader needs a Team."],
      [
        10,
        "In a Squad; change their House on the roster after removing them from its Squads.",
      ],
      [11, 'There\'s already a Participant named "Trinity".'],
      [12, "Display name must not be empty."],
    ]);
  });

  it("refuses an empty paste, one with no name column, and more than 500 rows", () => {
    expect(plan(" \n\t\n")).toBe("Paste some rows or upload a CSV first.");
    expect(plan("Email\tTeam\nneo@jahnelgroup.com\tRed")).toBe(
      "There's no name column. Add a Name heading, or put names first.",
    );
    const names = (n: number) =>
      Array.from({ length: n }, (_, i) => `P${i}`).join("\n");
    expect(plan(names(500))).toHaveLength(500);
    expect(plan(names(501))).toBe(
      "That's more than 500 rows. Import at most 500 at a time.",
    );
    expect(plan("x".repeat(256 * 1024 + 1))).toBe(
      "That's more than 256 KB. Import fewer rows at a time.",
    );
  });
});

describe("planSignature and importedMessage", () => {
  it("keeps each row's number, kind and changes, so a changed roster shows", () => {
    const entries = plan(
      "Neo Anderson\tneo@jahnelgroup.com\tRed\nSmith\t\t\nTrinity\t\tGreen",
    );
    expect(Array.isArray(entries) && planSignature(entries)).toEqual([
      { row: 1, kind: "update", changes: ["Name: Neo → Neo Anderson"] },
      { row: 2, kind: "add", changes: [] },
      { row: 3, kind: "error", changes: [] },
    ]);
  });

  it("words the toast", () => {
    expect(importedMessage({ added: 2, updated: 1 })).toBe(
      "Imported 2 new, updated 1.",
    );
  });
});
