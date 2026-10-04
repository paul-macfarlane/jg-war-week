/**
 * What the Head-to-head and Best score input parsers share: the first zod
 * issue as a refusal, and a Score's shape. Pure.
 */
import { z } from "zod";

import type { Parsed } from "@/lib/result";

export function firstError<T>(
  result: z.ZodSafeParseResult<T>,
): Parsed<never> & { ok: false } {
  const issue = result.error!.issues[0];
  const field = typeof issue.path[0] === "string" ? issue.path[0] : null;
  return {
    ok: false,
    error: issue.message,
    ...(field ? { fieldErrors: { [field]: issue.message } } : {}),
  };
}

/** A Score as numeric(12,3): at most 9 integer digits and 3 decimal places. */
export const scoreSchema = z
  .union([z.number(), z.string().trim()])
  .transform((value, ctx) => {
    const n = typeof value === "number" ? value : Number(value);
    if (value === "" || Number.isNaN(n)) {
      ctx.addIssue({ code: "custom", message: "Enter a score." });
      return z.NEVER;
    }
    return n;
  })
  .refine((n) => Math.abs(n) < 10 ** 9, { error: "That score is too large." })
  .refine((n) => Math.round(n * 1000) / 1000 === n, {
    error: "A score has at most 3 decimal places.",
  });
