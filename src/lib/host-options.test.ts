import { describe, expect, it } from "vitest";

import { buildHostOptions } from "./host-options";

describe("buildHostOptions", () => {
  it("offers every roster Participant by name, keyed by Participant id", () => {
    expect(
      buildHostOptions([
        { id: "p1", name: "Ana P", cantSignIn: false },
        { id: "p2", name: "Bo K", cantSignIn: false },
      ]),
    ).toEqual([
      { id: "p1", label: "Ana P" },
      { id: "p2", label: "Bo K" },
    ]);
  });

  it("keeps a Participant with no email selectable, with no marker", () => {
    const [option] = buildHostOptions([
      { id: "p2", name: "Bo K", cantSignIn: false },
    ]);
    expect(option.detail).toBeUndefined();
  });

  it("keeps a non-Jahnel Group Participant selectable, marked Can't sign in, without the email", () => {
    const [option] = buildHostOptions([
      { id: "p3", name: "Cy Q", cantSignIn: true },
    ]);
    expect(option).toEqual({
      id: "p3",
      label: "Cy Q",
      detail: "Can't sign in",
    });
    expect(JSON.stringify(option)).not.toContain("@");
  });
});
