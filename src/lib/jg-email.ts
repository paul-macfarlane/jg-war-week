import { z } from "zod";

import { isJahnelGroupEmail } from "@/lib/access";

/** The one refusal for an email that isn't a Jahnel Group email. */
export const JG_EMAIL_MESSAGE = "Use an @jahnelgroup.com email.";

/**
 * A Jahnel Group email as it's stored: trimmed, lowercased, a valid email
 * within the 254-character columns, on exactly `jahnelgroup.com`. Every
 * failure is the one `JG_EMAIL_MESSAGE`, so the first issue says it all.
 */
export const jgEmailSchema = z
  .string({ error: JG_EMAIL_MESSAGE })
  .trim()
  .toLowerCase()
  .pipe(
    z
      .email({ error: JG_EMAIL_MESSAGE, abort: true })
      .max(254, { error: JG_EMAIL_MESSAGE, abort: true })
      .refine(isJahnelGroupEmail, { error: JG_EMAIL_MESSAGE }),
  );

/** A list of Jahnel Group emails (a Competition's Hosts). */
export const jgEmailListSchema = z.array(jgEmailSchema, {
  error: JG_EMAIL_MESSAGE,
});
