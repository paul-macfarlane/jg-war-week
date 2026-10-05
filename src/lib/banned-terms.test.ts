// The banned-term scan: no retired or banned word reaches UI copy or MCP
// output. It reads every non-test `.ts`/`.tsx` file under `src/` and checks
// the text a person or an MCP client can see — string literals, template
// literal text and JSX text — and, under `src/mcp/`, the property names
// that become an MCP tool's output fields. Never other identifiers or
// comments (CONTEXT.md, "Banned terms"; spec competition-results,
// decisions 10 and 11).
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const SRC = path.resolve(__dirname, "..");

type Term = { term: string; pattern: RegExp; instead: string };

const TERMS: Term[] = [
  { term: "Heat", pattern: /\bheats?\b/i, instead: "Match" },
  { term: "Game", pattern: /\bgames?\b/i, instead: "Match or Attempt" },
  { term: "Champion", pattern: /\bchampions?\b/i, instead: "Winner" },
  {
    term: "Finalize",
    pattern: /\b(un-?)?finali[sz]\w*/i,
    instead: "Close / Closed / Reopen",
  },
  { term: "Event", pattern: /\bevents?\b/i, instead: "Competition" },
  { term: "Member", pattern: /\bmembers?\b/i, instead: "Participant" },
  { term: "ELO", pattern: /\belo\b/i, instead: "Points" },
  { term: "Placeholder", pattern: /\bplaceholders?\b/i, instead: "stub" },
  { term: "Tournament", pattern: /\btournaments?\b/i, instead: "Competition" },
  { term: "News", pattern: /\bnews\b/i, instead: "Announcement" },
  {
    // "Admin" names only the /admin area; a person is an Organizer or Host.
    term: "Admin",
    pattern: /\b(admins|an admin|admin (user|role|person|people|account)s?)\b/i,
    instead: "Organizer or Host",
  },
];

type Allowed = {
  file: string;
  term: string;
  /** Part of the one literal allowed: only a literal containing it passes. */
  text: string;
  reason: string;
};

// A literal allowed to keep a banned term, one literal in one file for one
// term. Keep the mechanism for the next exception.
const ALLOWLIST: Allowed[] = [
  {
    file: "src/lib/best-score/config.ts",
    term: "Member",
    text: "Best member",
    reason:
      "Spec R21 decision 13 names the Team score setting's options Best member and Sum of members.",
  },
  {
    file: "src/lib/best-score/config.ts",
    term: "Member",
    text: "Sum of members",
    reason:
      "Spec R21 decision 13 names the Team score setting's options Best member and Sum of members.",
  },
];

// Property names under here are MCP output fields (and its input
// schemas), which an MCP client reads as words.
const MCP_DIR = "src/mcp/";

// Lowercase path segments ("/admin", "/xii/competitions/games-night") are
// routes and URLs, not copy; no route is renamed (decision 10).
const PATH = /\/[a-z0-9\-[\]._:]*/g;

// A literal shaped like a name, all lowercase with no spaces ("games.log",
// "bracket.heat-result", "heat", "best_score"), is a permission key, enum
// value, id or query key, not copy. Capitalized words are still copy.
const KEY = /^[a-z0-9_.:\-/[\]#=]+$/;

// Tailwind tokens and DOM attribute names that contain a banned word.
const STYLE = /\b(pointer-events-[a-z]+|placeholder:|data-placeholder)/g;

// The one sanctioned use of "admins": the company's administrators on the
// Privacy and Terms pages (CONTEXT.md, "Banned terms").
const JG_ADMINS = /the\s+Jahnel\s+Group\s+admins/gi;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    if (!/\.tsx?$/.test(entry.name) || /\.test\.tsx?$/.test(entry.name)) {
      return [];
    }
    return [full];
  });
}

function isSkipped(node: ts.Node): boolean {
  const parent = node.parent;
  if (!parent) return false;
  // Module specifiers: `import … from "…"`, `export … from "…"`.
  if (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)) {
    return true;
  }
  if (ts.isExternalModuleReference(parent) || ts.isImportTypeNode(parent)) {
    return true;
  }
  // Object keys and element access by key are names, not copy.
  if (
    (ts.isPropertyAssignment(parent) || ts.isPropertySignature(parent)) &&
    parent.name === node
  ) {
    return true;
  }
  // `className` values are style tokens.
  if (
    ts.isJsxAttribute(parent) &&
    ts.isIdentifier(parent.name) &&
    parent.name.text === "className"
  ) {
    return true;
  }
  return false;
}

