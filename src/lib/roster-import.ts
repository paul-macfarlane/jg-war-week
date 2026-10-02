import type { WarWeek } from "@/db/schema";
import {
  type ParticipantValues,
  emailSchema,
  parseParticipantInput,
} from "@/lib/setup";

/**
 * Importing the roster from a spreadsheet (ticket 67): cells pasted from
 * Google Sheets or a CSV file, read into rows, mapped to the roster's
 * columns and planned against this War Week's roster, one Add, Update,
 * Unchanged or Error per row. Pure: the roster admin previews with it, and
 * the import mutation re-plans with it before it writes.
 */

/** A roster field a column can fill. */
export type RosterColumn = "name" | "email" | "team" | "companyTag" | "leader";

/** Which cell of a row holds each field; a missing field is absent. */
export type RosterColumns = Partial<Record<RosterColumn, number>>;

/** Without a header row, the columns in this order. */
const POSITIONAL: RosterColumn[] = [
  "name",
  "email",
  "team",
  "companyTag",
  "leader",
];

/** Lowercase letters and digits only, so "Is leader?" reads as "isleader". */
const normalized = (cell: string) =>
  cell.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

const SYNONYMS: Record<RosterColumn, string[]> = {
  name: ["name", "full name", "display name", "participant", "your name"],
  email: ["email", "email address", "work email"],
  team: ["team", "team name"],
  companyTag: ["company", "company tag", "tag"],
  leader: ["leader", "captain", "is leader"],
};

/**
 * Reads pasted or uploaded text into rows of trimmed cells, dropping blank
 * lines. Tab-separated when any line has a tab (a Google Sheets paste),
 * else CSV (RFC 4180: quoted fields, `""` escapes, commas and newlines
 * inside quotes, CRLF).
 */
export function parseRosterText(text: string): string[][] {
  const rows = /\t/.test(text)
    ? text.split(/\r?\n/).map((line) => line.split("\t"))
    : parseCsv(text);
  return rows
    .map((row) => row.map((cell) => cell.trim()))
    .filter((row) => row.some((cell) => cell !== ""));
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell);
  rows.push(row);
  return rows;
}

const isEmail = (cell: string) => emailSchema.safeParse(cell).success;

/**
 * Which cell holds each field. The first row is a header when at least one
 * of its cells names a field other than Leader (case and punctuation aside;
 * a Leader cell saying "Captain" is data) and none is an email; then each
 * field is the first cell naming it ("Full name", "Email address", the War
 * Week's Team Label or Leader Title…) and other headings, such as a Google
 * Form's Timestamp, are ignored. Without a header the columns are
 * name, email, Team, Company Tag and Leader by position, as many as the
 * widest row has.
 */
export function mapColumns(
  rows: string[][],
  {
    leaderTitle,
    teamLabel = "Team",
  }: { leaderTitle: string; teamLabel?: string },
): { header: boolean; columns: RosterColumns } {
  const first = rows[0] ?? [];
  const synonyms = {
    ...SYNONYMS,
    team: [...SYNONYMS.team, teamLabel, `${teamLabel} name`],
    leader: [...SYNONYMS.leader, leaderTitle],
  };
  const fieldOf = (cell: string): RosterColumn | undefined => {
    const key = normalized(cell);
    if (!key) return undefined;
    return POSITIONAL.find((field) =>
      synonyms[field].some((synonym) => normalized(synonym) === key),
    );
  };

  const namesField = (cell: string) => {
    const field = fieldOf(cell);
    return field !== undefined && field !== "leader";
  };
  if (first.some(namesField) && !first.some(isEmail)) {
    const columns: RosterColumns = {};
    first.forEach((cell, index) => {
      const field = fieldOf(cell);
      if (field && columns[field] === undefined) columns[field] = index;
    });
    return { header: true, columns };
  }

  const width = Math.max(0, ...rows.map((row) => row.length));
  const columns: RosterColumns = {};
  POSITIONAL.slice(0, width).forEach((field, index) => {
    columns[field] = index;
  });
  return { header: false, columns };
}

/** The most data rows one import takes. */
export const MAX_IMPORT_ROWS = 500;
/** The most bytes one paste or CSV file may be, under Next's 1 MB body limit. */
export const MAX_IMPORT_BYTES = 256 * 1024;

