import { describe, expect, it } from "vitest";

import {
  type AttemptFact,
  attemptSummary,
  attemptsLabel,
  attemptsOf,
  rankAttempts,
} from "@/lib/best-score/standings";

const at = (minute: number) => new Date(Date.UTC(2027, 1, 22, 12, minute));

let n = 0;
function attempt(
  participantId: string,
  teamId: string | null,
  score: number,
  minute = n,
): AttemptFact {
  n += 1;
  return {
    id: `a${String(n).padStart(2, "0")}`,
    recordedAt: at(minute),
    participantId,
    teamId,
    score,
  };
}

const higher = { betterIs: "higher", teamScore: "best-member" } as const;
const lower = { betterIs: "lower", teamScore: "best-member" } as const;
const sum = { betterIs: "higher", teamScore: "sum-of-members" } as const;

const ranks = (rows: { id: string; rank: number | null }[]) =>
  rows.map((r) => [r.id, r.rank]);

describe("rankAttempts, individual", () => {
  it("scores a person with three Attempts by their best", () => {
    const rows = rankAttempts(higher, "individual", [
      attempt("ana", "red", 12),
      attempt("ana", "red", 30),
      attempt("ana", "red", 18),
      attempt("ben", "blue", 25),
    ]);
    expect(rows.map((r) => [r.id, r.rank, r.best, r.played])).toEqual([
      ["ana", 1, 30, 3],
      ["ben", 2, 25, 1],
    ]);
  });

  it("ranks the lowest best first when lower is better, ties sharing a rank", () => {
    const rows = rankAttempts(lower, "individual", [
      attempt("ana", null, 61.5),
      attempt("ben", null, 58.25),
      attempt("cal", null, 61.5),
      attempt("ana", null, 70),
    ]);
    expect(ranks(rows)).toEqual([
      ["ben", 1],
      ["ana", 2],
      ["cal", 2],
    ]);
  });
});

describe("rankAttempts, team", () => {
  // Red: Ana 10 then 4, Dee 7; Blue: Ben 12, Eve 2.
  const attempts = () => [
    attempt("ana", "red", 10),
    attempt("ana", "red", 4),
    attempt("dee", "red", 7),
    attempt("ben", "blue", 12),
    attempt("eve", "blue", 2),
  ];

  it("Best member ranks each Team by its single best Attempt", () => {
    const rows = rankAttempts(higher, "team", attempts());
    expect(rows.map((r) => [r.id, r.rank, r.best, r.played])).toEqual([
      ["blue", 1, 12, 2],
      ["red", 2, 10, 3],
    ]);
  });

  it("Sum of members adds each member's best, so a member's lower retry doesn't count", () => {
    const rows = rankAttempts(sum, "team", attempts());
    // Red 10 + 7 = 17; Blue 12 + 2 = 14.
    expect(rows.map((r) => [r.id, r.rank, r.total, r.played])).toEqual([
      ["red", 1, 17, 3],
      ["blue", 2, 14, 2],
    ]);
  });

  it("counts an Attempt for the Team it was credited to, and none on no Team", () => {
    const rows = rankAttempts(higher, "team", [
      attempt("ana", "blue", 9),
      attempt("cal", null, 99),
    ]);
    expect(ranks(rows)).toEqual([["blue", 1]]);
  });
});

describe("attemptsOf", () => {
  it("names the counted Attempt (the earlier of a tie) and lists all newest first", () => {
    const first = attempt("ana", null, 30, 1);
    const tie = attempt("ana", null, 30, 5);
    const low = attempt("ana", null, 3, 9);
    const mine = attemptsOf(higher, "individual", [first, tie, low]).get("ana");
    expect(mine).toEqual({
      best: first.id,
      attempts: [low.id, tie.id, first.id],
    });
  });

  it("has no counted Attempt under Sum of members", () => {
    const a = attempt("ana", "red", 1, 1);
    const b = attempt("dee", "red", 2, 2);
    expect(attemptsOf(sum, "team", [a, b]).get("red")).toEqual({
      best: null,
      attempts: [b.id, a.id],
    });
  });
});

describe("attemptsLabel and attemptSummary", () => {
  it("counts the others, or every Attempt", () => {
    expect(attemptsLabel(2, "more")).toBe("2 more attempts");
    expect(attemptsLabel(1, "more")).toBe("1 more attempt");
    expect(attemptsLabel(3, "all")).toBe("3 attempts");
  });

  it("reads a name and a Score with its unit", () => {
    expect(attemptSummary("Ashley", 42, "trips")).toBe("Ashley · 42 trips");
    expect(attemptSummary("Ashley", 42, "")).toBe("Ashley · 42");
  });
});
