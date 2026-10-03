"use client";

import { deleteDiscretionaryPoints } from "@/actions/discretionary-points";
import {
  DiscretionaryPointsForm,
  type DiscretionaryTarget,
} from "@/components/discretionary-points-form";
import {
  SETUP_EDITOR,
  SetupAddButton,
  SetupListRow,
} from "@/components/setup-row";
import type { WarWeek } from "@/db/schema";
import { formatPoints, formatPointsLabel } from "@/lib/points";
import { formatLedgerTime } from "@/lib/points-entry";

export type DiscretionaryLedgerItem = {
  id: string;
  targetId: string;
  target: string;
  points: number;
  reason: string;
  enteredByEmail: string;
  enteredAt: Date;
  editedAt: Date | null;
};

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
  entries: DiscretionaryLedgerItem[];
  targets: DiscretionaryTarget[];
  teamLabel: string;
  mode: WarWeek["mode"];
}) {
  const form = (
    close: () => void,
    entry?: DiscretionaryLedgerItem,
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
