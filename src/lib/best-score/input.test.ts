import { describe, expect, it } from "vitest";

import {
  parseAttemptInput,
  postedAttemptParticipantId,
} from "@/lib/best-score/input";

const ANA = "00000000-0000-4000-8000-00000000000a";

describe("parseAttemptInput", () => {
  it("takes a Participant and a numeric Score", () => {
    expect(parseAttemptInput({ player: ANA, score: " 42.125 " })).toEqual({
      ok: true,
      value: { participantId: ANA, score: 42.125 },
    });
  });

  it("refuses a missing Participant, a blank or non-numeric Score, and too many decimals", () => {
    expect(parseAttemptInput({ score: 1 })).toMatchObject({
      ok: false,
      error: "Choose a Participant.",
    });
    expect(parseAttemptInput({ player: ANA, score: "" })).toMatchObject({
      ok: false,
      error: "Enter a score.",
    });
    expect(parseAttemptInput({ player: ANA, score: "fast" })).toMatchObject({
      ok: false,
      error: "Enter a score.",
    });
    expect(parseAttemptInput({ player: ANA, score: 1.2345 })).toMatchObject({
      ok: false,
      error: "A score has at most 3 decimal places.",
    });
  });
});

describe("postedAttemptParticipantId", () => {
  it("reads `player`, else null", () => {
    expect(postedAttemptParticipantId({ player: ANA })).toBe(ANA);
    expect(postedAttemptParticipantId({ playerA: ANA })).toBeNull();
  });
});