/** A roster row as the planner reads it (`SetupParticipant` fits). */
export type RosterImportParticipant = Pick<
  ParticipantValues,
  "displayName" | "email" | "companyTag" | "teamId" | "isLeader"
> & {
  id: string;
  /** Squads the Participant is in: their Team can't change while > 0. */
  squadCount: number;
};

/** This War Week, as an import is planned against it. */
export type RosterImportContext = {
  roster: RosterImportParticipant[];
  teams: { id: string; name: string }[];
  mode: WarWeek["mode"];
  teamLabel: string;
  leaderTitle: string;
};

/** What importing one data row does. `row` counts the file's rows from 1. */
export type RosterImportEntry =
  | { row: number; kind: "add"; name: string; values: ParticipantValues }
  | {
      row: number;
      kind: "update";
      name: string;
      id: string;
      values: ParticipantValues;
      /** "Team: Red → none", one per changed field. */
      changes: string[];
    }
  | { row: number; kind: "unchanged"; name: string; id: string }
  | { row: number; kind: "error"; name: string; error: string };

export type RosterImportPlan =
  { ok: true; entries: RosterImportEntry[] } | { ok: false; error: string };

/** What the preview promised, row by row: the import refuses if it differs. */
export type RosterImportSignature = {
  row: number;
  kind: RosterImportEntry["kind"];
  changes: string[];
}[];

/** A name or email as matching compares it: case and outer spaces aside. */
const key = (value: string) => value.trim().toLowerCase();

const LEADER_WORDS = ["yes", "y", "true", "x", "1", "✓", "leader", "captain"];

/** Whether a Leader cell says yes, including the War Week's Leader Title. */
function isLeaderCell(cell: string, leaderTitle: string): boolean {
  const word = key(cell);
  return LEADER_WORDS.includes(word) || word === key(leaderTitle);
}

/**
 * Plans every data row against the roster: an **Add**, an **Update** of the
 * Participant with that email (ignoring case) with what changes, an
 * **Unchanged** Update, or an **Error** with its reason. A column absent
 * from the file leaves the field as it is (an Add's default); a present,
 * empty cell clears it. In a free-for-all the Team and Leader columns are
 * ignored. A Team is matched by name, never created. Names are matched
 * ignoring case and outer spaces, against the roster and earlier rows.
 */
export function planRosterImport({
  rows,
  firstRow,
  columns,
  roster,
  teams,
  mode,
  teamLabel,
  leaderTitle,
}: RosterImportContext & {
  rows: string[][];
  /** The file row number of `rows[0]`: 2 after a header, else 1. */
  firstRow: number;
  columns: RosterColumns;
}): RosterImportEntry[] {
  const byEmail = new Map(
    roster.flatMap((p) => (p.email ? [[key(p.email), p] as const] : [])),
  );
  const teamByName = new Map(teams.map((t) => [key(t.name), t]));
  const teamName = new Map(teams.map((t) => [t.id, t.name]));
  const seenNames = new Set<string>();
  const seenEmails = new Set<string>();
  const hasTeams = mode === "teams";

  return rows.map((cells, index): RosterImportEntry => {
    const row = firstRow + index;
    const cell = (field: RosterColumn) => {
      const at = columns[field];
      return at === undefined ? undefined : (cells[at] ?? "");
    };
    const name = cell("name") ?? "";
    const error = (message: string): RosterImportEntry => ({
      row,
      kind: "error",
      name,
      error: message,
    });
    const nameKey = key(name);
    const firstWithName = nameKey !== "" && !seenNames.has(nameKey);
    if (nameKey) seenNames.add(nameKey);

    const email = cell("email") ?? "";
    let emailKey = "";
    if (email) {
      const parsed = emailSchema.safeParse(email);
      if (!parsed.success) {
        return error(
          firstError(
            parseParticipantInput({
              displayName: name,
              companyTag: "",
              email,
              teamId: "",
              isLeader: false,
            }),
          ),
        );
      }
      emailKey = parsed.data;
    }
    const firstWithEmail = emailKey !== "" && !seenEmails.has(emailKey);
    if (emailKey) seenEmails.add(emailKey);
    const existing = emailKey ? byEmail.get(emailKey) : undefined;

    let teamId = existing?.teamId ?? "";
    let isLeader = existing?.isLeader ?? false;
    if (hasTeams) {
      const teamCell = cell("team");
      if (teamCell !== undefined) {
        if (teamCell === "") {
          teamId = "";
        } else {
          const team = teamByName.get(key(teamCell));
          if (!team) return error(`No ${teamLabel} named "${teamCell}".`);
          teamId = team.id;
        }
      }
      const leaderCell = cell("leader");
      if (leaderCell !== undefined) {
        isLeader = isLeaderCell(leaderCell, leaderTitle);
      }
    }
    const companyTag = cell("companyTag") ?? existing?.companyTag ?? "";

    const parsed = parseParticipantInput({
      displayName: name,
      companyTag,
      email: existing?.email ?? emailKey,
      teamId: teamId ?? "",
      isLeader,
    });
    if (!parsed.ok) return error(parsed.error);
    const values = parsed.value;

    if (emailKey && !firstWithEmail) {
      return error(`Another row already has ${emailKey}.`);
    }
    if (roster.some((p) => p !== existing && key(p.displayName) === nameKey)) {
      return error(`There's already a Participant named "${name}".`);
    }
    if (!firstWithName) {
      return error(`Another row already has the name "${name}".`);
    }

    if (!existing) return { row, kind: "add", name, values };

    if (values.teamId !== existing.teamId && existing.squadCount > 0) {
      return error(
        `In a Squad; change their ${teamLabel} on the roster after removing them from its Squads.`,
      );
    }
    const none = (value: string | null | undefined) => value || "none";
    const yesNo = (value: boolean) => (value ? "yes" : "no");
    const changes = [
      ["Name", existing.displayName, values.displayName],
      [
        teamLabel,
        none(existing.teamId && teamName.get(existing.teamId)),
        none(values.teamId && teamName.get(values.teamId)),
      ],
      ["Company Tag", none(existing.companyTag), none(values.companyTag)],
      [leaderTitle, yesNo(existing.isLeader), yesNo(values.isLeader)],
    ].flatMap(([label, before, after]) =>
      before === after ? [] : [`${label}: ${before} → ${after}`],
    );
    return changes.length === 0
      ? { row, kind: "unchanged", name, id: existing.id }
      : { row, kind: "update", name, id: existing.id, values, changes };
  });
}

