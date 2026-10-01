"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

/**
 * A long admin form's submit row. Below `md` it sticks to the bottom of the
 * screen, above the admin section bar and the safe area; from `md` it sits
 * in the flow as it always has. The form keeps `pb-*` so its last field
 * scrolls clear, and `scroll-mb-*` on its fields so a focused one isn't
 * hidden under it.
 *
 * While mounted it publishes its height as `--admin-sticky-height` on the
 * document, which the admin Toaster adds to its offset so a toast (a
 * refusal, say) sits above the row instead of over Save. The admin root
 * resets the variable to 0 from `md`, where the row isn't sticky.
 */
export function StickyFormActions({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const root = document.documentElement.style;
    const observer = new ResizeObserver(() =>
      root.setProperty("--admin-sticky-height", `${element.offsetHeight}px`),
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      root.removeProperty("--admin-sticky-height");
    };
  }, []);

  return (
    <div
      ref={ref}
      data-slot="sticky-form-actions"
      className={cn(
        "bg-background sticky bottom-(--admin-bar-inset) z-10 border-t py-3 md:static md:border-0 md:bg-transparent md:py-0",
        className,
      )}
      {...props}
    />
  );
}
