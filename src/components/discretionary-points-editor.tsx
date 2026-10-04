"use client";

import { deleteDiscretionaryPoints } from "@/actions/discretionary-points";
import {
  DiscretionaryPointsForm,
  type DiscretionaryTarget,
} from "@/components/discretionary-points-form";
import { TeamTag } from "@/components/participant-mark";
import {
  SETUP_EDITOR,
  SetupAddButton,
  SetupListRow,
} from "@/components/setup-row";
import type { WarWeek } from "@/db/schema";
import type { DiscretionaryLedgerEntry } from "@/lib/discretionary-points";
import { formatPoints, formatPointsLabel } from "@/lib/points";
import { formatLedgerTime } from "@/lib/points-entry";

/**
 * The Discretionary points ledger, newest first: each entry with its
 * reason, who entered it and when (and when it was edited), Edit (the form
 * in a Sheet) and Delete, then "Give Discretionary points".
 */
export function DiscretionaryPointsEditor({
  warWeekId,
  entries,
  targets,
  teamLabel,
  mode,
}: {
  warWeekId: string;
  entries: DiscretionaryLedgerEntry[];
  targets: DiscretionaryTarget[];
  teamLabel: string;
  mode: WarWeek["mode"];
}) {
  const form = (
    close: () => void,
    entry?: DiscretionaryLedgerEntry,
  ): React.ReactNode => (
    <DiscretionaryPointsForm
      warWeekId={warWeekId}
      targets={targets}
      teamLabel={teamLabel}
      mode={mode}
      entryId={entry?.id}
      initial={
        entry && {
          targetId: entry.targetId,
          points: String(entry.points),
          reason: entry.reason,
        }
      }
      onSaved={close}
    />
  );

  return (
    <div {...SETUP_EDITOR} className="flex flex-col gap-3">
      <SetupAddButton
        label="Give Discretionary points"
        form={(close) => form(close)}
      />
      <h2 className="mt-4 text-lg font-semibold">
        Ledger{" "}
        <span className="text-foreground/60 text-sm font-normal">
          ({entries.length} {entries.length === 1 ? "entry" : "entries"}, newest
          first)
        </span>
      </h2>
      {entries.length === 0 ? (
        <p className="text-foreground/70 text-sm">
          No Discretionary points yet.
        </p>
      ) : (
        <ol aria-label="Discretionary points">
          {entries.map((entry) => {
            const label = `${formatPointsLabel(entry.points)} to ${entry.target}`;
            return (
              <SetupListRow
                key={entry.id}
                id={entry.id}
                label={label}
                name={
                  <>
                    {entry.target}{" "}
                    {entry.targetTeam ? (
                      <TeamTag
                        name={entry.targetTeam.name}
                        color={entry.targetTeam.color}
                      />
                    ) : null}{" "}
                    <span className="tabular-nums">
                      {formatPoints(entry.points)}
                    </span>
                  </>
                }
                details={
                  <>
                    <span className="text-foreground block">
                      {entry.reason}
                    </span>
                    Entered by {entry.enteredByEmail} ·{" "}
                    {formatLedgerTime(entry.enteredAt)}
                    {entry.editedAt && (
                      <> · edited {formatLedgerTime(entry.editedAt)}</>
                    )}
                  </>
                }
                form={(close) => form(close, entry)}
                onDelete={() => deleteDiscretionaryPoints(entry.id)}
                deleteTitle={`Delete ${label}?`}
                deleteDescription={`Reason: ${entry.reason}`}
                deleteSuccess="Discretionary points deleted"
              />
            );
          })}
        </ol>
      )}
    </div>
  );
}
