import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { WriteResult } from "@/lib/result";

import {
  type AutosaveSnapshot,
  SAVE_FAILED_ERROR,
  createAutosave,
} from "./autosave";

type Form = {
  title: string;
  url: string;
  start: string;
  end: string;
};

const SAVED: Form = {
  title: "Space",
  url: "https://slack.example/a",
  start: "2027-02-22",
  end: "2027-02-26",
};

/** A save the test settles by hand, recording each posted input. */
function fakeServer() {
  const posted: Partial<Form>[] = [];
  const pending: ((result: WriteResult) => void)[] = [];
  return {
    posted,
    save: (input: Partial<Form>) =>
      new Promise<WriteResult>((resolve) => {
        posted.push(input);
        pending.push(resolve);
      }),
    /** Settles the oldest unsettled save and lets the queue move on. */
    async respond(result: WriteResult) {
      pending.shift()?.(result);
      await vi.runAllTimersAsync();
    },
  };
}

function setup(options: { delayMs?: number } = {}) {
  const server = fakeServer();
  const snapshots: AutosaveSnapshot[] = [];
  const settled = vi.fn();
  const autosave = createAutosave<Form>({
    saved: SAVED,
    save: server.save,
    groupOf: (field) =>
      field === "start" || field === "end" ? ["start", "end"] : [field],
    delayMs: options.delayMs ?? 800,
    onChange: (snapshot) => snapshots.push(snapshot),
    onSettled: settled,
  });
  const last = () => snapshots.at(-1);
  return { server, autosave, last, settled };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("createAutosave", () => {
  it("saves a field once the Organizer stops typing, not on every key", async () => {
    const { server, autosave, last } = setup();
    autosave.change({ ...SAVED, title: "Spa" }, ["title"]);
    await vi.advanceTimersByTimeAsync(500);
    autosave.change({ ...SAVED, title: "Spaces" }, ["title"]);
    await vi.advanceTimersByTimeAsync(799);
    expect(server.posted).toEqual([]);
    expect(last()?.status).toBe("saving");

    await vi.advanceTimersByTimeAsync(1);
    expect(server.posted).toEqual([{ title: "Spaces" }]);
    await server.respond({ ok: true });
    expect(last()).toEqual({ status: "saved", fieldErrors: {} });
    expect(autosave.unsaved()).toBe(false);
  });

  it("starts idle and saves nothing for a value changed back to the saved one", async () => {
    const { server, autosave, last } = setup();
    autosave.change({ ...SAVED, title: "Moon" }, ["title"]);
    autosave.change({ ...SAVED }, ["title"]);
    await vi.runAllTimersAsync();
    expect(server.posted).toEqual([]);
    expect(last()).toEqual({ status: "idle", fieldErrors: {} });
  });

  it("shows a refusal at its field, keeps the old value saved, and lets other fields save", async () => {
    const { server, autosave, last } = setup();
    const badUrl = { ...SAVED, url: "http://slack.example/x" };
    autosave.change(badUrl, ["url"]);
    await vi.runAllTimersAsync();
    await server.respond({
      ok: false,
      error: "Slack URL must be an https URL.",
      fieldErrors: { url: "Slack URL must be an https URL." },
    });
    expect(last()).toEqual({
      status: "failed",
      fieldErrors: { url: "Slack URL must be an https URL." },
    });
    expect(autosave.unsaved()).toBe(true);

    // The title saves on its own: the refused URL isn't sent with it.
    autosave.change({ ...badUrl, title: "Moon" }, ["title"]);
    await vi.runAllTimersAsync();
    expect(server.posted.at(-1)).toEqual({ title: "Moon" });
    await server.respond({ ok: true });
    expect(last()?.fieldErrors).toEqual({
      url: "Slack URL must be an https URL.",
    });
    expect(last()?.status).toBe("failed");

    // Fixing the URL clears its error.
    autosave.change(
      { ...SAVED, title: "Moon", url: "https://slack.example/b" },
      ["url"],
    );
    await vi.runAllTimersAsync();
    expect(server.posted.at(-1)).toEqual({ url: "https://slack.example/b" });
    await server.respond({ ok: true });
    expect(last()).toEqual({ status: "saved", fieldErrors: {} });
  });

  it("puts a refusal that names no field at the first field of the group", async () => {
    const { server, autosave, last } = setup();
    autosave.change({ ...SAVED, end: "2027-02-23" }, ["end"]);
    await vi.runAllTimersAsync();
    await server.respond({
      ok: false,
      error: "A Day falls outside the dates.",
    });
    expect(last()?.fieldErrors).toEqual({
      start: "A Day falls outside the dates.",
    });
  });

  it("saves a group's fields together and other fields separately", async () => {
    const { server, autosave } = setup();
    autosave.change(
      { ...SAVED, title: "Moon", start: "2027-02-21", end: "2027-02-27" },
      ["title", "start", "end"],
    );
    await vi.runAllTimersAsync();
    await server.respond({ ok: true });
    await server.respond({ ok: true });
    expect(server.posted).toEqual([
      { title: "Moon" },
      { start: "2027-02-21", end: "2027-02-27" },
    ]);
  });

  it("sends one save at a time, each with only its own fields, never another field's unsaved typing", async () => {
    const { server, autosave, settled } = setup();
    autosave.change({ ...SAVED, title: "Moon" }, ["title"]);
    await vi.runAllTimersAsync();
    // Mid-save, the URL changes and saves; the title is still typing.
    autosave.change(
      { ...SAVED, title: "Moon", url: "https://slack.example/b" },
      ["url"],
    );
    await vi.runAllTimersAsync();
    autosave.change(
      { ...SAVED, title: "Moonbase", url: "https://slack.example/b" },
      ["title"],
    );
    expect(server.posted).toHaveLength(1);

    await server.respond({ ok: true });
    expect(server.posted[1]).toEqual({ url: "https://slack.example/b" });
    expect(settled).not.toHaveBeenCalled();
    await server.respond({ ok: true });
    await server.respond({ ok: true });
    expect(server.posted[2]).toEqual({ title: "Moonbase" });
    expect(settled).toHaveBeenCalledTimes(1);
  });

  it("flush saves a pending change at once (leaving the page)", async () => {
    const { server, autosave } = setup();
    autosave.change({ ...SAVED, title: "Moon" }, ["title"]);
    expect(autosave.unsaved()).toBe(true);
    const done = autosave.flush();
    expect(server.posted).toEqual([]);
    await vi.advanceTimersByTimeAsync(0);
    expect(server.posted).toEqual([{ title: "Moon" }]);
    await server.respond({ ok: true });
    await done;
    expect(autosave.unsaved()).toBe(false);
  });

  it("shows a save that throws as a refusal at the field", async () => {
    const snapshots: AutosaveSnapshot[] = [];
    const watched = createAutosave<Form>({
      saved: SAVED,
      save: () => Promise.reject(new Error("offline")),
      groupOf: (field) => [field],
      delayMs: 800,
      onChange: (snapshot) => snapshots.push(snapshot),
    });
    watched.change({ ...SAVED, title: "Moon" }, ["title"]);
    await vi.runAllTimersAsync();
    expect(snapshots.at(-1)?.status).toBe("failed");
    expect(snapshots.at(-1)?.fieldErrors.title).toBe(SAVE_FAILED_ERROR);
  });
});

type Settings = {
  name: string;
  countsTowardTeam: boolean;
  placementPoints: number[];
  hosts: string[];
  description: { type: string; content: { text: string }[] } | null;
};

const SAVED_SETTINGS: Settings = {
  name: "Darts",
  countsTowardTeam: false,
  placementPoints: [10, 7, 5],
  hosts: ["ana@jahnelgroup.com", "bo@jahnelgroup.com"],
  description: { type: "doc", content: [{ text: "Throw" }] },
};

function settingsSetup() {
  const posted: Partial<Settings>[] = [];
  const snapshots: AutosaveSnapshot[] = [];
  const autosave = createAutosave<Settings>({
    saved: SAVED_SETTINGS,
    save: async (input) => {
      posted.push(input);
      return { ok: true };
    },
    groupOf: (field) => [field],
    delayMs: 800,
    onChange: (snapshot) => snapshots.push(snapshot),
  });
  return { posted, autosave, last: () => snapshots.at(-1) };
}

describe("createAutosave with fields that aren't text", () => {
  it("saves a boolean, a list and rich-text content, each on its own", async () => {
    const { posted, autosave, last } = settingsSetup();
    const next = {
      ...SAVED_SETTINGS,
      countsTowardTeam: true,
      placementPoints: [12, 8],
      description: { type: "doc", content: [{ text: "Throw twice" }] },
    };
    autosave.change(next, [
      "countsTowardTeam",
      "placementPoints",
      "description",
    ]);
    await vi.runAllTimersAsync();
    expect(posted).toEqual([
      { countsTowardTeam: true },
      { placementPoints: [12, 8] },
      { description: { type: "doc", content: [{ text: "Throw twice" }] } },
    ]);
    expect(last()?.status).toBe("saved");
  });

  it("sends nothing for a list or content equal to the saved one in a new copy", async () => {
    const { posted, autosave, last } = settingsSetup();
    autosave.change(
      {
        ...SAVED_SETTINGS,
        placementPoints: [10, 7, 5],
        description: { type: "doc", content: [{ text: "Throw" }] },
      },
      ["placementPoints", "description"],
    );
    await vi.runAllTimersAsync();
    expect(posted).toEqual([]);
    expect(last()?.status).toBe("idle");
  });

  it("treats a set of emails in another order as unchanged, by the form's own equality", async () => {
    const posted: Partial<Settings>[] = [];
    const autosave = createAutosave<Settings>({
      saved: SAVED_SETTINGS,
      save: async (input) => {
        posted.push(input);
        return { ok: true };
      },
      groupOf: (field) => [field],
      equals: (field, a, b) =>
        field === "hosts"
          ? [...(a as string[])].sort().join() ===
            [...(b as string[])].sort().join()
          : JSON.stringify(a) === JSON.stringify(b),
      delayMs: 800,
      onChange: () => {},
    });
    autosave.change(
      {
        ...SAVED_SETTINGS,
        hosts: ["bo@jahnelgroup.com", "ana@jahnelgroup.com"],
      },
      ["hosts"],
    );
    await vi.runAllTimersAsync();
    expect(posted).toEqual([]);
    autosave.change({ ...SAVED_SETTINGS, hosts: ["bo@jahnelgroup.com"] }, [
      "hosts",
    ]);
    await vi.runAllTimersAsync();
    expect(posted).toEqual([{ hosts: ["bo@jahnelgroup.com"] }]);
  });
});

describe("Autosave.reseed: the server's values after a save", () => {
  it("takes the server's values as saved, so a field set back to the old value saves again", async () => {
    const { posted, autosave } = settingsSetup();
    // Another save (a Format change, say) made the server clear the points.
    autosave.reseed({ ...SAVED_SETTINGS, placementPoints: [10, 7, 5, 3] });
    autosave.change(SAVED_SETTINGS, ["placementPoints"]);
    await vi.runAllTimersAsync();
    expect(posted).toEqual([{ placementPoints: [10, 7, 5] }]);
  });

  it("names the fields still waiting, saving or refused, which the form keeps as typed", async () => {
    const posted: Partial<Settings>[] = [];
    const autosave = createAutosave<Settings>({
      saved: SAVED_SETTINGS,
      save: async (input) => {
        posted.push(input);
        return "name" in input
          ? {
              ok: false,
              error: "Enter the name.",
              fieldErrors: { name: "Enter the name." },
            }
          : { ok: true };
      },
      groupOf: (field) => [field],
      delayMs: 800,
      onChange: () => {},
    });
    expect(autosave.unsavedFields()).toEqual([]);
    autosave.change({ ...SAVED_SETTINGS, name: "", countsTowardTeam: true }, [
      "name",
      "countsTowardTeam",
    ]);
    expect(autosave.unsavedFields().sort()).toEqual([
      "countsTowardTeam",
      "name",
    ]);
    await vi.runAllTimersAsync();
    expect(autosave.unsavedFields()).toEqual(["name"]);
  });
});
