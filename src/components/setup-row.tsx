// Only client components import this; it holds their shared row plumbing.
import { useRouter } from "next/navigation";
import { type ReactNode, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import type { SetupActionResult } from "@/actions/setup";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import type { UsageCount } from "@/lib/setup";
import { ADD_ROW, setupRowFocusTarget } from "@/lib/setup-row-focus";

const ROW_ATTR = "data-setup-row";
const EDITOR_ATTR = "data-setup-editor";

/** Marks a setup editor (its rows and add row) for focus after a delete. */
export const SETUP_EDITOR = { [EDITOR_ATTR]: "" };

/** Marks a setup row by its id; the add row has none. */
export function setupRowProps(id?: string) {
  return { [ROW_ATTR]: id ?? ADD_ROW };
}

const FOCUSABLE =
  "input:not([type=hidden]):not(:disabled), button:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex='-1'])";

/**
 * Once `row` (a deleted setup row) leaves the page, focuses the first
 * control of its next row, else its previous row, else the Add button, so
 * focus doesn't fall to `<body>`. The row goes when `router.refresh()`
 * lands, so this waits for it frame by frame (up to ten seconds).
 */
function focusNeighborOnceRemoved(row: HTMLElement) {
  const editor = row.closest(`[${EDITOR_ATTR}]`);
  const ids = [...(row.parentElement?.children ?? [])].flatMap((sibling) => {
    const id = sibling.getAttribute(ROW_ATTR);
    return id ? [id] : [];
  });
  const targetId = setupRowFocusTarget(ids, row.getAttribute(ROW_ATTR) ?? "");
  const deadline = performance.now() + 10_000;

  function focusTarget() {
    if (row.isConnected) {
      if (performance.now() < deadline) requestAnimationFrame(focusTarget);
      return;
    }
    const scope: ParentNode = editor?.isConnected ? editor : document;
    const target = scope.querySelector(
      `[${ROW_ATTR}="${CSS.escape(targetId)}"]`,
    );
    // An emptied list lands on the Add button; a row, on its first control.
    (targetId === ADD_ROW
      ? target?.querySelector<HTMLElement>("button[type=submit]")
      : target?.querySelector<HTMLElement>(FOCUSABLE)
    )?.focus();
  }
  requestAnimationFrame(focusTarget);
}

/**
 * Runs one setup row's server action, keeps its result, and refreshes the
 * page on success. A refusal shows as an error toast (and stays in the
 * row's `SetupRowError`); a success toasts `successMessage` when given.
 * `onSaved` runs after a successful save (the add row clears its fields
 * there). `run` resolves with the action's result.
 */
export function useSetupRow(onSaved?: () => void) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<SetupActionResult | null>(null);

  function run(
    action: () => Promise<SetupActionResult>,
    successMessage?: string,
  ): Promise<SetupActionResult> {
    return new Promise((resolve) => {
      startTransition(async () => {
        const saved = await action();
        setResult(saved);
        resolve(saved);
        if (!saved.ok) {
          toast.error(saved.error);
          return;
        }
        if (successMessage) toast.success(successMessage);
        onSaved?.();
        router.refresh();
      });
    });
  }

  const error = result && !result.ok && !pending ? result.error : null;
  return { pending, run, error };
}

/**
 * A setup row's Save (or Add) and Delete buttons. Delete asks in a
 * `ConfirmDialog` titled `deleteTitle` before calling `onDelete`; the dialog
 * stays open, pending, until the delete settles. After a delete, focus moves
 * to the next row (or the add row) of the `SETUP_EDITOR` holding this row,
 * each marked with `setupRowProps`.
 */
export function SetupRowButtons({
  pending,
  addLabel,
  onDelete,
  deleteTitle,
  deleteDescription,
}: {
  pending: boolean;
  addLabel: string;
  /** Absent on the add row. Runs once the Organizer confirms. */
  onDelete?: () => Promise<SetupActionResult>;
  /** Names what will be deleted, e.g. "Delete Team Red?". */
  deleteTitle?: string;
  /** What goes with it, e.g. the row's usage counts. */
  deleteDescription?: ReactNode;
}) {
  const buttonsRef = useRef<HTMLDivElement>(null);
  const [confirming, setConfirming] = useState(false);
  // Close the confirm once the delete settles: a refusal keeps the row, a
  // success removes it (and the dialog with it). Adjusting state during
  // render: https://react.dev/learn/you-might-not-need-an-effect
  const [wasPending, setWasPending] = useState(pending);
  if (pending !== wasPending) {
    setWasPending(pending);
    if (!pending) setConfirming(false);
  }

  async function confirmDelete() {
    if (!onDelete) return;
    const row = buttonsRef.current?.closest<HTMLElement>(`[${ROW_ATTR}]`);
    const result = await onDelete();
    if (result.ok && row) focusNeighborOnceRemoved(row);
  }

  return (
    <div ref={buttonsRef} className="flex items-center gap-2">
      <Button
        type="submit"
        size="lg"
        className="min-h-11 sm:min-h-9"
        disabled={pending}
      >
        {pending ? "Saving…" : onDelete ? "Save" : addLabel}
      </Button>
      {onDelete && (
        <>
          <Button
            type="button"
            variant="destructive"
            size="lg"
            className="min-h-11 sm:min-h-9"
            disabled={pending}
            onClick={() => setConfirming(true)}
          >
            Delete
          </Button>
          <ConfirmDialog
            open={confirming}
            onOpenChange={setConfirming}
            title={deleteTitle ?? "Delete this row?"}
            description={deleteDescription}
            pending={pending}
            onConfirm={confirmDelete}
          />
        </>
      )}
    </div>
  );
}

/** A setup row's server error, under its buttons. */
export function SetupRowError({ error }: { error: string | null }) {
  return <FieldError className="mt-1">{error}</FieldError>;
}

/**
 * "2 Participants · 1 Points Entry", skipping zero counts. (Not
 * `countedParts` from lib/setup, which would pull the seed schema into the
 * client bundle.)
 */
export function usageSummary(counts: UsageCount[]): string {
  const parts = counts
    .filter(([n]) => n > 0)
    .map(([n, singular, plural]) => `${n} ${n === 1 ? singular : plural}`);
  return parts.length > 0 ? parts.join(" · ") : "Not used yet";
}
