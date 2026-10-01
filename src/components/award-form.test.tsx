import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { AwardForm } from "./award-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
}));
vi.mock("@/actions/awards", () => ({
  createAward: vi.fn(),
  updateAward: vi.fn(),
}));

const options = {
  teams: [{ id: "team-red", name: "Red" }],
  participants: [],
};

function render(
  mode: "teams" | "free-for-all",
  initial?: { teamId: string | null },
) {
  return renderToStaticMarkup(
    <AwardForm
      warWeekId="ww"
      options={options}
      teamLabel="House"
      mode={mode}
      {...(initial && {
        awardId: "award",
        initial: {
          name: "MVP",
          description: "",
          participantIds: [],
          ...initial,
        },
      })}
    />,
  );
}

describe("AwardForm Team field", () => {
  it("shows the Team Label field in a teams War Week", () => {
    const html = render("teams");
    expect(html).toContain('id="award-team"');
    expect(html).toContain(">House</label>");
  });

  it("hides it in a free-for-all with no Team on the Award", () => {
    const html = render("free-for-all");
    expect(html).not.toContain('id="award-team"');
    expect(html).not.toContain(">House</label>");
  });

  it("hides it when editing a free-for-all Award without a Team", () => {
    expect(render("free-for-all", { teamId: null })).not.toContain(
      'id="award-team"',
    );
  });

  it("keeps it when a free-for-all edits an Award that has a Team", () => {
    const html = render("free-for-all", { teamId: "team-red" });
    expect(html).toContain('id="award-team"');
    expect(html).toContain(">House</label>");
  });
});

describe("AwardForm Recipients copy", () => {
  it("names the Team Label when the Team field shows", () => {
    const html = render("teams");
    expect(html).toContain("A House, Participants, or both.");
    expect(html).toContain('placeholder="Find by name or House"');
  });

  it("drops it when the Team field is hidden", () => {
    const html = render("free-for-all");
    expect(html).not.toContain("House");
    expect(html).toContain("Participants only.");
    expect(html).toContain('placeholder="Find by name"');
  });

  it("keeps it when a free-for-all edits an Award that has a Team", () => {
    const html = render("free-for-all", { teamId: "team-red" });
    expect(html).toContain("A House, Participants, or both.");
  });
});
