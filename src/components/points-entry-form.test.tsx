import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { PointsEntryForm } from "./points-entry-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
}));
vi.mock("@/actions/points-entries", () => ({
  createPointsEntry: vi.fn(),
  updatePointsEntry: vi.fn(),
}));

const options = { competitions: [], teams: [], participants: [] };

function render(mode: "teams" | "free-for-all") {
  return renderToStaticMarkup(
    <PointsEntryForm options={options} teamLabel="House" mode={mode} />,
  );
}

describe("PointsEntryForm target field before a Competition is chosen", () => {
  it("reads Participant in a free-for-all War Week", () => {
    const html = render("free-for-all");
    expect(html).toContain('aria-label="Participant"');
    expect(html).not.toContain("House");
  });

  it("reads the Team Label in a teams War Week", () => {
    const html = render("teams");
    expect(html).toContain('aria-label="House"');
    expect(html).toContain(">House</label>");
  });
});
