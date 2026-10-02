import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { WriteResult } from "@/lib/result";

import { type AutosaveSnapshot, createAutosave } from "./autosave";

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
  const posted: Form[] = [];
  const pending: ((result: WriteResult) => void)[] = [];
  return {
    posted,
    save: (input: Form) =>
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
    expect(server.posted).toEqual([{ ...SAVED, title: "Spaces" }]);
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
    expect(server.posted.at(-1)).toEqual({ ...SAVED, title: "Moon" });
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
    expect(server.posted.at(-1)).toEqual({
      ...SAVED,
      title: "Moon",
      url: "https://slack.example/b",
    });
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
      { ...SAVED, title: "Moon" },
      { ...SAVED, title: "Moon", start: "2027-02-21", end: "2027-02-27" },
    ]);
  });

  it("sends one save at a time, each on top of the last one saved, and never another field's unsaved typing", async () => {
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
    expect(server.posted[1]).toEqual({
      ...SAVED,
      title: "Moon",
      url: "https://slack.example/b",
    });
    expect(settled).not.toHaveBeenCalled();
    await server.respond({ ok: true });
    await server.respond({ ok: true });
    expect(server.posted[2]).toEqual({
      ...SAVED,
      title: "Moonbase",
      url: "https://slack.example/b",
    });
    expect(settled).toHaveBeenCalledTimes(1);
  });

  it("flush saves a pending change at once (leaving the page)", async () => {
    const { server, autosave } = setup();
    autosave.change({ ...SAVED, title: "Moon" }, ["title"]);
    expect(autosave.unsaved()).toBe(true);
    const done = autosave.flush();
    expect(server.posted).toEqual([]);
    await vi.advanceTimersByTimeAsync(0);
    expect(server.posted).toEqual([{ ...SAVED, title: "Moon" }]);
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
    expect(snapshots.at(-1)?.fieldErrors.title).toMatch(/couldn't save/i);
  });
});
