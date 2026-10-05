import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { matches } from "@/lib/bracket/groups";

import { BracketRoundEditor } from "./bracket-round-editor";
import type { BracketViewEntrant } from "./entrant-mark";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
}));
vi.mock("@/actions/brackets", () => ({
  moveMatchEntrant: vi.fn(),
  setMatchAdvance: vi.fn(),
  setRoundDefaults: vi.fn(),
}));
// The editor's title and description are Dialog parts; render them bare.
vi.mock("@/components/responsive-sheet-dialog", () => ({
  ResponsiveSheetDialogHeader: ({
    children,
  }: {
    children: React.ReactNode;
  }) => <header>{children}</header>,
  ResponsiveSheetDialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
  ResponsiveSheetDialogDescription: ({
    children,
  }: {
    children: React.ReactNode;
  }) => <p>{children}</p>,
}));

const group = Array.from({ length: 11 }, (_, i) => ({
  id: `g${i + 1}`,
  seedPosition: i + 1,
  label: `P${i + 1}`,
}));
const byId = new Map<string, BracketViewEntrant>(
  group.map((e) => [
    e.id,
    {
      id: e.id,
      label: e.label,
      color: "#f00",
      teamId: null,
      participantId: e.id,
      squadId: null,
      participantNames: [],
    },
  ]),
);
const eleven = matches.generate(
  {
    kind: "group",
    entrantsPerMatch: 4,
    advancePerMatch: 2,
    thirdPlaceMatch: false,
    rounds: {},
  },
  group,
  (round, position) => `r${round}h${position}`,
);

function render(bracket = eleven, round = 1) {
  return renderToStaticMarkup(
    <BracketRoundEditor
      competitionId="c1"
      bracket={bracket}
      round={round}
      entrantsById={byId}
    />,
  );
}

describe("BracketRoundEditor", () => {
  it("edits each Match's advancing and moves each Entrant within the Round", () => {
    const html = render();
    expect(html).toContain("Edit Round 1");
    for (const n of [1, 2, 3]) {
      expect(html).toContain(`How many advance from Round 1 Match ${n}`);
    }
    // One move per Entrant: 3 + 4 + 4.
    expect(html.match(/aria-label="Move P\d+ to"/g)).toHaveLength(11);
    expect(html).not.toContain("Editing a round is locked");
    expect(html).toMatch(/<button[^>]*>Save Round defaults<\/button>/);
  });

  it("shows why a Round with a result is locked, every control disabled", () => {
    const played = matches.applyResult(eleven, "r1h1", {
      order: ["g1", "g6", "g7"],
    });
    const html = render(played);
    expect(html).toContain(
      "Editing a round is locked once any Match in it has a result.",
    );
    const triggers = [
      ...html.matchAll(/<button[^>]*(?:aria-label|id)="[^"]*"[^>]*>/g),
    ].map((m) => m[0]);
    expect(triggers.length).toBeGreaterThan(0);
    for (const trigger of triggers) expect(trigger).toMatch(/disabled/);
  });

  it("offers only the Round defaults for the Final", () => {
    const html = render(eleven, 3);
    expect(html).toContain("Edit Final");
    expect(html).toContain("Round defaults");
    expect(html).not.toContain("How many advance from");
  });
});
