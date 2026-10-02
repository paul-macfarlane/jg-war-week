import { z } from "zod";

/** The name the account menu shows when no roster name is known: the email's local part. */
export function nameFromEmail(email: string): string {
  return email.split("@")[0] || email;
}

/**
 * What Delete my account posts: the email as typed. Anything else, or no
 * input at all, reads as empty, so it never matches.
 */
export const deleteAccountSchema = z
  .object({ confirmEmail: z.string().catch("") })
  .catch({ confirmEmail: "" });

export type DeleteAccountInput = z.input<typeof deleteAccountSchema>;
