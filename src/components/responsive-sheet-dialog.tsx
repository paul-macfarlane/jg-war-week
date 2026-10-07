"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { cn } from "cn";
import { XIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogPortal } from "@/components/ui/dialog";
import {
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { DismissToasts } from "@/components/ui/sonner";

/**
 * A form that opens as a bottom Sheet on phones and as a
 * centered Dialog at `md` (768px) and up, where a bottom Sheet stretches awkwardly
 * across the screen. One Dialog, styled per breakpoint, so crossing `md`
 * while it's open keeps the form and what the person typed. It portals into the
 * themed root. Lay the content out with the `ResponsiveSheetDialog*` parts.
 */
export function ResponsiveSheetDialog({
  open,
  onOpenChange,
  fullHeight = false,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Below `md`, fill the screen's height (a long form, like a rich-text body). */
  fullHeight?: boolean;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogPrimitive.Backdrop
          data-slot="responsive-sheet-dialog-overlay"
          className="fixed inset-0 z-50 bg-black/10 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-xs"
        />
        <DialogPrimitive.Popup
          data-slot="responsive-sheet-dialog-content"
          className={cn(
            // Below `md`: a bottom Sheet that slides up.
            "bg-popover text-popover-foreground fixed inset-x-0 bottom-0 z-50 flex h-auto max-h-[90dvh] flex-col gap-4 overflow-y-auto border-t bg-clip-padding text-sm shadow-lg outline-none",
            fullHeight && "h-dvh max-h-dvh md:h-auto md:max-h-[90dvh]",
            "transition duration-200 ease-in-out data-ending-style:translate-y-[2.5rem] data-ending-style:opacity-0 data-starting-style:translate-y-[2.5rem] data-starting-style:opacity-0",
            // From `md`: a centered Dialog that zooms and fades.
            "md:ring-foreground/10 md:inset-x-auto md:top-1/2 md:bottom-auto md:left-1/2 md:w-full md:max-w-lg md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl md:border-t-0 md:shadow-none md:ring-1 md:duration-100",
            "md:data-ending-style:-translate-y-1/2 md:data-ending-style:scale-95 md:data-starting-style:-translate-y-1/2 md:data-starting-style:scale-95",
          )}
        >
          {/* Below `md` it opens where toasts show. */}
          <DismissToasts />
          {children}
          <DialogPrimitive.Close
            data-slot="responsive-sheet-dialog-close"
            render={
              <Button
                variant="ghost"
                className="absolute top-3 right-3 size-11 sm:size-8"
                size="icon"
              />
            }
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  );
}

// The Sheet's parts are padded for a popup with no padding of its own, as
// this one is; its title and description are the same Base UI Dialog parts,
// so the popup is named and described by them at every width.
export {
  SheetHeader as ResponsiveSheetDialogHeader,
  SheetTitle as ResponsiveSheetDialogTitle,
  SheetDescription as ResponsiveSheetDialogDescription,
  SheetFooter as ResponsiveSheetDialogFooter,
};
