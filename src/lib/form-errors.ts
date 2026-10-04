import type { z } from "zod";

import type { FieldErrors } from "@/lib/result";

type Issue = z.core.$ZodIssue;

export type FieldErrorsOptions = {
  /** A field's label, keyed by its top-level name ("Points", "Title"…). */
  labels?: Record<string, string>;
  /** Words an issue itself; null falls back to the label + "must …" rule. */
  describe?: (issue: Issue) => string | null;
};

/**
 * One issue as a sentence: `describe`'s wording, else "<Label> must …." when
 * the field has a label and the schema words its error as "must …", else the
 * schema's own message.
 */
function issueMessage(issue: Issue, options: FieldErrorsOptions): string {
  const described = options.describe?.(issue);
  if (described) return described;
  const label = options.labels?.[String(issue.path[0])];
  return label && issue.message.startsWith("must ")
    ? `${label} ${issue.message}.`
    : issue.message;
}

/**
 * Turns a form's zod refusal into the first message (`error`) and one
 * message per field (`fieldErrors`), keyed by the top-level field name, so a
 * nested issue such as `body.content.2` lands on `body`. The first issue
 * per field wins; an issue on the whole input goes to `error` only.
 */
export function fieldErrorsFrom(
  error: z.ZodError,
  options: FieldErrorsOptions = {},
): { error: string; fieldErrors: FieldErrors } {
  const fieldErrors: FieldErrors = {};
  for (const issue of error.issues) {
    if (issue.path.length === 0) continue;
    const field = String(issue.path[0]);
    if (!(field in fieldErrors)) {
      fieldErrors[field] = issueMessage(issue, options);
    }
  }
  const [first] = error.issues;
  return {
    error: first ? issueMessage(first, options) : error.message,
    fieldErrors,
  };
}
