import { describe, expect, it } from "vitest";

import { buildHostOptions } from "./host-options";

describe("buildHostOptions", () => {
  it("offers every roster Participant by name, keyed by Participant id", () => {
    expect(
      buildHostOptions([
        { id: "p1", name: "Ana P", cantSignIn: false },
        { id: "p2", name: "Bo K", cantSignIn: false },
      ]).map(({ id, name }) => ({ id, name })),
    ).toEqual([
      { id: "p1", name: "Ana P" },
      { id: "p2", name: "Bo K" },
    ]);
  });

  it("keeps a Participant with no email selectable, with no marker", () => {
    const [option] = buildHostOptions([
      { id: "p2", name: "Bo K", cantSignIn: false },
    ]);
    expect(option.note).toBeUndefined();
  });

  it("keeps a non-Jahnel Group Participant selectable, marked Can't sign in, without the email", () => {
    const [option] = buildHostOptions([
      { id: "p3", name: "Cy Q", cantSignIn: true },
    ]);
    expect(option).toMatchObject({
      id: "p3",
      name: "Cy Q",
      note: "Can't sign in",
    });
    expect(JSON.stringify(option)).not.toContain("@");
  });

  it("carries the picture and Team the picker shows", () => {
    const [option] = buildHostOptions([
      {
        id: "p4",
        name: "Di R",
        image: "https://example.test/d.png",
        teamName: "Red",
        teamColor: "#ff0000",
        cantSignIn: false,
      },
    ]);
    expect(option).toMatchObject({
      image: "https://example.test/d.png",
      teamName: "Red",
      teamColor: "#ff0000",
    });
  });
});
