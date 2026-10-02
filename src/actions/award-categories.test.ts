import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  archiveAwardCategory,
  createAwardCategory,
  renameAwardCategory,
  restoreAwardCategory,
} from "@/actions/award-categories";
import { authorizeOrganizerList } from "@/auth/authorize";
import * as mutations from "@/mutations/award-categories";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/auth/authorize", () => ({ authorizeOrganizerList: vi.fn() }));
vi.mock("@/mutations/award-categories", () => ({
  createAwardCategory: vi.fn(async () => ({ ok: true })),
  renameAwardCategory: vi.fn(async () => ({ ok: true })),
  archiveAwardCategory: vi.fn(async () => ({ ok: true })),
  restoreAwardCategory: vi.fn(async () => ({ ok: true })),
}));

const ID = "11111111-1111-4111-8111-111111111111";
const organizer = {
  ok: true as const,
  actor: { email: "o@jahnelgroup.com", isOrganizer: true, hosts: [] },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(authorizeOrganizerList).mockResolvedValue(organizer);
});

describe("Award Category actions", () => {
  it("refuse a non-Organizer before touching the database", async () => {
    vi.mocked(authorizeOrganizerList).mockResolvedValue({
      ok: false,
      error: "Only an Organizer can add Award Categories.",
    });
    expect(await createAwardCategory("Zz")).toEqual({
      ok: false,
      error: "Only an Organizer can add Award Categories.",
    });
    expect(mutations.createAwardCategory).not.toHaveBeenCalled();
  });

  it("check the matching action for each write", async () => {
    await createAwardCategory("Zz");
    await renameAwardCategory(ID, "Zz");
    await archiveAwardCategory(ID);
    await restoreAwardCategory(ID);
    expect(
      vi.mocked(authorizeOrganizerList).mock.calls.map(([action]) => action),
    ).toEqual([
      "award-category.create",
      "award-category.rename",
      "award-category.archive",
      "award-category.restore",
    ]);
  });

  it("trim the name and refuse an empty or overlong one", async () => {
    await createAwardCategory("  Zz Crossword ");
    expect(mutations.createAwardCategory).toHaveBeenCalledWith("Zz Crossword");
    expect(await createAwardCategory("   ")).toMatchObject({
      ok: false,
      error: "Name must not be empty.",
    });
    expect(await renameAwardCategory(ID, "x".repeat(81))).toMatchObject({
      ok: false,
      error: "Name must be at most 80 characters.",
    });
  });

  it("read a malformed id as a Category that no longer exists", async () => {
    expect(await renameAwardCategory("nope", "Zz")).toEqual({
      ok: false,
      error: "That Category no longer exists.",
    });
    expect(await restoreAwardCategory("nope")).toEqual({
      ok: false,
      error: "That Category no longer exists.",
    });
    expect(await archiveAwardCategory("nope")).toEqual({
      ok: false,
      error: "That Category no longer exists.",
    });
  });
});
