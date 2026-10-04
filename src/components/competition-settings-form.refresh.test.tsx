// @vitest-environment happy-dom
import { act } from "react";
import { type Root, createRoot } from "react-dom/client";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  type CompetitionSettingsSource,
  settingsValuesOf,
} from "@/lib/competition-page";

import { CompetitionSettingsForm } from "./competition-settings-form";

vi.mock("@/actions/setup", () => ({
  saveCompetitionSetting: vi.fn(async () => ({ ok: true })),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
}));

const SOURCE: CompetitionSettingsSource = {
  name: "Bouncy Pong",
  description: null,
  competitionGroup: null,
  hosts: [],
  placementPoints: [3, 2, 1],
  participationPoints: null,
  format: "best-score",
  scoring: "individual",
  countsTowardTeam: false,
  scoreDirection: "higher",
  scoreUnit: null,
  seriesConfig: null,
  bestScoreConfig: { teamScore: "best-member" },
  bracketConfig: null,
  selfEnroll: false,
  entrantLimit: null,
  selfReport: false,
  selfCheckIn: false,
  maxAttempts: null,
};

const actGlobal = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
let previousActEnvironment: boolean | undefined;
let host: HTMLDivElement;
let root: Root;

beforeAll(() => {
  previousActEnvironment = actGlobal.IS_REACT_ACT_ENVIRONMENT;
  actGlobal.IS_REACT_ACT_ENVIRONMENT = true;
});

afterAll(() => {
  actGlobal.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

function show(over: Partial<CompetitionSettingsSource>) {
  act(() =>
    root.render(
      <CompetitionSettingsForm
        competitionId="c1"
        initial={settingsValuesOf({ ...SOURCE, ...over })}
        facts={{
          format: "placement",
          hasResult: false,
          hasPlay: false,
          hasLogged: false,
          hasMatchResult: false,
          closed: false,
        }}
        mode="teams"
        teamLabel="Team"
        groupSuggestions={[]}
        canAssignHosts
        hostNames={[]}
        entrantCount={0}
      />,
    ),
  );
}

function mount(over: Partial<CompetitionSettingsSource>) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  show(over);
}

const input = (id: string) => host.querySelector<HTMLInputElement>(`#${id}`)!;

function type(field: HTMLInputElement, value: string) {
  // React tracks the value; set it through the native setter, then fire input.
  const set = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )!.set!;
  act(() => {
    set.call(field, value);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

const unit = (value: string) => ({ scoreUnit: value || null });

describe("CompetitionSettingsForm after a save (forms follow server data)", () => {
  it("shows the saved values when the page's props change (router.refresh)", () => {
    mount(unit(""));
    expect(input("competition-scoreUnit").value).toBe("");
    show({ ...unit("trips"), name: "Bouncier Pong" });
    expect(input("competition-scoreUnit").value).toBe("trips");
    expect(input("competition-name").value).toBe("Bouncier Pong");
  });

  it("keeps an edit when the page re-renders with the same saved props", () => {
    mount(unit("trips"));
    type(input("competition-scoreUnit"), "laps");
    show(unit("trips"));
    expect(input("competition-scoreUnit").value).toBe("laps");
  });

  it("keeps an edit still waiting to save while another field follows the server", () => {
    mount(unit("trips"));
    type(input("competition-scoreUnit"), "laps");
    show({ ...unit("trips"), name: "Bouncier Pong" });
    expect(input("competition-scoreUnit").value).toBe("laps");
    expect(input("competition-name").value).toBe("Bouncier Pong");
  });
});
