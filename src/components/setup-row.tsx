// Only client components import this; it holds their shared row plumbing.
import { PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  type ReactNode,
  useActionState,
  useId,
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
import {
  ResponsiveSheetDialog,
  ResponsiveSheetDialogFooter,
  ResponsiveSheetDialogHeader,
  ResponsiveSheetDialogTitle,
} from "@/components/responsive-sheet-dialog";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import type { UsageCount } from "@/lib/setup";
import {
  ADD_BUTTON_ATTR,
  ADD_ROW,
  setupRowFocusSelector,
  setupRowFocusTarget,
} from "@/lib/setup-row-focus";

const ROW_ATTR = "data-setup-row";
const EDITOR_ATTR = "data-setup-editor";

/** Marks a setup editor (its rows and add row) for focus after a delete. */
export const SETUP_EDITOR = { [EDITOR_ATTR]: "" };

/** Marks a setup row by its id; the add row has none. */
export function setupRowProps(id?: string) {
  return { [ROW_ATTR]: id ?? ADD_ROW };
}

/** Marks the add row's Add button, where focus goes once a list empties. */
const ADD_BUTTON = { [ADD_BUTTON_ATTR]: "" };

/**
 * Once `row` (a deleted setup row) leaves the page, focuses the first
 * control of its next row (its Edit button in a list whose rows open in a
 * Sheet), else its previous row, else the Add button, so
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
    target
      ?.querySelector<HTMLElement>(setupRowFocusSelector(targetId) ?? FOCUSABLE)
      ?.focus();
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
 * Only the latest action's refusal shows: a save clears a refused
 * delete's, and a delete clears a refused save's.
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
  // The save result a later delete hid.
  const [dismissedSave, setDismissedSave] = useState<SetupActionResult | null>(
    null,
  );

  const [result, formAction, savePending] = useActionState(
    async (): Promise<SetupActionResult> => {
      setDeleteResult(null);
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
        setDismissedSave(result);
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
  const saveResult = result === dismissedSave ? null : result;
  const fieldErrors = fieldErrorsOf(saveResult);
  const deleteError =
    deleteResult && !deleteResult.ok ? deleteResult.error : null;
  const error = pending ? null : (deleteError ?? formErrorOf(saveResult));

  return { pending, formRef, formAction, fieldErrors, error, remove };
}

/**
 * A setup row's Save (or Add) and Delete buttons. Delete asks in a
 * `ConfirmDialog` titled `deleteTitle` before calling `onDelete`; the dialog
 * stays open, pending, until the delete settles. After a delete, focus moves
 * to the next row (or the add row) of the `SETUP_EDITOR` holding this row,
 * each marked with `setupRowProps`. In a Sheet, which is portalled out of
 * the list, `rowId` names the row; inline, the buttons sit inside it.
 */
export function SetupRowButtons({
  pending,
  addLabel,
  rowId,
  onDelete,
  deleteTitle,
  deleteDescription,
}: {
  pending: boolean;
  addLabel: string;
  /** The row these buttons edit, when they're not inside it. */
  rowId?: string;
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
    const row = rowId
      ? document.querySelector<HTMLElement>(
          `[${ROW_ATTR}="${CSS.escape(rowId)}"]`,
        )
      : buttonsRef.current?.closest<HTMLElement>(`[${ROW_ATTR}]`);
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
        {...(onDelete ? {} : ADD_BUTTON)}
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

/**
 * A setup row's form in a `ResponsiveSheetDialog` titled `title`. The form
 * mounts only while the Sheet is open, so each opening starts from the saved
 * values; `form` gets `close`, for its `onSaved`.
 */
function SetupSheet({
  open,
  onOpenChange,
  title,
  form,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  form: (close: () => void) => ReactNode;
}) {
  return (
    <ResponsiveSheetDialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <>
          <ResponsiveSheetDialogHeader>
            <ResponsiveSheetDialogTitle>{title}</ResponsiveSheetDialogTitle>
          </ResponsiveSheetDialogHeader>
          {form(() => onOpenChange(false))}
        </>
      ) : null}
    </ResponsiveSheetDialog>
  );
}

/**
 * One row of a setup list: an "Edit <label>" button showing the row's name
 * and `details`, then `aside` (a link of its own), opening `form` in a
 * Sheet titled like the button.
 */
export function SetupListRow({
  id,
  name,
  label = name,
  details,
  leading,
  aside,
  form,
}: {
  id: string;
  name: string;
  /** What "Edit …" calls the row, e.g. "Team Red"; the name by default. */
  label?: string;
  details: string;
  /** Before the name, e.g. a Team's color. */
  leading?: ReactNode;
  aside?: ReactNode;
  form: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  return (
    <li
      {...setupRowProps(id)}
      className="border-border flex items-center gap-2 border-b py-1 last:border-b-0"
    >
      <Button
        type="button"
        variant="ghost"
        aria-label={`Edit ${label}`}
        aria-describedby={details ? detailsId : undefined}
        className="h-auto min-h-11 min-w-0 flex-1 justify-start gap-2 px-2 py-1.5 text-left font-normal whitespace-normal sm:min-h-9"
        onClick={() => setOpen(true)}
      >
        {leading}
        <span className="flex min-w-0 flex-col">
          <span className="font-medium">{name}</span>
          {details && (
            <span id={detailsId} className="text-foreground/60 text-xs">
              {details}
            </span>
          )}
        </span>
      </Button>
      {aside}
      <SetupSheet
        open={open}
        onOpenChange={setOpen}
        title={`Edit ${label}`}
        form={form}
      />
    </li>
  );
}

/** A setup list's add row: a `label` button opening the empty form. */
export function SetupAddButton({
  label,
  form,
}: {
  label: string;
  form: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div {...setupRowProps()}>
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="min-h-11 sm:min-h-9"
        onClick={() => setOpen(true)}
        {...ADD_BUTTON}
      >
        <PlusIcon />
        {label}
      </Button>
      <SetupSheet
        open={open}
        onOpenChange={setOpen}
        title={label}
        form={form}
      />
    </div>
  );
}

/** A setup Sheet's buttons and error, kept in view while its fields scroll. */
export function SetupSheetFooter({ children }: { children: ReactNode }) {
  return (
    <ResponsiveSheetDialogFooter className="bg-popover sticky bottom-0 border-t pb-[max(1rem,env(safe-area-inset-bottom))]">
      {children}
    </ResponsiveSheetDialogFooter>
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
