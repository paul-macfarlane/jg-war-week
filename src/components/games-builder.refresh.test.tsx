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

import type { GamesConfig } from "@/lib/games/config";

import { GamesBuilder } from "./games-builder";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
}));

type Props = Parameters<typeof GamesBuilder>[0];

function competition(config: GamesConfig): Props["competition"] {
  return {
    id: "c1",
    name: "Bouncy Pong",
    scoring: "individual",
    gameType: "ranked",
    config,
    entrantsOpen: true,
    loggingClosesAt: null,
    closed: false,
    placementPoints: [3, 2, 1],
    bestOfDecided: false,
    bestOfWinner: null,
  };
}

const props = {
  entrants: [],
  teams: [],
  participants: [],
  enroll: { selfEnroll: false, entrantLimit: null, enrollClosesAt: null },
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

function mount(config: GamesConfig) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  show(config);
}

function show(config: GamesConfig) {
  act(() =>
    root.render(<GamesBuilder {...props} competition={competition(config)} />),
  );
}

const field = () =>
  host.querySelector<HTMLInputElement>("#games-finish-points")!;

function type(input: HTMLInputElement, value: string) {
  // React tracks the value; set it through the native setter, then fire input.
  const set = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )!.set!;
  act(() => {
    set.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("GamesBuilder after a save", () => {
  it("shows the saved Finish Points when the page's props change (router.refresh)", () => {
    mount({ finishPoints: [] });
    expect(field().value).toBe("");
    show({ finishPoints: [5, 3, 1] });
    expect(field().value).toBe("5, 3, 1");
  });

  it("keeps an edit when the page re-renders with the same saved props", () => {
    mount({ finishPoints: [5, 3, 1] });
    type(field(), "9, 4");
    expect(field().value).toBe("9, 4");
    show({ finishPoints: [5, 3, 1] });
    expect(field().value).toBe("9, 4");
  });
});
