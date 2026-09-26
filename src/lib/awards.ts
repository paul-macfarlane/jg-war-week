import { z } from "zod";

import type { ArchiveAward } from "@/lib/archive";

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

/** Validates the Award form. Never throws; returns the first error. */
export function parseAwardInput(
  input: AwardInput,
): { ok: true; value: AwardValues } | { ok: false; error: string } {
  const result = awardInputSchema.safeParse(input);
  if (result.success) return { ok: true, value: result.data };

  const issue = result.error.issues[0];
  const label = FIELD_LABELS[String(issue.path[0])];
  // Field schemas word their errors as "must …"; prefix the field.
  const message =
    label && issue.message.startsWith("must ")
      ? `${label} ${issue.message}.`
      : issue.message;
  return { ok: false, error: message };
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
