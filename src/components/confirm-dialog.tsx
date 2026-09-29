"use client";

import { cn } from "cn";
import { useRouter } from "next/navigation";
import { type ReactNode, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { WriteResult } from "@/lib/result";

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  /** Red confirm button; false for actions that remove nothing. */
  destructive?: boolean;
  pending?: boolean;
  /** Fields the confirm needs, e.g. End War Week's Winner. */
  children?: ReactNode;
} & (
  | {
      /** Runs on confirm. */
      onConfirm: () => void;
      form?: never;
    }
  | {
      /**
       * The id of a form the confirm button submits, so the confirm posts
       * through that form's `useActionState` instead of calling `onConfirm`.
       */
      form: string;
      onConfirm?: never;
    }
);

/**
 * The one confirm for destructive or hard-to-undo actions. `title` names
 * what will be deleted (or removed, reset…); `description` carries what the caller
 * knows about it, such as the counts the server reported. Replaces
 * `window.confirm`, so the dialog is themed and reads its text.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Delete",
  destructive = true,
  pending = false,
  onConfirm,
  form,
  children,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && (
            <AlertDialogDescription>{description}</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel className="min-h-11 sm:min-h-9" disabled={pending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            variant={destructive ? "destructive" : "default"}
            className="min-h-11 sm:min-h-9"
            disabled={pending}
            {...(form ? { type: "submit", form } : { onClick: onConfirm })}
          >
            {pending ? `${confirmLabel}…` : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * A button that asks in a `ConfirmDialog`, then runs `action`. A refusal
 * shows as an error toast (the server's message, counts included); success
 * shows `successMessage` when given. The page refreshes either way.
 */
export function ConfirmActionButton({
  title,
  description,
  confirmLabel = "Delete",
  action,
  successMessage,
  variant = "destructive",
  size = "xs",
  className,
  ariaLabel,
  children,
}: {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  action: () => Promise<WriteResult>;
  successMessage?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  className?: string;
  /** Screen-reader label for the trigger, e.g. "Delete Game: <summary>". */
  ariaLabel?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        if (successMessage) toast.success(successMessage);
      } else {
        toast.error(result.error);
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        // At least 44px on phones, whatever the size.
        className={cn("min-h-11 min-w-11 sm:min-h-0 sm:min-w-0", className)}
        disabled={pending}
        aria-label={ariaLabel}
        onClick={() => setOpen(true)}
      >
        {children}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        description={description}
        confirmLabel={confirmLabel}
        pending={pending}
        onConfirm={confirm}
      />
    </>
  );
}