/** Every piece of visible text in a file, with its line. */
export function visibleText(
  fileName: string,
  source: string,
): { line: number; text: string }[] {
  const file = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const out: { line: number; text: string }[] = [];
  const add = (node: ts.Node, text: string) => {
    if (!text.trim()) return;
    const { line } = file.getLineAndCharacterOfPosition(node.getStart(file));
    out.push({ line: line + 1, text });
  };
  const visit = (node: ts.Node) => {
    // A literal used as a type ("bracket" | "games") is not copy.
    if (ts.isLiteralTypeNode(node)) return;
    if (
      (ts.isStringLiteral(node) ||
        ts.isNoSubstitutionTemplateLiteral(node) ||
        ts.isTemplateHead(node) ||
        ts.isTemplateMiddle(node) ||
        ts.isTemplateTail(node)) &&
      !isSkipped(node)
    ) {
      add(node, node.text);
    } else if (ts.isJsxText(node)) {
      add(node, node.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return out;
}

/**
 * Every property name a file declares (object literal keys, shorthand
 * properties and type members), with its line: in `src/mcp/` these are the
 * fields of a tool's output.
 */
export function propertyNames(
  fileName: string,
  source: string,
): { line: number; text: string }[] {
  const file = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const out: { line: number; text: string }[] = [];
  const visit = (node: ts.Node) => {
    if (
      ts.isPropertyAssignment(node) ||
      ts.isShorthandPropertyAssignment(node) ||
      ts.isPropertySignature(node) ||
      ts.isPropertyDeclaration(node)
    ) {
      const name = node.name;
      if (ts.isIdentifier(name) || ts.isStringLiteral(name)) {
        const { line } = file.getLineAndCharacterOfPosition(
          name.getStart(file),
        );
        out.push({ line: line + 1, text: name.text });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return out;
}

/** Whether an allowlist entry lets this one literal keep `term`. */
export function isAllowed(
  allowlist: Allowed[],
  file: string,
  term: string,
  text: string,
): boolean {
  return allowlist.some(
    (a) => a.file === file && a.term === term && text.includes(a.text),
  );
}

/**
 * The banned words in some files' copy and, under `src/mcp/`, property
 * names, one line per hit. `rel` is the path from the repository root.
 */
export function scan(
  files: { rel: string; source: string }[],
  allowlist: Allowed[],
): string[] {
  const found: string[] = [];
  for (const { rel, source } of files) {
    const copyText = visibleText(rel, source).filter(
      ({ text }) => !KEY.test(text.trim()),
    );
    // A key is a name, so the KEY shape doesn't excuse it.
    const keys = rel.startsWith(MCP_DIR) ? propertyNames(rel, source) : [];
    for (const { line, text } of [...copyText, ...keys]) {
      const copy = text
        .replace(STYLE, " ")
        .replace(PATH, " ")
        .replace(JG_ADMINS, " ");
      for (const { term, pattern, instead } of TERMS) {
        const hit = copy.match(pattern);
        if (!hit) continue;
        if (isAllowed(allowlist, rel, term, text)) continue;
        found.push(
          `${rel}:${line} "${hit[0]}" (${term}; use ${instead}) in ${JSON.stringify(text.trim().slice(0, 80))}`,
        );
      }
    }
  }
  return found;
}

function violations(): string[] {
  const root = path.resolve(SRC, "..");
  return scan(
    sourceFiles(SRC).map((full) => ({
      rel: path.relative(root, full).split(path.sep).join("/"),
      source: readFileSync(full, "utf8"),
    })),
    ALLOWLIST,
  );
}

describe("banned-term scan", () => {
  it("finds no banned or retired word in UI copy or MCP output", () => {
    expect(violations().join("\n")).toBe("");
  });

  it("reads string literals, template text and JSX text, not names or comments", () => {
    const text = visibleText(
      "x.tsx",
      [
        'import { Heat } from "@/lib/heat";',
        "// a Heat comment",
        "const heat = { heat: 1 };",
        'const a = "Heat one";',
        "const b = `Log a ${heat} Game`;",
        'const c = <p className="heat">Champion</p>;',
        'type T = "finalized";',
      ].join("\n"),
    ).map((t) => t.text.trim());
    expect(text).toEqual(["Heat one", "Log a", "Game", "Champion"]);
  });

  it("reads property names under src/mcp/ as MCP output, and nowhere else", () => {
    const source = [
      "export const out = { finalized: true, games: [], name: 'Cup' };",
      "type Bracket = { heats: string[]; champion: string | null };",
      "const winner = 1; export const short = { winner };",
    ].join("\n");
    expect(scan([{ rel: "src/mcp/x.ts", source }], [])).toEqual([
      'src/mcp/x.ts:1 "finalized" (Finalize; use Close / Closed / Reopen) in "finalized"',
      'src/mcp/x.ts:1 "games" (Game; use Match or Attempt) in "games"',
      'src/mcp/x.ts:2 "heats" (Heat; use Match) in "heats"',
      'src/mcp/x.ts:2 "champion" (Champion; use Winner) in "champion"',
    ]);
    expect(scan([{ rel: "src/lib/x.ts", source }], [])).toEqual([]);
  });

  it("lets an allowlist entry pass only the literal it names", () => {
    const source = [
      'const a = "finalized needs finalizedAt";',
      'const b = "Finalize the sheet";',
    ].join("\n");
    const allowed: Allowed[] = [
      {
        file: "src/lib/x.ts",
        term: "Finalize",
        text: "finalized needs",
        reason: "test",
      },
    ];
    expect(scan([{ rel: "src/lib/x.ts", source }], allowed)).toEqual([
      'src/lib/x.ts:2 "Finalize" (Finalize; use Close / Closed / Reopen) in "Finalize the sheet"',
    ]);
    expect(
      scan(
        [{ rel: "src/lib/y.ts", source: 'const a = "finalized needs";' }],
        allowed,
      ),
    ).toHaveLength(1);
  });

  it("keeps the allowlist short and explained", () => {
    expect(ALLOWLIST.length).toBeLessThanOrEqual(10);
    for (const entry of ALLOWLIST) {
      expect(entry.reason).not.toBe("");
      expect(entry.text).not.toBe("");
    }
  });
});
