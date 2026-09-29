"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
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

/**
 * A form that opens as a bottom Sheet on phones and tablets and as a
 * centered Dialog at `lg` and up, where a bottom Sheet stretches awkwardly
 * across the screen. It is one Dialog styled per breakpoint, not two
 * components swapped by a media query, so crossing `lg` while it is open
 * keeps the form mounted and what the person typed. It portals into the
 * themed root. Lay the content out with the `ResponsiveSheetDialog*` parts.
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogPrimitive.Backdrop
          data-slot="responsive-sheet-dialog-overlay"
          className="fixed inset-0 z-50 bg-black/10 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-xs"
        />
        <DialogPrimitive.Popup
          data-slot="responsive-sheet-dialog-content"
          className={[
            // Below `lg`: a bottom Sheet that slides up.
            "bg-popover text-popover-foreground fixed inset-x-0 bottom-0 z-50 flex h-auto max-h-[90dvh] flex-col gap-4 overflow-y-auto border-t bg-clip-padding text-sm shadow-lg outline-none",
            "transition duration-200 ease-in-out data-ending-style:translate-y-[2.5rem] data-ending-style:opacity-0 data-starting-style:translate-y-[2.5rem] data-starting-style:opacity-0",
            // From `lg`: a centered Dialog that zooms and fades.
            "lg:ring-foreground/10 lg:inset-x-auto lg:top-1/2 lg:bottom-auto lg:left-1/2 lg:w-full lg:max-w-lg lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-xl lg:border-t-0 lg:shadow-none lg:ring-1 lg:duration-100",
            "lg:data-ending-style:-translate-y-1/2 lg:data-ending-style:scale-95 lg:data-starting-style:-translate-y-1/2 lg:data-starting-style:scale-95",
          ].join(" ")}
        >
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
