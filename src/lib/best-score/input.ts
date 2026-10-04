/**
 * Validation for logging or editing a Best score Attempt: the Participant
 * (`player`) and their Score. Never throws; returns the first error,
 * worded for the person filling in the form.
 */
import { z } from "zod";

import { firstError, scoreSchema } from "@/lib/logged-input";
import type { Parsed } from "@/lib/result";

export type AttemptInput = { participantId: string; score: number };

export function parseAttemptInput(
  raw: Record<string, unknown>,
): Parsed<AttemptInput> {
  const schema = z.object({
    player: z.uuid({ error: "Choose a Participant." }),
    score: scoreSchema,
  });
  const result = schema.safeParse(raw);
  if (!result.success) return firstError(result);
  return {
    ok: true,
    value: { participantId: result.data.player, score: result.data.score },
  };
}

/**
 * The Participant id an Attempt request posts (`player`), read before the
 * input is parsed so the authorize step can check it; null when absent.
 */
export function postedAttemptParticipantId(input: unknown): string | null {
  if (typeof input !== "object" || input === null) return null;
  const id = (input as Record<string, unknown>).player;
  return typeof id === "string" && id !== "" ? id : null;
}
