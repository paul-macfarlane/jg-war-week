import { afterEach, describe, expect, it, vi } from "vitest";

import {
  checkIn,
  checkOut,
  closeParticipation,
  markParticipant,
  reopenParticipation,
  setParticipationSettings,
  unmarkParticipant,
} from "@/actions/participation";

const { ID, PARTICIPANT, WAR_WEEK, authorized } = vi.hoisted(() => ({
  ID: "22222222-2222-4222-8222-222222222222",
  PARTICIPANT: "44444444-4444-4444-8444-444444444444",
  WAR_WEEK: "11111111-1111-4111-8111-111111111111",
  /** What the mocked authorize steps return; each test sets it. */
  authorized: { current: {} as Record<string, unknown> },
}));

const CTX = { warWeekId: WAR_WEEK, actorEmail: "neo@jahnelgroup.com" };
const OK = {
  ok: true,
  actor: { email: "neo@jahnelgroup.com", isOrganizer: false, hosts: [] },
  warWeek: { id: WAR_WEEK, edition: "xi" },
  ctx: CTX,
};
const REFUSED = { ok: false, error: "Only the Host can do that." };

const revalidatePath = vi.hoisted(() => vi.fn());
vi.mock("next/cache", () => ({ revalidatePath }));
const authorize = vi.hoisted(() => vi.fn(async () => authorized.current));
const authorizeCheckIn = vi.hoisted(() =>
  vi.fn(async () => authorized.current),
);
vi.mock("@/auth/authorize", () => ({ authorize, authorizeCheckIn }));
vi.mock("@/mutations/participation", () => ({
  setParticipationSettings: vi.fn(async () => ({ ok: true })),
  markParticipant: vi.fn(async () => ({ ok: true })),
  unmarkParticipant: vi.fn(async () => ({ ok: true })),
  closeParticipation: vi.fn(async () => ({ ok: true })),
  reopenParticipation: vi.fn(async () => ({ ok: true })),
  checkIn: vi.fn(async () => ({ ok: true })),
  checkOut: vi.fn(async () => ({ ok: true })),
}));

afterEach(() => {
  vi.clearAllMocks();
});

const settings = {
  participationPoints: "2",
  teamScoring: "",
  placementPoints: "",
  selfCheckIn: true,
  checkInClosesAt: "",
};

describe("the Host actions", () => {
  const cases: [string, string, () => Promise<unknown>, string][] = [
    [
      "setParticipationSettings",
      "participation.settings",
      () => setParticipationSettings(ID, settings),
      "setParticipationSettings",
    ],
    [
      "markParticipant",
      "participation.mark",
      () => markParticipant(ID, { participantId: PARTICIPANT }),
      "markParticipant",
    ],
    [
      "unmarkParticipant",
      "participation.mark",
      () => unmarkParticipant(ID, { participantId: PARTICIPANT }),
      "unmarkParticipant",
    ],
    [
      "closeParticipation",
      "participation.close",
      () => closeParticipation(ID),
      "closeParticipation",
    ],
    [
      "reopenParticipation",
      "participation.reopen",
      () => reopenParticipation(ID),
      "reopenParticipation",
    ],
  ];

  it.each(cases)(
    "%s authorizes with %s on the Competition and writes in its War Week",
    async (_name, action, run, mutation) => {
      authorized.current = OK;
      const mutations = await import("@/mutations/participation");
      await expect(run()).resolves.toEqual({ ok: true });
      expect(authorize).toHaveBeenCalledWith(action, "competition", ID);
      expect(
        (mutations as unknown as Record<string, ReturnType<typeof vi.fn>>)[
          mutation
        ],
      ).toHaveBeenCalledTimes(1);
      expect(revalidatePath).toHaveBeenCalled();
    },
  );

  it.each(cases)(
    "%s: a refusal never reaches the mutation",
    async (_name, _action, run, mutation) => {
      authorized.current = REFUSED;
      const mutations = await import("@/mutations/participation");
      await expect(run()).resolves.toEqual(REFUSED);
      expect(
        (mutations as unknown as Record<string, ReturnType<typeof vi.fn>>)[
          mutation
        ],
      ).not.toHaveBeenCalled();
      expect(revalidatePath).not.toHaveBeenCalled();
    },
  );

  it("parses the input only after authorizing: a refusal beats malformed input", async () => {
    authorized.current = REFUSED;
    await expect(
      markParticipant(ID, { participantId: "nope" }),
    ).resolves.toEqual(REFUSED);
    await expect(setParticipationSettings(ID, null)).resolves.toEqual(REFUSED);
  });

  it("reads malformed input as a refusal once authorized, never reaching the mutation", async () => {
    authorized.current = OK;
    const mutations = await import("@/mutations/participation");
    expect(await markParticipant(ID, { participantId: "nope" })).toMatchObject({
      ok: false,
    });
    expect(await setParticipationSettings(ID, null)).toMatchObject({
      ok: false,
    });
    expect(mutations.markParticipant).not.toHaveBeenCalled();
    expect(mutations.setParticipationSettings).not.toHaveBeenCalled();
  });
});

describe("check in and out", () => {
  it("authorize with authorizeCheckIn, not the Host actions", async () => {
    authorized.current = OK;
    const mutations = await import("@/mutations/participation");
    await expect(checkIn(ID)).resolves.toEqual({ ok: true });
    await expect(checkOut(ID)).resolves.toEqual({ ok: true });
    expect(authorizeCheckIn).toHaveBeenNthCalledWith(
      1,
      "participation.check-in",
      ID,
    );
    expect(authorizeCheckIn).toHaveBeenNthCalledWith(
      2,
      "participation.check-out",
      ID,
    );
    expect(authorize).not.toHaveBeenCalled();
    expect(mutations.checkIn).toHaveBeenCalledWith(ID, CTX);
    expect(mutations.checkOut).toHaveBeenCalledWith(ID, CTX);
  });

  it("a refusal never reaches the mutation", async () => {
    authorized.current = { ok: false, error: "Check-in is off." };
    const mutations = await import("@/mutations/participation");
    await expect(checkIn(ID)).resolves.toEqual(authorized.current);
    await expect(checkOut(ID)).resolves.toEqual(authorized.current);
    expect(mutations.checkIn).not.toHaveBeenCalled();
    expect(mutations.checkOut).not.toHaveBeenCalled();
  });
});
