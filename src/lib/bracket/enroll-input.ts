/**
 * Self-enroll's settings as typed (ADR 0006): the switch and the Entrant
 * limit, a blank limit meaning none, and
 * the refusals the Competition page's per-field save
 * (`parseCompetitionSetting`) shows for each. Pure.
 */
/** A self-enroll switch value that isn't on or off. */
export const ENROLL_SWITCH_INVALID = "Turn enrollment on or off.";
/** An Entrant limit of 1 or less (the column's CHECK, as a refusal). */
export const ENTRANT_LIMIT_TOO_LOW = "An Entrant limit is at least 2.";

export type SelfEnrollInput = {
  on: boolean;
  entrantLimit: number | null;
};

/**
 * An Entrant limit: blank or absent is none; else a whole number of at
 * least 2 (`ok: false` otherwise, including a value of another type).
 */
export function limitOf(value: unknown): { ok: boolean; value: number | null } {
  if (value === null || value === undefined) return { ok: true, value: null };
  if (typeof value !== "string" && typeof value !== "number") {
    return { ok: false, value: null };
  }
  if (typeof value === "string" && value.trim() === "") {
    return { ok: true, value: null };
  }
  const n = typeof value === "number" ? value : Number(value.trim());
  return Number.isInteger(n) && n > 1
    ? { ok: true, value: n }
    : { ok: false, value: null };
}
