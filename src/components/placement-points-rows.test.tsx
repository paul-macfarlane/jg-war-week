// @vitest-environment happy-dom
import { useState } from "react";
import { act } from "react";
import { type Root, createRoot } from "react-dom/client";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { parsePlacementPointsText } from "@/lib/placement-points";

import { PlacementPointsRows } from "./placement-points-rows";

const actGlobal = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
let previousActEnvironment: boolean | undefined;
let host: HTMLDivElement;
let root: Root;
/** The text the form would post, as the Competition action parses it. */
const form = { saved: "" };

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

function Form({ limit }: { limit: number | null }) {
  const [value, setValue] = useState("");
  return (
    <PlacementPointsRows
      value={value}
      limit={limit}
      onChange={(next) => {
        form.saved = next;
        setValue(next);
      }}
    />
  );
}

function mount(limit: number | null) {
  form.saved = "";
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root.render(<Form limit={limit} />));
}

const button = (name: string) =>
  [...host.querySelectorAll("button")].find((b) => b.textContent === name)!;
const inputs = () => [...host.querySelectorAll("input")];

function type(input: HTMLInputElement, value: string) {
  const set = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )!.set!;
  act(() => {
    set.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function click(element: Element) {
  act(() => element.dispatchEvent(new MouseEvent("click", { bubbles: true })));
}

describe("PlacementPointsRows", () => {
  it("adds 20 places and saves them all", () => {
    mount(null);
    for (let place = 1; place <= 20; place++) {
      click(button("Add place"));
      type(inputs()[place - 1], String(21 - place));
    }

    expect(inputs()).toHaveLength(20);
    const parsed = parsePlacementPointsText(form.saved);
    expect(parsed).toEqual({
      ok: true,
      value: Array.from({ length: 20 }, (_, i) => 20 - i),
    });
    expect(host.textContent).not.toContain("cover at most");
  });

  it("removes any place, not just the last", () => {
    mount(null);
    for (const points of ["5", "3", "1"]) {
      click(button("Add place"));
      type(inputs().at(-1)!, points);
    }

    click(host.querySelector('[aria-label="Remove 2nd place"]')!);

    expect(form.saved).toBe("5, 1");
    expect(inputs()).toHaveLength(2);
  });

  it("stops offering Add place at the Format's limit and says so past it", () => {
    mount(2);
    click(button("Add place"));
    click(button("Add place"));
    expect(inputs()).toHaveLength(2);
    expect(
      [...host.querySelectorAll("button")].some(
        (b) => b.textContent === "Add place",
      ),
    ).toBe(false);
  });
});
