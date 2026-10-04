import { Avatar } from "@/components/avatar";
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

/**
 * The one Participant display: Avatar, name and, in a teams War Week, the
 * Team (the Team rule, CONTEXT.md). `team="color"` leaves the Team to the
 * Avatar's color alone, where there is no room for the name.
 */
export function ParticipantMark({
  name,
  image,
  teamName,
  teamColor,
  primaryColor,
  team = "name",
  className,
  avatarClassName,
}: {
  name: string;
  image?: string | null;
  teamName?: string | null;
  teamColor: string | null;
  primaryColor?: string;
  team?: "name" | "color";
  className?: string;
  avatarClassName?: string;
}) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
      <Avatar
        name={name}
        teamColor={teamColor}
        primaryColor={primaryColor}
        image={image}
        className={avatarClassName}
      />
      <span className="min-w-0 break-words">{name}</span>
      {team === "name" ? <TeamTag name={teamName} color={teamColor} /> : null}
    </span>
  );
}
