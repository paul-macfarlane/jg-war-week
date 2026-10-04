import { describe, expect, it, vi } from "vitest";

import BracketResults from "@/app/admin/brackets/[id]/page";
import Bracket from "@/app/admin/competitions/[id]/bracket/page";
import Games from "@/app/admin/competitions/[id]/games/page";
import Participation from "@/app/admin/competitions/[id]/participation/page";
import Placements from "@/app/admin/placements/[competitionId]/page";

const permanentRedirect = vi.hoisted(() =>
  vi.fn((to: string) => {
    throw new Error(`308 ${to}`);
  }),
);
vi.mock("next/navigation", () => ({ permanentRedirect }));

const ID = "22222222-2222-4222-8222-222222222222";
const byId = { params: Promise.resolve({ id: ID }) };

describe("the retired Competition setup routes (ticket 101)", () => {
  it.each([
    ["/admin/competitions/[id]/bracket", () => Bracket(byId as never)],
    ["/admin/competitions/[id]/games", () => Games(byId as never)],
    [
      "/admin/competitions/[id]/participation",
      () => Participation(byId as never),
    ],
    ["/admin/brackets/[id]", () => BracketResults(byId as never)],
    [
      "/admin/placements/[competitionId]",
      () =>
        Placements({
          params: Promise.resolve({ competitionId: ID }),
        } as never),
    ],
  ])("%s answers 308 to the Competition's page", async (_route, open) => {
    await expect(open()).rejects.toThrow(`308 /admin/competitions/${ID}`);
    expect(permanentRedirect).toHaveBeenLastCalledWith(
      `/admin/competitions/${ID}`,
    );
  });
});
