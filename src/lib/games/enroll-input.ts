/**
 * The enroll switch's input (ADR 0006): `{ on, entrantLimit,
 * enrollClosesAt }`, with a blank limit or close time meaning none. Pure.
 */
import { z } from "zod";

import type { Parsed } from "@/lib/result";

export const ENROLL_SWITCH_INVALID = "Turn enrollment on or off.";
/** An Entrant limit of 1 or less (the column's CHECK, as a refusal). */
export const ENTRANT_LIMIT_TOO_LOW = "An Entrant limit is at least 2.";
export const ENROLL_CLOSES_AT_INVALID =
  "Enter the close time as a date and time.";

export type SelfEnrollInput = {
  on: boolean;
  entrantLimit: number | null;
  enrollClosesAt: Date | null;
};

const schema = z.object({
  on: z.boolean(),
  entrantLimit: z.union([z.string(), z.number(), z.null()]).optional(),
  enrollClosesAt: z.union([z.string(), z.date(), z.null()]).optional(),
});

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

/**
 * A close time: blank or absent is none; else a date string or a Date that
 * is a real time (`ok: false` otherwise, including a value of another type).
 */
export function closesAtOf(value: unknown): {
  ok: boolean;
  value: Date | null;
} {
  if (value === null || value === undefined) return { ok: true, value: null };
  if (typeof value !== "string" && !(value instanceof Date)) {
    return { ok: false, value: null };
  }
  if (typeof value === "string" && value.trim() === "") {
    return { ok: true, value: null };
  }
  const date = typeof value === "string" ? new Date(value.trim()) : value;
  return Number.isNaN(date.getTime())
    ? { ok: false, value: null }
    : { ok: true, value: date };
}

/** Parses the enroll switch's input; the first error wins. */
export function parseSelfEnrollInput(input: unknown): Parsed<SelfEnrollInput> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: ENROLL_SWITCH_INVALID };
  const limit = limitOf(parsed.data.entrantLimit);
  if (!limit.ok) {
    return {
      ok: false,
      error: ENTRANT_LIMIT_TOO_LOW,
      fieldErrors: { entrantLimit: ENTRANT_LIMIT_TOO_LOW },
    };
  }
  const closesAt = closesAtOf(parsed.data.enrollClosesAt);
  if (!closesAt.ok) {
    return {
      ok: false,
      error: ENROLL_CLOSES_AT_INVALID,
      fieldErrors: { enrollClosesAt: ENROLL_CLOSES_AT_INVALID },
    };
  }
  return {
    ok: true,
    value: {
      on: parsed.data.on,
      entrantLimit: limit.value,
      enrollClosesAt: closesAt.value,
    },
  };
}
