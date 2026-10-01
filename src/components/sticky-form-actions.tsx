import { cn } from "@/lib/utils";

/**
 * A long admin form's submit row. Below `md` it sticks to the bottom of the
 * screen, above the admin section bar and the safe area; from `md` it sits
 * in the flow as it always has. The form keeps `pb-*` so its last field
 * scrolls clear, and `scroll-mb-*` on its fields so a focused one isn't
 * hidden under it.
 */
export function StickyFormActions({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sticky-form-actions"
      className={cn(
        "bg-background sticky bottom-(--admin-bar-inset) z-10 border-t py-3 md:static md:border-0 md:bg-transparent md:py-0",
        className,
      )}
      {...props}
    />
  );
}
