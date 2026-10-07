"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";

import { saveCompetitionSetting } from "@/actions/setup";
import {
  AUTOSAVE_DELAY_MS,
  AutosaveStatusLine,
  useAutosaveLifecycle,
} from "@/components/autosave-status";
import { type AutosaveSnapshot, createAutosave } from "@/lib/autosave";
import { type EntrantsValue, sameEntrants } from "@/lib/entrants";

type Values = { entrants: EntrantsValue };

/**
 * A Competition's Entrants, autosaved the way its Settings fields are
 * (`createAutosave`, `AutosaveStatusLine`): a change saves through the
 * per-field save `AUTOSAVE_DELAY_MS` after the last edit, with "Saving…" /
 * "Saved" beside the Entrants legend. A refusal (a lock that arrived since
 * the page loaded, say) shows the server's message and puts the picker
 * back to what's saved, and the page refreshes so a new lock shows;
 * nothing is then waiting, so leaving doesn't ask.
 * A save's refresh hands over the server's Entrants, which the picker
 * follows unless a change is still waiting.
 *
 * `edit(next)` sets the picker and queues it to save; `edit(next, false)`
 * only sets it (a Head-to-head side while the other is empty, the
 * Bracket's kind before any pick). `ordered` (a Head-to-head's A vs B)
 * counts the same two the other way round as a change.
 */
export function useEntrantsAutosave(
  competitionId: string,
  saved: EntrantsValue,
  { ordered = false }: { ordered?: boolean } = {},
): {
  value: EntrantsValue;
  edit: (next: EntrantsValue, save?: boolean) => void;
  status: ReactNode;
  error: string | undefined;
  /** The picker differs from the saved Entrants. */
  dirty: boolean;
} {
  const router = useRouter();
  const same = (a: EntrantsValue, b: EntrantsValue) =>
    ordered
      ? a.kind === b.kind && a.targetIds.join() === b.targetIds.join()
      : sameEntrants(a, b);
  const [value, setValue] = useState(saved);
  const [state, setState] = useState<AutosaveSnapshot>({
    status: "idle",
    fieldErrors: {},
  });
  const [entrantsSave] = useState(() => {
    // What's saved, how many edits there have been, and whether the last
    // save was refused with nothing saved since.
    let savedNow = saved;
    let edits = 0;
    let refused = false;
    const inner = createAutosave<Values>({
      saved: { entrants: saved },
      save: async ({ entrants }) => {
        const editsAtSend = edits;
        const result = await saveCompetitionSetting(competitionId, {
          field: "entrants",
          value: entrants!,
        });
        if (result.ok) {
          savedNow = entrants!;
        } else if (edits === editsAtSend) {
          // Back to what's saved, unless a newer change is on its way.
          refused = true;
          setValue(savedNow);
          // The page may be stale (a lock since it loaded): show what's true now.
          router.refresh();
        }
        return result;
      },
      groupOf: () => ["entrants"],
      equals: (_field, a, b) => same(a as EntrantsValue, b as EntrantsValue),
      delayMs: AUTOSAVE_DELAY_MS,
      onChange: setState,
      // The run area, the lock and the Seed Positions read the saved Entrants.
      onSettled: () => router.refresh(),
    });
    return {
      flush: inner.flush,
      // A refusal already put the picker back: nothing is left unsaved.
      unsaved: () => inner.unsaved() && !refused,
      /** The picker changed; `save` queues it. */
      edited(next: EntrantsValue, save: boolean) {
        edits += 1;
        if (!save) return;
        refused = false;
        inner.change({ entrants: next }, ["entrants"]);
      },
      /** The server's Entrants arrived; whether the picker follows them. */
      reseed(next: EntrantsValue) {
        savedNow = next;
        inner.reseed({ entrants: next });
        return refused || !inner.unsavedFields().includes("entrants");
      },
    };
  });

  const savedKey = JSON.stringify(saved);
  const [seenKey, setSeenKey] = useState(savedKey);
  if (savedKey !== seenKey) {
    setSeenKey(savedKey);
    if (entrantsSave.reseed(saved)) setValue(saved);
  }

  // The refusal shows at the picker, so no leave confirm is needed.
  const guard = useAutosaveLifecycle(entrantsSave, {});

  function edit(next: EntrantsValue, save = true) {
    setValue(next);
    entrantsSave.edited(next, save);
  }

  const [error] = Object.values(state.fieldErrors);
  return {
    value,
    edit,
    status: (
      <AutosaveStatusLine
        state={state}
        guard={guard}
        fieldLabel={() => "Entrants"}
        slot="entrants-autosave-status"
      />
    ),
    error,
    dirty: !same(value, saved),
  };
}
