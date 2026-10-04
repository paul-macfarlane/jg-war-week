import {
  AvatarFallback,
  AvatarImage,
  Avatar as AvatarRoot,
} from "@/components/ui/avatar";
import { avatarColors, initials } from "@/lib/avatar";
import { cn } from "@/lib/utils";

/**
 * A Participant's Avatar: their picture (a Profile picture URL or Google
 * photo, see `resolveProfile`) when there is one, else, and while it loads
 * or if it fails, their initials in their Team's color, or the Appearance
 * Theme's primary color with no Team. A picture hides the Team-colored fill,
 * so a pictured Avatar with a Team wears a Team-colored ring (the Team rule,
 * CONTEXT.md). `data-team-color` carries the Team color either way.
 * Decorative next to the visible name, so screen readers skip it.
 */
export function Avatar({
  name,
  teamColor,
  primaryColor,
  image,
  className = "size-8",
}: {
  name: string;
  teamColor: string | null;
  /** The Appearance Theme's primary color; omitted, the themed `bg-primary` is used. */
  primaryColor?: string;
  image?: string | null;
  className?: string;
}) {
  // With no Team and no primary color given, the theme's own tokens fill it.
  const themed = teamColor === null && primaryColor === undefined;
  const { fill, text } = avatarColors({
    teamColor,
    primaryColor: primaryColor ?? "#000000",
  });
  return (
    <AvatarRoot
      aria-hidden
      className={className}
      data-team-color={teamColor ?? undefined}
      data-team-ring={image && teamColor ? "" : undefined}
      style={
        image && teamColor ? { outline: `2px solid ${teamColor}` } : undefined
      }
    >
      {image && (
        // The picture's host sees the viewer's IP address, not the page.
        <AvatarImage src={image} alt="" referrerPolicy="no-referrer" />
      )}
      <AvatarFallback
        className={cn(
          "text-xs font-semibold",
          themed && "bg-primary text-primary-foreground",
        )}
        style={themed ? undefined : { backgroundColor: fill, color: text }}
      >
        {initials(name)}
      </AvatarFallback>
    </AvatarRoot>
  );
}
