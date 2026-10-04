// The banned-term scan: no retired or banned word reaches UI copy or MCP
// output. It reads every non-test `.ts`/`.tsx` file under `src/` and checks
// the text a person or an MCP client can see — string literals, template
// literal text and JSX text — never identifiers or comments (CONTEXT.md,
// "Banned terms"; spec competition-results, decisions 10 and 11).
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
  { term: "League", pattern: /\bleagues?\b/i, instead: "War Week" },
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

// Old words that stay until spec B renames the tables and columns. Spec B
// deletes this list. Each entry is one file and one term; keep it short.
const ALLOWLIST: { file: string; term: string; reason: string }[] = [
  {
    file: "src/lib/setup.ts",
    term: "Finalize",
    reason:
      "spec B: names the seed file's `finalized` field, which mirrors the finalized_at column",
  },
  {
    file: "src/seed/schema.ts",
    term: "Finalize",
    reason:
      "spec B: names the seed file's `finalized` field, which mirrors the finalized_at column",
  },
];

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

function violations(): string[] {
  const found: string[] = [];
  for (const full of sourceFiles(SRC)) {
    const rel = path.relative(path.resolve(SRC, ".."), full);
    for (const { line, text } of visibleText(
      full,
      readFileSync(full, "utf8"),
    )) {
      if (KEY.test(text.trim())) continue;
      const copy = text
        .replace(STYLE, " ")
        .replace(PATH, " ")
        .replace(JG_ADMINS, " ");
      for (const { term, pattern, instead } of TERMS) {
        const hit = copy.match(pattern);
        if (!hit) continue;
        if (ALLOWLIST.some((a) => a.file === rel && a.term === term)) continue;
        found.push(
          `${rel}:${line} "${hit[0]}" (${term}; use ${instead}) in ${JSON.stringify(text.trim().slice(0, 80))}`,
        );
      }
    }
  }
  return found;
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

  it("keeps the allowlist short and explained", () => {
    expect(ALLOWLIST.length).toBeLessThanOrEqual(10);
    for (const entry of ALLOWLIST) expect(entry.reason).not.toBe("");
  });
});
