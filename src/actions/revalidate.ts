import { revalidatePath } from "next/cache";

/**
 * The one revalidation rule, run after a successful write:
 *
 * - `"edition"` (default): the War Week's own routes, `/{edition}` and
 *   `/admin`, for any write that only changes what they show: Days, Teams,
 *   Participants, Competitions and their Hosts, Brackets, Points Entries,
 *   Schedule, FAQ, Awards and Announcements. A past War Week's own page
 *   (its Teams and Awards) is one of those routes.
 * - `"site"`: `/`, the whole site, only when the write changes the header
 *   or the Archive list (`/history`), which read the War Week row itself:
 *   its settings and Appearance Theme, and its lifecycle status (start,
 *   end, reopen, create next).
 *
 * The global Organizer list and the admin edition switcher aren't War Week
 * writes and use `revalidateSite` and `revalidateAdmin` directly.
 */
export function revalidateWarWeek(
  edition: string,
  reach: "edition" | "site" = "edition",
): void {
  if (reach === "site") {
    revalidateSite();
    return;
  }
  revalidateAdmin();
  revalidatePath(`/${edition}`, "layout");
}

/** Every page: see `revalidateWarWeek`. */
export function revalidateSite(): void {
  revalidatePath("/", "layout");
}

/** `/admin` only: see `revalidateWarWeek`. */
export function revalidateAdmin(): void {
  revalidatePath("/admin", "layout");
}
