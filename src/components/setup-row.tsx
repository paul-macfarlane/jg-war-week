// Only client components import this; it holds their shared row plumbing.
import { useRouter } from "next/navigation";
import {
  type ReactNode,
  useActionState,
  useRef,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";

import type { SetupActionResult } from "@/actions/setup";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  FOCUSABLE,
  fieldErrorsOf,
  formErrorOf,
  useFocusFirstInvalid,
} from "@/components/form-field-errors";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import type { FieldErrors } from "@/lib/result";
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
 * Runs one setup row's server action on `useActionState`, so the row's own
 * `<form action={formAction}>` posts it, a field error shows under its
 * field (`fieldErrors`), and focus moves to the first invalid field. On
 * success it toasts `successMessage`, runs `onSaved` (the add row clears its
 * fields there) and refreshes the page. Delete has no fields, so it keeps a
 * plain transition (`remove`), sharing this row's `pending` and `error`.
 */
export function useSetupRow(
  action: () => Promise<SetupActionResult>,
  successMessage: string,
  onSaved?: () => void,
) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [deletePending, startDeleteTransition] = useTransition();
  const [deleteResult, setDeleteResult] = useState<SetupActionResult | null>(
    null,
  );

  const [result, formAction, savePending] = useActionState(
    async (): Promise<SetupActionResult> => {
      const saved = await action();
      if (!saved.ok) {
        toast.error(saved.error);
        return saved;
      }
      toast.success(successMessage);
      onSaved?.();
      router.refresh();
      return saved;
    },
    null,
  );
  useFocusFirstInvalid(formRef, result);

  /** Runs a Delete (or other field-less write) in its own transition. */
  function remove(
    deleteAction: () => Promise<SetupActionResult>,
    deleteSuccessMessage?: string,
  ): Promise<SetupActionResult> {
    return new Promise((resolve) => {
      startDeleteTransition(async () => {
        const saved = await deleteAction();
        setDeleteResult(saved);
        resolve(saved);
        if (!saved.ok) {
          toast.error(saved.error);
          return;
        }
        if (deleteSuccessMessage) toast.success(deleteSuccessMessage);
        router.refresh();
      });
    });
  }

  const pending = savePending || deletePending;
  const fieldErrors: FieldErrors = fieldErrorsOf(result);
  const deleteError =
    deleteResult && !deleteResult.ok && !deletePending
      ? deleteResult.error
      : null;
  const error = deleteError ?? (savePending ? null : formErrorOf(result));

  return { pending, formRef, formAction, fieldErrors, error, remove };
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
