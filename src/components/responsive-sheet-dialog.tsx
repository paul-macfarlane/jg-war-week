"use client";

import type { ReactNode } from "react";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/use-media-query";

/** Tailwind's `lg`: a centered Dialog from here up, a bottom Sheet below. */
const WIDE_QUERY = "(min-width: 64rem)";

/**
 * A form that opens as a bottom Sheet on phones and tablets and as a
 * centered Dialog at `lg` and up, where a bottom Sheet stretches awkwardly
 * across the screen. Both portal into the themed root. Lay the content out
 * with the `ResponsiveSheetDialog*` parts, which read the same in either.
 */
export function ResponsiveSheetDialog({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  const wide = useMediaQuery(WIDE_QUERY);
  if (wide) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90dvh] gap-4 overflow-y-auto p-0 sm:max-w-lg">
          {children}
        </DialogContent>
      </Dialog>
    );
  }
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto">
        {children}
      </SheetContent>
    </Sheet>
  );
}

// The Sheet's parts are padded for a popup with no padding of its own, as the
// Dialog above is; its title and description are the same Base UI Dialog
// parts either way, so the popup is named and described by them in both.
export {
  SheetHeader as ResponsiveSheetDialogHeader,
  SheetTitle as ResponsiveSheetDialogTitle,
  SheetDescription as ResponsiveSheetDialogDescription,
  SheetFooter as ResponsiveSheetDialogFooter,
};
