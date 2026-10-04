import { cn } from "@/lib/utils";

/**
 * A Participant's Team by name, beside their name: a color dot and the Team
 * name, the one style every surface shares (the individual leaderboard's
 * Team tag). Colored text wouldn't read on every row's background, so the
 * color is the dot. Renders nothing without a Team, so a free-for-all War
 * Week shows none. `responsive` hides the name below `md`, for a row that
 * would wrap at 390 px: the Avatar's Team color stands in there.
 */
export function TeamTag({
  name,
  color,
  responsive = false,
  className,
}: {
  name: string | null | undefined;
  color: string | null | undefined;
  responsive?: boolean;
  className?: string;
}) {
  if (!name) return null;
  return (
    <span
      data-team-name={name}
      className={cn(
        "text-foreground/70 items-center gap-1 text-xs font-medium",
        responsive ? "hidden md:inline-flex" : "inline-flex",
        className,
      )}
    >
      {color ? (
        <span
          aria-hidden
          className="size-2 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
        />
      ) : null}
      {name}
    </span>
  );
}
