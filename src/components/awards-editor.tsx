"use client";

import { deleteAward } from "@/actions/awards";
import {
  AwardForm,
  type AwardFormPickerOptions,
} from "@/components/award-form";
import {
  SETUP_EDITOR,
  SetupAddButton,
  SetupListRow,
} from "@/components/setup-row";
import type { WarWeek } from "@/db/schema";
import type { AwardView } from "@/lib/awards";

/**
 * The War Week's Awards by name, each with its recipients, Edit (the form
 * in a Sheet) and Delete, then "Add Award".
 */
export function AwardsEditor({
  warWeekId,
  awards,
  options,
  teamLabel,
  mode,
  showTeam,
}: {
  /** The War Week this page was rendered for; creates post it. */
  warWeekId: string;
  awards: AwardView[];
  options: AwardFormPickerOptions;
  /** The War Week's Team Label, e.g. "House". */
  teamLabel: string;
  mode: WarWeek["mode"];
  /** False in a free-for-all with no Team on any Award. */
  showTeam: boolean;
}) {
  const formProps = { warWeekId, options, teamLabel, mode };
  return (
    <div {...SETUP_EDITOR} className="flex flex-col gap-3">
      {awards.length === 0 ? (
        <p className="text-foreground/70 text-sm">No Awards yet.</p>
      ) : (
        <ul aria-label="Awards">
          {awards.map((award) => (
            <SetupListRow
              key={award.id}
              id={award.id}
              name={award.name}
              details={[
                showTeam && `${teamLabel}: ${award.team?.name ?? "—"}`,
                award.category &&
                  `Category: ${award.category.name}${award.category.archived ? " (archived)" : ""}`,
                `Participants: ${
                  award.participants.map((p) => p.displayName).join(", ") || "—"
                }`,
              ]
                .filter(Boolean)
                .join(" · ")}
              form={(close) => (
                <AwardForm
                  {...formProps}
                  awardId={award.id}
                  currentCategory={award.category}
                  initial={{
                    name: award.name,
                    description: award.description,
                    teamId: award.team?.id ?? null,
                    categoryId: award.category?.id ?? null,
                    participantIds: award.participants.map((p) => p.id),
                  }}
                  onSaved={close}
                />
              )}
              onDelete={() => deleteAward(award.id)}
              deleteTitle={`Delete "${award.name}"?`}
              deleteSuccess="Award deleted"
            />
          ))}
        </ul>
      )}
      <SetupAddButton
        label="Add Award"
        form={(close) => <AwardForm {...formProps} onSaved={close} />}
      />
    </div>
  );
}
