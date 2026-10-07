// Only client components import this: the one admin list row (Edit and
// Delete) and its Sheet plumbing.
import { cn } from "cn";
import { PlusIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type LiHTMLAttributes,
  type ReactNode,
  useActionState,
  useId,
  useRef,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";

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
import { Button, buttonVariants } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import type { WriteResult } from "@/lib/result";
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
function setupRowProps(id?: string) {
  return { [ROW_ATTR]: id ?? ADD_ROW };
}

/** Marks the add row's Add button, where focus goes once a list empties. */
const ADD_BUTTON = { [ADD_BUTTON_ATTR]: "" };

/** Marks a row's Edit control, where focus goes after a neighbor's delete. */
const EDIT_ATTR = "data-setup-edit";

/**
 * Once `row` (a deleted setup row) leaves the page, focuses the Edit
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
    // An emptied list lands on the Add button; a row, on its Edit control
    // (or its first control, when it has no Edit).
    const control =
      target?.querySelector<HTMLElement>(
        setupRowFocusSelector(targetId) ?? `[${EDIT_ATTR}]`,
      ) ?? target?.querySelector<HTMLElement>(FOCUSABLE);
    control?.focus();
  }
  requestAnimationFrame(focusTarget);
}

/**
 * Runs one setup form's server action on `useActionState`, so its
 * `<form action={formAction}>` posts it, a field error shows under its
 * field (`fieldErrors`), and focus moves to the first invalid field. On
 * success it toasts `successMessage`, runs `onSaved` (which closes the
 * Sheet) and refreshes the page.
 */
export function useSetupRow(
  action: () => Promise<WriteResult>,
  successMessage: string,
  onSaved?: () => void,
) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  const [result, formAction, pending] = useActionState(
    async (): Promise<WriteResult | null> => {
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

  const fieldErrors = fieldErrorsOf(result);
  const error = pending ? null : formErrorOf(result);

  return { pending, formRef, formAction, fieldErrors, error };
}

/** A setup Sheet's submit button: `label` ("Save", "Add Team"…). */
export function SetupSaveButton({
  pending,
  label,
}: {
  pending: boolean;
  label: string;
}) {
  return (
    <Button
      type="submit"
      size="lg"
      className="min-h-11 sm:min-h-9"
      disabled={pending}
    >
      {pending ? "Saving…" : label}
    </Button>
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
  fullHeight,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  form: (close: () => void) => ReactNode;
  fullHeight?: boolean;
}) {
  return (
    <ResponsiveSheetDialog
      open={open}
      onOpenChange={onOpenChange}
      fullHeight={fullHeight}
    >
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

/** A row action's classes: at least 44px on phones. */
export const ROW_ACTION = "min-h-11 min-w-11 sm:min-h-8";

/**
 * A row's Move up and Move down buttons (`Move "<label>" up`); the first
 * row's up and the last row's down are disabled.
 */
export function MoveUpDownButtons({
  label,
  first,
  last,
  disabled,
  onMove,
}: {
  label: string;
  first: boolean;
  last: boolean;
  /** While a change is saving. */
  disabled?: boolean;
  onMove: (direction: "up" | "down") => void;
}) {
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className={ROW_ACTION}
        disabled={disabled || first}
        aria-label={`Move "${label}" up`}
        onClick={() => onMove("up")}
      >
        ↑
      </Button>
      <Button
        variant="outline"
        size="sm"
        className={ROW_ACTION}
        disabled={disabled || last}
        aria-label={`Move "${label}" down`}
        onClick={() => onMove("down")}
      >
        ↓
      </Button>
    </>
  );
}

/**
 * One row of an admin list, the one pattern every list uses: the row's
 * name and `details`, then its own controls (`aside`), then a visible
 * **Edit** and **Delete**. Edit opens `form` in a Sheet titled "Edit
 * <label>", or links to `editHref` (a full-page editor). Delete asks in a
 * `ConfirmDialog` titled `deleteTitle`, runs `onDelete`, toasts the result,
 * refreshes the page and moves focus to the next row's Edit. Without
 * `form`/`editHref` or `onDelete` (the viewer may not), that button is
 * absent.
 */
export function SetupListRow({
  id,
  name,
  label,
  details,
  note,
  leading,
  aside,
  form,
  fullHeight,
  editHref,
  onDelete,
  deleteTitle,
  deleteDescription,
  deleteSuccess,
  editLabel = "Edit",
  deleteLabel = "Delete",
  rowProps,
}: {
  id: string;
  name: ReactNode;
  /** What "Edit …" and "Delete …" call the row, e.g. "Team Red". */
  label?: string;
  /** A line under the name: usage counts, a time and category… */
  details?: ReactNode;
  /** A quiet extra line under the details, e.g. a roster hint. */
  note?: string;
  /** Before the name, e.g. a Team's color. */
  leading?: ReactNode;
  /** The row's own controls, before Edit, e.g. a Bracket link. */
  aside?: ReactNode;
  /** The edit form, opened in a Sheet. */
  form?: (close: () => void) => ReactNode;
  /** Below `md`, the edit Sheet fills the screen's height. */
  fullHeight?: boolean;
  /** Instead of `form`: the row's full-page editor. */
  editHref?: string;
  /** Runs once the Organizer confirms the delete. */
  onDelete?: () => Promise<WriteResult>;
  /** Names what will be deleted, e.g. "Delete Team Red?". */
  deleteTitle?: string;
  /** What goes with it, e.g. the row's usage counts. */
  deleteDescription?: ReactNode;
  /** The toast after a delete, e.g. "Team deleted". */
  deleteSuccess?: string;
  /** What the Edit control says instead, e.g. "Rename". */
  editLabel?: string;
  /** What the Delete control says instead, e.g. "Archive". */
  deleteLabel?: string;
  /** More props for the row's `<li>`, e.g. drag handlers. */
  rowProps?: LiHTMLAttributes<HTMLLIElement>;
}) {
  const router = useRouter();
  const rowRef = useRef<HTMLLIElement>(null);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const detailsId = useId();
  const rowLabel = label ?? (typeof name === "string" ? name : id);
  const described = details || note ? detailsId : undefined;

  function confirmDelete() {
    if (!onDelete) return;
    startTransition(async () => {
      const result = await onDelete();
      setConfirming(false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (deleteSuccess) toast.success(deleteSuccess);
      if (rowRef.current) focusNeighborOnceRemoved(rowRef.current);
      router.refresh();
    });
  }

  return (
    <li
      ref={rowRef}
      {...rowProps}
      {...setupRowProps(id)}
      className={cn(
        "border-border flex flex-wrap items-center gap-x-3 gap-y-2 border-b py-2 last:border-b-0",
        rowProps?.className,
      )}
    >
      <div className="flex min-w-0 flex-1 basis-48 items-center gap-2">
        {leading}
        <div className="flex min-w-0 flex-col">
          <span className="font-medium break-words">{name}</span>
          {described && (
            <span
              id={detailsId}
              className="text-foreground/60 flex flex-col text-xs break-words"
            >
              {details && <span>{details}</span>}
              {note && <span>{note}</span>}
            </span>
          )}
        </div>
      </div>
      <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2">
        {aside}
        {editHref ? (
          <Link
            href={editHref}
            aria-label={`${editLabel} ${rowLabel}`}
            aria-describedby={described}
            className={buttonVariants({
              variant: "outline",
              size: "sm",
              className: ROW_ACTION,
            })}
            {...{ [EDIT_ATTR]: "" }}
          >
            {editLabel}
          </Link>
        ) : (
          form && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label={`${editLabel} ${rowLabel}`}
              aria-describedby={described}
              className={ROW_ACTION}
              onClick={() => setEditing(true)}
              {...{ [EDIT_ATTR]: "" }}
            >
              {editLabel}
            </Button>
          )
        )}
        {onDelete && (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            aria-label={`${deleteLabel} ${rowLabel}`}
            className={ROW_ACTION}
            disabled={pending}
            onClick={() => setConfirming(true)}
          >
            {deleteLabel}
          </Button>
        )}
      </div>
      {form && (
        <SetupSheet
          open={editing}
          onOpenChange={setEditing}
          title={`${editLabel} ${rowLabel}`}
          form={form}
          fullHeight={fullHeight}
        />
      )}
      {onDelete && (
        <ConfirmDialog
          open={confirming}
          onOpenChange={setConfirming}
          title={deleteTitle ?? `${deleteLabel} ${rowLabel}?`}
          description={deleteDescription}
          confirmLabel={deleteLabel}
          pending={pending}
          onConfirm={confirmDelete}
        />
      )}
    </li>
  );
}

/** A setup list's add row: a `label` button opening the empty form. */
export function SetupAddButton({
  label,
  form,
  fullHeight,
}: {
  label: string;
  form: (close: () => void) => ReactNode;
  /** Below `md`, the Sheet fills the screen's height. */
  fullHeight?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div {...setupRowProps()}>
      <Button
        type="button"
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
        fullHeight={fullHeight}
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
