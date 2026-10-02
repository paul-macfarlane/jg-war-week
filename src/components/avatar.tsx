import {
  AvatarFallback,
  AvatarImage,
  Avatar as AvatarRoot,
} from "@/components/ui/avatar";
import { avatarColors, initials } from "@/lib/avatar";

/**
 * A Participant's Avatar: their picture (a Profile picture URL or Google
 * photo, see `resolveProfile`) when there is one, else, and while it loads
 * or if it fails, their initials in their Team's color, or the Appearance
 * Theme's primary color with no Team. Decorative next to the visible name,
 * so screen readers skip it.
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
  primaryColor: string;
  image?: string | null;
  className?: string;
}) {
  const { fill, text } = avatarColors({ teamColor, primaryColor });
  return (
    <AvatarRoot aria-hidden className={className}>
      {image && (
        // The picture's host sees the viewer's IP address, not the page.
        <AvatarImage src={image} alt="" referrerPolicy="no-referrer" />
      )}
      <AvatarFallback
        className="text-xs font-semibold"
        style={{ backgroundColor: fill, color: text }}
      >
        {initials(name)}
      </AvatarFallback>
    </AvatarRoot>
  );
}
