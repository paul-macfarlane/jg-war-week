import { APIError } from "better-auth";

import { JG_EMAIL_DOMAIN, isJahnelGroupEmail } from "@/lib/access";

/**
 * The sign-in domain rule, run by better-auth before a user row is created
 * or its email changed. Throws for any email off @jahnelgroup.com, whatever
 * else is true of it (a roster email, a Host assignment).
 */
export function rejectNonJahnelGroup(email: string | null | undefined) {
  if (!isJahnelGroupEmail(email)) {
    // The `code` makes better-auth's OAuth callback redirect to
    // `/sign-in?error=...` instead of answering with a bare 403.
    throw new APIError("FORBIDDEN", {
      code: "NOT_JAHNEL_GROUP",
      message: `Only @${JG_EMAIL_DOMAIN} accounts can sign in.`,
    });
  }
}
