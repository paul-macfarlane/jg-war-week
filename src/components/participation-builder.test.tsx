// @vitest-environment happy-dom
import { act } from "react";
import { type Root, createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ParticipationBuilder } from "./participation-builder";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

// System boundaries only: the server actions, the router and the toasts.
const mocks = vi.hoisted(() => ({
  mark: vi.fn(),
  unmark: vi.fn(),
  refresh: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));
vi.mock("@/actions/participation", () => ({
  markParticipant: mocks.mark,
  unmarkParticipant: mocks.unmark,
  closeParticipation: vi.fn(),
  reopenParticipation: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock("sonner", () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess },
}));

const competition = {
  id: "c1",
  scoring: "individual" as const,
  participationPoints: 1,
  placementPoints: null,
  closed: false,
};
const roster = [{ id: "p1", name: "Ada Lovelace", team: null }];

let container: HTMLDivElement;
let root: Root;

function render(tookPart: { participantId: string; checkedIn: boolean }[]) {
  root.render(
    <ParticipationBuilder
      competition={competition}
      roster={roster}
      tookPart={tookPart}
      teamCounts={[]}
      teamLabel="Team"
    />,
  );
}
const box = () =>
  container.querySelector<HTMLElement>('[role="checkbox"]') as HTMLElement;
const settle = () => act(async () => {});

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  vi.clearAllMocks();
  // router.refresh() returns at once; the new data arrives later.
  mocks.refresh.mockReturnValue(undefined);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("ParticipationBuilder tick", () => {
  it("stays ticked after the save until the refreshed data arrives", async () => {
    mocks.mark.mockResolvedValue({ ok: true });
    await act(async () => render([]));
    expect(box().getAttribute("aria-checked")).toBe("false");

    await act(async () => box().click());
    await settle();
    expect(mocks.mark).toHaveBeenCalledWith("c1", { participantId: "p1" });
    expect(box().getAttribute("aria-checked")).toBe("true");

    await act(async () => render([{ participantId: "p1", checkedIn: false }]));
    expect(box().getAttribute("aria-checked")).toBe("true");
  });

  it("stays unticked after an untick until the refreshed data arrives", async () => {
    mocks.unmark.mockResolvedValue({ ok: true });
    await act(async () => render([{ participantId: "p1", checkedIn: false }]));
    expect(box().getAttribute("aria-checked")).toBe("true");

    await act(async () => box().click());
    await settle();
    expect(mocks.unmark).toHaveBeenCalled();
    expect(box().getAttribute("aria-checked")).toBe("false");

    await act(async () => render([]));
    expect(box().getAttribute("aria-checked")).toBe("false");
  });

  it("reverts and shows the server's reason when the server refuses", async () => {
    mocks.mark.mockResolvedValue({ ok: false, error: "Nope, too late." });
    await act(async () => render([]));

    await act(async () => box().click());
    await settle();
    expect(mocks.toastError).toHaveBeenCalledWith("Nope, too late.");
    expect(box().getAttribute("aria-checked")).toBe("false");
  });
});
