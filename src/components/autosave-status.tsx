"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import type {
  Autosave,
  AutosaveSnapshot,
  AutosaveStatus as Status,
} from "@/lib/autosave";
import { leavingHref } from "@/lib/leave-guard";
import type { FieldErrors } from "@/lib/result";

/** How long after the last edit an autosaving form saves a change. */
export const AUTOSAVE_DELAY_MS = 800;

const STATUS_TEXT: Record<Status, string> = {
  idle: "Changes save automatically",
  saving: "Saving…",
  saved: "Saved",
  failed: "Not saved: see the field marked below",
};

/** Where an in-app link click is waiting to go while a refusal shows. */
export type LeaveGuard = {
  /** The href a click was stopped on, or null. */
  leaving: string | null;
  stay: () => void;
  leave: () => void;
};

/**
 * An autosaving form's leaving rules (War Week settings, the Competition
 * page's Settings). An in-app navigation (unmount) and the tab going
 * hidden (`visibilitychange`, which also covers a phone switching apps)
 * send what's waiting at once. A reload or close can't promise a request
 * finishes, so `beforeunload` sends what's waiting and asks the browser to
 * warn while a save is waiting, in flight or refused. A refused field
 * isn't sent again on its own, so while one shows, a click on an in-app
 * link asks first (`AutosaveStatusLine`'s "Leave without saving?"): a
 * capture listener on the document runs before the link's own handler,
 * and Next's Link doesn't navigate a click that was prevented.
 */
export function useAutosaveLifecycle(
  autosave: Pick<Autosave<never>, "flush" | "unsaved">,
  fieldErrors: FieldErrors,
): LeaveGuard {
  const router = useRouter();
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") void autosave.flush();
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      void autosave.flush();
      if (autosave.unsaved()) event.preventDefault();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("beforeunload", onBeforeUnload);
      void autosave.flush();
    };
  }, [autosave]);

  const [leaving, setLeaving] = useState<string | null>(null);
  const hasRefusal = Object.keys(fieldErrors).length > 0;
  useEffect(() => {
    if (!hasRefusal) return;
    const onClick = (event: MouseEvent) => {
      const link =
        event.target instanceof Element
          ? event.target.closest("a[href]")
          : null;
      if (!(link instanceof HTMLAnchorElement)) return;
      const href = leavingHref(
        {
          href: link.href,
          target: link.target,
          download: link.hasAttribute("download"),
          button: event.button,
          modified:
            event.metaKey || event.ctrlKey || event.shiftKey || event.altKey,
          defaultPrevented: event.defaultPrevented,
        },
        window.location.href,
      );
      if (href === null) return;
      event.preventDefault();
      setLeaving(href);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [hasRefusal]);

  return {
    leaving,
    stay: () => setLeaving(null),
    leave: () => {
      if (leaving) router.push(leaving);
      setLeaving(null);
    },
  };
}

/**
 * An autosaving form's status beside its heading ("Saving…", "Saved", or
 * the refusal), and the "Leave without saving?" confirm naming the first
 * refused field (`fieldLabel`) that `useAutosaveLifecycle` opens.
 */
export function AutosaveStatusLine({
  state,
  guard,
  fieldLabel,
}: {
  state: AutosaveSnapshot;
  guard: LeaveGuard;
  fieldLabel: (field: string) => string;
}) {
  const [refused] = Object.entries(state.fieldErrors);
  return (
    <>
      <p
        role="status"
        aria-live="polite"
        data-slot="autosave-status"
        data-status={state.status}
        className={
          state.status === "failed"
            ? "text-destructive text-sm"
            : "text-foreground/70 text-sm"
        }
      >
        {STATUS_TEXT[state.status]}
      </p>
      <ConfirmDialog
        open={guard.leaving !== null}
        onOpenChange={(open) => {
          if (!open) guard.stay();
        }}
        title="Leave without saving?"
        description={
          refused
            ? `${fieldLabel(refused[0])} wasn't saved: ${refused[1]}`
            : undefined
        }
        confirmLabel="Leave"
        onConfirm={guard.leave}
      />
    </>
  );
}
