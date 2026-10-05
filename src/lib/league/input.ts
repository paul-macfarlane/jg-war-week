/**
 * Parsing a League's pairing edit (reading R7): swap two Entrants within
 * one round. Server only (zod); the rule is `swapError` in `rules.ts`.
 * Never throws.
 */
import { z } from "zod";

import { CHOOSE_TWO_IN_ROUND } from "@/lib/league/rules";
import type { Parsed } from "@/lib/result";

export type SwapInput = { round: number; x: string; y: string };

const schema = z.object({
  round: z.number().int().min(1),
  x: z.uuid(),
  y: z.uuid(),
});

/** `{ round, x, y }`: a round number and two Entrant ids. */
export function parseSwapInput(input: unknown): Parsed<SwapInput> {
  const parsed = schema.safeParse(input);
  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, error: CHOOSE_TWO_IN_ROUND };
}
