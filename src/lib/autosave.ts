import type { FieldErrors, WriteResult } from "@/lib/result";

/**
 * Where an autosaving form stands: nothing changed yet, a change waiting
 * or saving, everything saved, or a refused save still showing its error.
 */
export type AutosaveStatus = "idle" | "saving" | "saved" | "failed";

export type AutosaveSnapshot = {
  status: AutosaveStatus;
  /** Each refused field's message, until the field saves. */
  fieldErrors: FieldErrors;
};

export type Autosave<T> = {
  /** The form now holds `values`; `fields` are the ones just edited. */
  change(values: T, fields: (keyof T & string)[]): void;
  /** Saves every waiting change now; resolves once all saves settle. */
  flush(): Promise<void>;
  /** A change waits or is saving, or a refused value isn't saved. */
  unsaved(): boolean;
};

/** What a save that threw (offline, say) shows at its field. */
export const SAVE_FAILED_ERROR =
  "Couldn't save. Check your connection, then change the field again.";

/**
 * Autosaves a form of string fields: a change saves `delayMs` after the
 * last edit, one field (or one `groupOf` group, saved together) per save.
 * Each save posts only its own fields, so a refused field, another field
 * still being typed, or a value stored since the page loaded never rides
 * along,
 * and saves run one at a time, in order, so a later save never lands
 * under an earlier one. A refusal's errors stay at its fields (one naming
 * no field goes to the group's first) until they save. `onSettled` runs
 * when the last of a run of saves is done and at least one saved.
 */
export function createAutosave<T extends Record<string, string>>({
  saved: initial,
  save,
  groupOf,
  delayMs,
  onChange,
  onSettled,
}: {
  saved: T;
  /**
   * Saves one field or group: only those fields. Never throws by contract
   * (ADR 0004); a throw shows as a refusal.
   */
  save: (fields: Partial<T>) => Promise<WriteResult>;
  groupOf: (field: keyof T & string) => readonly (keyof T & string)[];
  delayMs: number;
  onChange: (snapshot: AutosaveSnapshot) => void;
  onSettled?: () => void;
}): Autosave<T> {
  type Key = keyof T & string;
  let saved: T = { ...initial };
  let latest: T = saved;
  const dirty = new Set<Key>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let inFlight = 0;
  let queue: Promise<void> = Promise.resolve();
  let fieldErrors: FieldErrors = {};
  let everSaved = false;
  let savedThisRun = false;

  function publish() {
    const status: AutosaveStatus =
      dirty.size > 0 || inFlight > 0
        ? "saving"
        : Object.keys(fieldErrors).length > 0
          ? "failed"
          : everSaved
            ? "saved"
            : "idle";
    onChange({ status, fieldErrors });
  }

  function withoutErrors(fields: readonly Key[]) {
    const kept = { ...fieldErrors };
    for (const field of fields) delete kept[field];
    return kept;
  }

  async function send(group: readonly Key[], values: T) {
    try {
      if (group.every((field) => values[field] === saved[field])) {
        fieldErrors = withoutErrors(group);
        return;
      }
      const input: Partial<T> = {};
      for (const field of group) input[field] = values[field];
      let result: WriteResult;
      try {
        result = await save(input);
      } catch {
        result = { ok: false, error: SAVE_FAILED_ERROR };
      }
      if (result.ok) {
        saved = { ...saved, ...input };
        everSaved = true;
        savedThisRun = true;
        fieldErrors = withoutErrors(group);
      } else {
        const named = result.fieldErrors ?? {};
        fieldErrors = {
          ...withoutErrors(group),
          ...(Object.keys(named).length > 0
            ? named
            : { [group[0]]: result.error }),
        };
      }
    } finally {
      inFlight -= 1;
      publish();
      if (inFlight === 0 && dirty.size === 0 && savedThisRun) {
        savedThisRun = false;
        onSettled?.();
      }
    }
  }

  function flush() {
    clearTimeout(timer);
    timer = undefined;
    const groups = new Map<string, readonly Key[]>();
    for (const field of dirty) {
      const group = groupOf(field);
      groups.set(group.join(" "), group);
    }
    dirty.clear();
    const values = latest;
    for (const group of groups.values()) {
      inFlight += 1;
      queue = queue.then(() => send(group, values));
    }
    publish();
    return queue;
  }

  return {
    change(values, fields) {
      latest = values;
      for (const field of fields) dirty.add(field);
      clearTimeout(timer);
      timer = setTimeout(() => void flush(), delayMs);
      publish();
    },
    flush,
    unsaved: () =>
      dirty.size > 0 || inFlight > 0 || Object.keys(fieldErrors).length > 0,
  };
}
