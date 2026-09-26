/** A refusal's message per field, keyed by the field's name. */
export type FieldErrors = Record<string, string>;

/**
 * What every write returns, from a mutation up through its server action to
 * the form or confirm that called it: done, or refused with a message.
 * `error` is the first message; `fieldErrors`, when present, names the
 * fields a form shows them under.
 */
export type WriteResult =
  { ok: true } | { ok: false; error: string; fieldErrors?: FieldErrors };

/** What an input parser returns: the parsed value, or the first error. */
export type Parsed<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; fieldErrors?: FieldErrors };
