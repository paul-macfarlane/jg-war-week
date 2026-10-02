import { z } from "zod";

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

/** Every field, in a Teams War Week's headerless column order. */
const FIELDS: RosterColumn[] = [
  "name",
  "email",
  "team",
  "companyTag",
  "leader",
];

/** Without a header row, the columns in this order, by War Week mode. */
const POSITIONAL: Record<WarWeek["mode"], RosterColumn[]> = {
  teams: FIELDS,
  "free-for-all": ["name", "email", "companyTag"],
};

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
 * else comma-separated. Either way RFC 4180 quoting applies: a cell that
 * starts with `"` runs to its closing `"`, with `""` for a quote and any
 * delimiter or newline inside it (Google Sheets quotes a cell holding a
 * newline or `"` that way), and CRLF ends a row.
 */
export function parseRosterText(text: string): string[][] {
  return parseDelimited(text, /\t/.test(text) ? "\t" : ",")
    .map((row) => row.map((cell) => cell.trim()))
    .filter((row) => row.some((cell) => cell !== ""));
}

function parseDelimited(text: string, delimiter: "," | "\t"): string[][] {
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
    } else if (char === '"' && cell === "") {
      // Only a cell's first character opens quotes; a `"` later is text.
      quoted = true;
    } else if (char === delimiter) {
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
 * Form's Timestamp, are ignored. Without a header the columns are, by
 * position, name, email, Team, Company Tag and Leader in a Teams War Week,
 * or name, email and Company Tag in a free-for-all, as many as the widest
 * row has.
 */
export function mapColumns(
  rows: string[][],
  {
    mode,
    leaderTitle,
    teamLabel = "Team",
  }: { mode: WarWeek["mode"]; leaderTitle: string; teamLabel?: string },
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
    return FIELDS.find((field) =>
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
  POSITIONAL[mode].slice(0, width).forEach((field, index) => {
    columns[field] = index;
  });
  return { header: false, columns };
}

/** The most data rows one import takes. */
export const MAX_IMPORT_ROWS = 500;
/** The most bytes one paste or CSV file may be, under Next's 1 MB limit. */
export const MAX_IMPORT_BYTES = 256 * 1024;
/** `MAX_IMPORT_BYTES` as the refusals word it: "256 KB". */
export const MAX_IMPORT_SIZE = `${MAX_IMPORT_BYTES / 1024} KB`;

/** What importing a row can do. */
export const ROSTER_IMPORT_KINDS = [
  "add",
  "update",
  "unchanged",
  "error",
] as const;
export type RosterImportKind = (typeof ROSTER_IMPORT_KINDS)[number];

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

/**
 * One field an Update changes, as the preview words it: `label`, `before`
 * and `after`, with "none" for an empty value. `cleared` when the field had
 * a value and the import empties it.
 */
export type RosterImportChange = {
  label: string;
  before: string;
  after: string;
  cleared: boolean;
};

/** A change as one line: "Team: Red → none". */
export const changeText = ({ label, before, after }: RosterImportChange) =>
  `${label}: ${before} → ${after}`;

/** What importing one data row does. `row` counts the file's rows from 1. */
export type RosterImportEntry =
  | { row: number; kind: "add"; name: string; values: ParticipantValues }
  | {
      row: number;
      kind: "update";
      name: string;
      id: string;
      values: ParticipantValues;
      /** One per changed field. */
      changes: RosterImportChange[];
    }
  | { row: number; kind: "unchanged"; name: string; id: string }
  | { row: number; kind: "error"; name: string; error: string };

export type RosterImportPlan =
  { ok: true; entries: RosterImportEntry[] } | { ok: false; error: string };

/** What the preview promised, row by row: the import refuses if it differs. */
export type RosterImportSignature = {
  row: number;
  kind: RosterImportKind;
  /** Each change as `changeText` words it. */
  changes: string[];
}[];

/** A roster import as the preview posts it: the text and what it showed. */
export const rosterImportInputSchema = z.object({
  text: z.string(),
  expected: z
    .array(
      z.object({
        row: z.number().int(),
        kind: z.enum(ROSTER_IMPORT_KINDS),
        changes: z.array(z.string()),
      }),
    )
    .max(MAX_IMPORT_ROWS),
});

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
 * from the file, or a cell missing from a short row, leaves the field as it
 * is (an Add's default); a present, empty cell clears it. In a free-for-all
 * the Team and Leader columns are ignored. A Team is matched by name, never
 * created. Names are matched ignoring case and outer spaces, against the
 * roster and earlier rows that aren't Errors. A row with several problems
 * reports the first of: an unknown Team, then the Participant form's own
 * order (name, Company Tag, email, Leader), then a duplicate.
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
      // A row shorter than the file's columns (a hand-made CSV) leaves its
      // missing cells absent, so they never clear a field.
      return at === undefined ? undefined : cells[at];
    };
    const name = cell("name") ?? "";
    const error = (message: string): RosterImportEntry => ({
      row,
      kind: "error",
      name,
      error: message,
    });
    const nameKey = key(name);

    const email = cell("email") ?? "";
    const parsedEmail = emailSchema.safeParse(email);
    // A bad email matches no one; the Participant parse below refuses it.
    const emailKey = email && parsedEmail.success ? parsedEmail.data : "";
    const existing = emailKey ? byEmail.get(emailKey) : undefined;
    /** A row that isn't an Error claims its name and email. */
    const claimed = (entry: RosterImportEntry): RosterImportEntry => {
      seenNames.add(nameKey);
      if (emailKey) seenEmails.add(emailKey);
      return entry;
    };

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
      email: existing?.email ?? (emailKey || email),
      teamId,
      isLeader,
    });
    if (!parsed.ok) return error(parsed.error);
    const values = parsed.value;

    if (emailKey && seenEmails.has(emailKey)) {
      return error(`Another row already has ${emailKey}.`);
    }
    if (roster.some((p) => p !== existing && key(p.displayName) === nameKey)) {
      return error(`There's already a Participant named "${name}".`);
    }
    if (seenNames.has(nameKey)) {
      return error(`Another row already has the name "${name}".`);
    }

    if (!existing) return claimed({ row, kind: "add", name, values });

    if (values.teamId !== existing.teamId && existing.squadCount > 0) {
      return error(
        `In a Squad; change their ${teamLabel} on the roster after removing ` +
          "them from its Squads.",
      );
    }
    const yesNo = (value: boolean) => (value ? "yes" : "no");
    const teamOf = (id: string | null) => (id && teamName.get(id)) || null;
    const fields: [string, string | null, string | null][] = [
      ["Name", existing.displayName, values.displayName],
      [teamLabel, teamOf(existing.teamId), teamOf(values.teamId)],
      ["Company Tag", existing.companyTag, values.companyTag],
      [leaderTitle, yesNo(existing.isLeader), yesNo(values.isLeader)],
    ];
    const changes = fields.flatMap(([label, before, after]) =>
      (before || null) === (after || null)
        ? []
        : [
            {
              label,
              before: before || "none",
              after: after || "none",
              cleared: !!before && !after,
            },
          ],
    );
    return claimed(
      changes.length === 0
        ? { row, kind: "unchanged", name, id: existing.id }
        : { row, kind: "update", name, id: existing.id, values, changes },
    );
  });
}

/**
 * Reads, maps and plans pasted or uploaded text, or refuses the whole file:
 * empty, over `MAX_IMPORT_SIZE`, over `MAX_IMPORT_ROWS` data rows, or with
 * no name column.
 */
export function planRosterText(
  text: string,
  context: RosterImportContext,
): RosterImportPlan {
  if (new TextEncoder().encode(text).length > MAX_IMPORT_BYTES) {
    return {
      ok: false,
      error: `That's more than ${MAX_IMPORT_SIZE}. Import fewer rows at a time.`,
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
      error:
        `That's more than ${MAX_IMPORT_ROWS} rows. ` +
        `Import at most ${MAX_IMPORT_ROWS} at a time.`,
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
    changes: entry.kind === "update" ? entry.changes.map(changeText) : [],
  }));
}

/** How many rows of each kind: the preview's summary. */
export function planCounts(entries: RosterImportEntry[]) {
  const count = (kind: RosterImportKind) =>
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