function firstError(parsed: ReturnType<typeof parseParticipantInput>) {
  return parsed.ok ? "Email must be a valid email." : parsed.error;
}

/**
 * Reads, maps and plans pasted or uploaded text, or refuses the whole file:
 * empty, over 256 KB, over 500 data rows, or with no name column.
 */
export function planRosterText(
  text: string,
  context: RosterImportContext,
): RosterImportPlan {
  if (new TextEncoder().encode(text).length > MAX_IMPORT_BYTES) {
    return {
      ok: false,
      error: "That's more than 256 KB. Import fewer rows at a time.",
    };
  }
  const rows = parseRosterText(text);
  const { header, columns } = mapColumns(rows, context);
  const data = header ? rows.slice(1) : rows;
  if (data.length === 0) {
    return { ok: false, error: "Paste some rows or upload a CSV first." };
  }
  if (columns.name === undefined) {
    return {
      ok: false,
      error: "There's no name column. Add a Name heading, or put names first.",
    };
  }
  if (data.length > MAX_IMPORT_ROWS) {
    return {
      ok: false,
      error: `That's more than ${MAX_IMPORT_ROWS} rows. Import at most ${MAX_IMPORT_ROWS} at a time.`,
    };
  }
  return {
    ok: true,
    entries: planRosterImport({
      ...context,
      rows: data,
      firstRow: header ? 2 : 1,
      columns,
    }),
  };
}

/** Each row's number, kind and changes: what the import must still find. */
export function planSignature(
  entries: RosterImportEntry[],
): RosterImportSignature {
  return entries.map((entry) => ({
    row: entry.row,
    kind: entry.kind,
    changes: entry.kind === "update" ? entry.changes : [],
  }));
}

/** How many rows of each kind: the preview's summary. */
export function planCounts(entries: RosterImportEntry[]) {
  const count = (kind: RosterImportEntry["kind"]) =>
    entries.filter((entry) => entry.kind === kind).length;
  return {
    add: count("add"),
    update: count("update"),
    unchanged: count("unchanged"),
    error: count("error"),
  };
}

/** The toast after an import: "Imported 2 new, updated 1." */
export function importedMessage({
  added,
  updated,
}: {
  added: number;
  updated: number;
}): string {
  return `Imported ${added} new, updated ${updated}.`;
}
