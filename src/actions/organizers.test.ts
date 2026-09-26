import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { addOrganizer } from "@/actions/organizers";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/auth/authorize", () => ({
  authorizeOrganizerList: vi.fn(async () => ({
    ok: true,
    actor: { email: "organizer@jahnelgroup.com", isOrganizer: true, hosts: [] },
  })),
}));
vi.mock("@/mutations/organizers", () => ({
  addOrganizer: vi.fn(async () => {
    throw new Error("boom");
  }),
}));

describe("Organizer actions", () => {
  it("return the generic error when the mutation throws", async () => {
    await expect(addOrganizer("new@jahnelgroup.com")).resolves.toEqual({
      ok: false,
      error: "Something went wrong. Try again.",
    });
    expect(console.error).toHaveBeenCalled();
  });
});
