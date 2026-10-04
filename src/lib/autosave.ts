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
  /**
   * The fields waiting, saving, or refused: the ones a form keeps as typed
   * when the server's values arrive after a save.
   */
  unsavedFields(): (keyof T & string)[];
  /**
   * The server's values after a save (a refresh's new props): they become
   * what's saved, so a change is measured against them. Waiting changes
   * still save.
   */
  reseed(saved: T): void;
};

/**
 * Whether two field values are the same: equal primitives, or arrays and
 * plain objects with the same contents (a list, rich-text content), so a
 * new copy of the saved value isn't sent again.
 */
export function sameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }
  if (typeof a !== "object" || typeof b !== "object" || !a || !b) {
    return false;
  }
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => sameValue(v, b[i]));
  }
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = Object.keys(left);
  return (
    keys.length === Object.keys(right).length &&
    keys.every((key) => key in right && sameValue(left[key], right[key]))
  );
}

/** What a save that threw (offline, say) shows at its field. */
export const SAVE_FAILED_ERROR =
  "Couldn't save. Check your connection, then change the field again.";

/**
 * Autosaves a form of fields of any value (text, a boolean, a number, a
 * list, rich-text content, a set of emails): a change saves `delayMs` after the
 * last edit, one field (or one `groupOf` group, saved together) per save.
 * Each save posts only its own fields, so a refused field, another field
 * still being typed, or a value stored since the page loaded never rides
 * along,
 * and saves run one at a time, in order, so a later save never lands
 * under an earlier one. A refusal's errors stay at its fields (one naming
 * no field goes to the group's first) until they save. `onSettled` runs
 * when the last of a run of saves is done and at least one saved. A value
 * equal to the saved one (`equals`, by default `sameValue`) isn't sent.
 */
export function createAutosave<T extends Record<string, unknown>>({
  saved: initial,
  save,
  groupOf,
  equals = (_field, a, b) => sameValue(a, b),
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
  /** Whether a field's value equals the saved one (a set ignores order). */
  equals?: (field: keyof T & string, a: unknown, b: unknown) => boolean;
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
  /** The fields of the saves sent and not yet settled. */
  const sending = new Map<Key, number>();
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
      if (group.every((field) => equals(field, values[field], saved[field]))) {
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
      for (const field of group) {
        const left = (sending.get(field) ?? 1) - 1;
        if (left > 0) sending.set(field, left);
        else sending.delete(field);
      }
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
      for (const field of group)
        sending.set(field, (sending.get(field) ?? 0) + 1);
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
    unsavedFields: () => [
      ...new Set<Key>([
        ...dirty,
        ...sending.keys(),
        ...(Object.keys(fieldErrors) as Key[]),
      ]),
    ],
    reseed(next) {
      saved = { ...next };
    },
  };
}
