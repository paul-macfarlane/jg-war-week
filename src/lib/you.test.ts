import { describe, expect, it } from "vitest";

import { resolveYou } from "@/lib/you";

const participants = [
  { id: "p-ada", email: "Ada@JahnelGroup.com" },
  { id: "p-bob", email: null },
  { id: "p-cy", email: "cy@jahnelgroup.com" },
];

describe("resolveYou", () => {
  it("links the session email to a Participant, ignoring case", () => {
    expect(
      resolveYou({ sessionEmail: " ada@jahnelgroup.COM ", participants }),
    ).toEqual({ participantId: "p-ada" });
  });

  it("is nobody when the email matches no Participant", () => {
    expect(
      resolveYou({
        sessionEmail: "someone-else@jahnelgroup.com",
        participants,
      }),
    ).toBeNull();
  });

  it("is nobody with no session email", () => {
    expect(resolveYou({ sessionEmail: null, participants })).toBeNull();
  });

  it("never matches a blank session email to a Participant with no email", () => {
    expect(resolveYou({ sessionEmail: "", participants })).toBeNull();
  });
});
