import { describe, expect, it } from "vitest";

import { buildHostOptions } from "./host-options";

const ana = { id: "p1", name: "Ana P", email: "ana@jahnelgroup.com" };

describe("buildHostOptions", () => {
  it("shows a roster Participant by name with the email beneath, selectable by email", () => {
    expect(buildHostOptions([ana], [])).toEqual([
      {
        id: "ana@jahnelgroup.com",
        label: "Ana P",
        detail: "ana@jahnelgroup.com",
      },
    ]);
  });

  it("does not let a Participant with no email be selected, and says how to fix it", () => {
    const [option] = buildHostOptions(
      [{ id: "p2", name: "Bo K", email: null }],
      [],
    );
    expect(option.disabled).toBe(true);
    expect(option.detail).toBe("Add an email in Roster");
    expect(option.id).not.toContain("@");
  });

  it("disables a non-Jahnel Group email with the reason", () => {
    const [option] = buildHostOptions(
      [{ id: "p3", name: "Cy Q", email: "cy@example.com" }],
      [],
    );
    expect(option.disabled).toBe(true);
    expect(option.detail).toBe(
      "cy@example.com · Only @jahnelgroup.com emails can sign in",
    );
  });

  it("tells two Participants named alike apart by their emails", () => {
    const options = buildHostOptions(
      [
        { id: "a", name: "Sam Lee", email: "sam.lee@jahnelgroup.com" },
        { id: "b", name: "Sam Lee", email: "samuel.lee@jahnelgroup.com" },
      ],
      [],
    );
    expect(options.map((o) => [o.label, o.detail])).toEqual([
      ["Sam Lee", "sam.lee@jahnelgroup.com"],
      ["Sam Lee", "samuel.lee@jahnelgroup.com"],
    ]);
    expect(new Set(options.map((o) => o.id)).size).toBe(2);
  });

  it("matches a current Host to the roster whatever the email's case", () => {
    const options = buildHostOptions([ana], ["ANA@jahnelgroup.com"]);
    expect(options).toHaveLength(1);
    expect(options[0].label).toBe("Ana P");
  });

  it("keeps a current Host who is off the roster as a warned, selectable entry", () => {
    const options = buildHostOptions([ana], ["gone@jahnelgroup.com"]);
    expect(options).toContainEqual({
      id: "gone@jahnelgroup.com",
      label: "gone@jahnelgroup.com (not on the roster)",
      detail: "Not on the roster",
    });
    expect(
      options.find((o) => o.id === "gone@jahnelgroup.com")?.disabled,
    ).toBeUndefined();
  });
});
