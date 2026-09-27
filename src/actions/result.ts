import { unstable_rethrow } from "next/navigation";

/** What an action returns when something it didn't expect goes wrong. */
export const UNEXPECTED_ERROR = "Something went wrong. Try again.";

/**
 * Runs a server action's body so it never throws: an unexpected failure (a
 * database error, an unmapped unique violation) is logged and comes back as
 * the action's `{ ok: false, error }`. Next's own control flow (`redirect()`,
 * `notFound()`, dynamic rendering bailouts) still propagates.
 */
export async function guarded<R>(
  run: () => Promise<R>,
): Promise<R | { ok: false; error: string }> {
  try {
    return await run();
  } catch (error) {
    unstable_rethrow(error);
    console.error("Server action failed:", error);
    return { ok: false, error: UNEXPECTED_ERROR };
  }
}
