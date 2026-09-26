/**
 * What every write returns, from a mutation up through its server action to
 * the form or confirm that called it: done, or refused with a message.
 */
export type WriteResult = { ok: true } | { ok: false; error: string };

/** What an input parser returns: the parsed value, or the first error. */
export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };
