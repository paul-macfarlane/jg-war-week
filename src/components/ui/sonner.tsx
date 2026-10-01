"use client";

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useEffect } from "react";
import { Toaster as Sonner, type ToasterProps, toast } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      // No light/dark toggle: the Appearance Theme's CSS variables color the toast.
      theme="light"
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

/**
 * JG War Week edit: dismisses every toast when it mounts. Render it inside
 * a popup that opens at the bottom of the screen, where the Toaster sits,
 * so an earlier result's toast doesn't cover the popup's fields (Sonner
 * keeps a hovered toast open, so one under the pointer would never go).
 */
function DismissToasts() {
  useEffect(() => {
    toast.dismiss();
  }, []);
  return null;
}

export { DismissToasts, Toaster };
