import { z } from "zod";

import type { ArchiveAward } from "@/lib/archive";
import { fieldErrorsFrom } from "@/lib/form-errors";
import type { Parsed } from "@/lib/result";

/** The Award name's column length. */
export const AWARD_NAME_MAX = 120;

/** The Award description's column length. */
export const AWARD_DESCRIPTION_MAX = 1000;

export const NO_RECIPIENTS = "Choose a Team or at least one Participant.";

export const awardInputSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, { error: "must not be empty" })
      .max(AWARD_NAME_MAX, {
        error: `must be at most ${AWARD_NAME_MAX} characters`,
      }),
    description: z
      .string()
      .trim()
      .max(AWARD_DESCRIPTION_MAX, {
        error: `must be at most ${AWARD_DESCRIPTION_MAX} characters`,
      })
      .nullish()
      .transform((value) => value || null),
    teamId: z
      .uuid({ error: "Choose a Team of this War Week." })
      .nullish()
      .transform((value) => value ?? null),
    participantIds: z
      .array(z.uuid({ error: "Choose Participants of this War Week." }))
      .default([])
      .transform((ids) => [...new Set(ids)]),
  })
  .refine((a) => a.teamId != null || a.participantIds.length > 0, {
    error: NO_RECIPIENTS,
    path: ["participantIds"],
  });

/** The Award form's raw fields. */
export type AwardInput = {
  name: string;
  description: string | null;
  teamId: string | null;
  participantIds: string[];
};

export type AwardValues = z.infer<typeof awardInputSchema>;

const FIELD_LABELS: Record<string, string> = {
  name: "Name",
  description: "Description",
};

/**
 * Validates the Award form. Never throws; returns the first error and one
 * per refused field.
 */
export function parseAwardInput(input: AwardInput): Parsed<AwardValues> {
  const result = awardInputSchema.safeParse(input);
  if (result.success) return { ok: true, value: result.data };
  // Field schemas word their errors as "must …"; prefix the field.
  return {
    ok: false,
    ...fieldErrorsFrom(result.error, { labels: FIELD_LABELS }),
  };
}

/** An Award with its recipients, as the read path returns it. */
export type AwardView = {
  id: string;
  name: string;
  description: string | null;
  team: { id: string; name: string; color: string } | null;
  /** Ordered by display name. `teamColor` is null with no Team. */
  participants: { id: string; displayName: string; teamColor: string | null }[];
};

/** An Award with recipients by name only, as the Archive and MCP show it. */
export function namedAward(award: AwardView): ArchiveAward {
  return {
    name: award.name,
    description: award.description,
    team: award.team?.name ?? null,
    participants: award.participants.map((p) => p.displayName),
  };
}
