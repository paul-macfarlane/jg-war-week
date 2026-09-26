/**
 * What every write returns, from a mutation up through its server action to
 * the form or confirm that called it: done, or refused with a message.
 */
export type WriteResult = { ok: true } | { ok: false; error: string };
