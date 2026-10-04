import { describe, expect, it } from "vitest";

import { rejectNonJahnelGroup } from "./reject-non-jahnel-group";

describe("rejectNonJahnelGroup (the sign-in domain rule)", () => {
  it("lets a @jahnelgroup.com email sign in", () => {
    expect(() => rejectNonJahnelGroup("tony@jahnelgroup.com")).not.toThrow();
  });

  it("rejects a Participant who hosts a Competition but whose roster email isn't @jahnelgroup.com (ADR 0012)", () => {
    // Tony can be picked as a Host with this roster email; he still can't sign in.
    expect(() => rejectNonJahnelGroup("tony@gmail.com")).toThrow(
      /Only @jahnelgroup.com accounts can sign in/,
    );
  });

  it("rejects a missing email", () => {
    expect(() => rejectNonJahnelGroup(null)).toThrow();
  });
});
