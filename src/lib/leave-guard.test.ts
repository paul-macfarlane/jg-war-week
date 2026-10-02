import { describe, expect, it } from "vitest";

import { type LinkClick, leavingHref } from "./leave-guard";

const HERE = "https://warweek.example/admin/settings";

/** A plain left click on a same-tab link to `href`. */
function click(href: string, overrides: Partial<LinkClick> = {}): LinkClick {
  return {
    href,
    target: "",
    download: false,
    button: 0,
    modified: false,
    defaultPrevented: false,
    ...overrides,
  };
}

describe("leavingHref", () => {
  it("returns the in-app path a plain click on a same-origin link opens", () => {
    expect(
      leavingHref(click("https://warweek.example/admin/points?x=1#a"), HERE),
    ).toBe("/admin/points?x=1#a");
  });

  it("ignores a link to another site", () => {
    expect(leavingHref(click("https://slack.example/x"), HERE)).toBeNull();
  });

  it("ignores clicks that open somewhere else or aren't navigation", () => {
    const away = "https://warweek.example/admin/points";
    expect(leavingHref(click(away, { modified: true }), HERE)).toBeNull();
    expect(leavingHref(click(away, { button: 1 }), HERE)).toBeNull();
    expect(leavingHref(click(away, { target: "_blank" }), HERE)).toBeNull();
    expect(leavingHref(click(away, { download: true }), HERE)).toBeNull();
    expect(
      leavingHref(click(away, { defaultPrevented: true }), HERE),
    ).toBeNull();
  });

  it("ignores a link to this same page, a hash on it included", () => {
    expect(leavingHref(click(HERE), HERE)).toBeNull();
    expect(leavingHref(click(`${HERE}#links`), HERE)).toBeNull();
  });
});
