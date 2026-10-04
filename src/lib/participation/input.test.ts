import { describe, expect, it } from "vitest";

import { parseMarkInput } from "@/lib/participation/input";

describe("parseMarkInput", () => {
  it("reads a Participant id", () => {
    const id = "6f1c2f1e-8a49-4c38-9a4a-0d6f1f3c2b10";
    expect(parseMarkInput({ participantId: id })).toEqual({
      ok: true,
      value: { participantId: id },
    });
  });

  it("refuses anything else", () => {
    expect(parseMarkInput({ participantId: "x" })).toEqual({
      ok: false,
      error: "That Participant no longer exists.",
    });
    expect(parseMarkInput("x")).toMatchObject({ ok: false });
  });
});
