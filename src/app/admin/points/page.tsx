import type { Metadata } from "next";
import Link from "next/link";

import { adminEditLinkClass } from "@/components/admin-edit-link";
import { AdminRefused, AdminShell } from "@/components/admin-shell";
import { DeletePointsEntryButton } from "@/components/delete-points-entry-button";
import { PointsEntryForm } from "@/components/points-entry-form";
import {
  IndividualStandingsList,
  TeamStandingsList,
} from "@/components/standings";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatLabel } from "@/lib/bracket/view";
import { isGameFormat } from "@/lib/enums";
import { formatPoints, formatPointsLabel } from "@/lib/points";
import { formatLedgerTime, generatedNote } from "@/lib/points-entry";
import { getBracketCompetitions } from "@/queries/brackets";
import { getGamesCompetitions } from "@/queries/games";
import { getParticipationCompetitions } from "@/queries/participation";
import {
  getAdminLedger,
  getPointsEntryFormOptions,
} from "@/queries/points-entries";
import { getStandings } from "@/queries/standings";

import { loadAdminPage } from "../gate";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Points · JG War Week" };

// A text link, at least 44px tall on phones.
const changeLink =
  "text-primary inline-flex min-h-11 items-center text-xs whitespace-nowrap underline-offset-4 hover:underline sm:min-h-0";

export default async function AdminPointsPage() {
  const { warWeek, email, allowed, isOrganizer, editions, runs } =
    await loadAdminPage("/admin/points");
  if (!allowed) return <AdminRefused warWeek={warWeek} email={email} />;

  const [
    allOptions,
    allLedger,
    standings,
    allBrackets,
    allGames,
    allParticipation,
  ] = await Promise.all([
    getPointsEntryFormOptions(warWeek),
    getAdminLedger(warWeek),
    getStandings(warWeek),
    getBracketCompetitions(warWeek),
    getGamesCompetitions(warWeek),
    getParticipationCompetitions(warWeek),
  ]);
  // A Host sees only their own Competitions in the form, ledger and Brackets.
  const options = {
    ...allOptions,
    competitions: allOptions.competitions.filter((c) => runs(c.id)),
  };
  const ledger = allLedger.filter((entry) => runs(entry.competitionId));
  const brackets = allBrackets.filter((b) => runs(b.id));
  const games = allGames.filter((g) => runs(g.id));
  const participations = allParticipation.filter((p) => runs(p.id));

  // A Bracket-, Games- or Participation-generated entry is changed where
  // it is made.
  const entryActions = (entry: (typeof ledger)[number]) =>
    entry.generatedByBracket ? (
      isGameFormat(entry.competitionFormat) ? (
        <Link
          href={`/admin/competitions/${entry.competitionId}/games`}
          className={changeLink}
        >
          Change in Games
        </Link>
      ) : entry.competitionFormat === "participation" ? (
        <Link
          href={`/admin/competitions/${entry.competitionId}/participation`}
          className={changeLink}
        >
          Change in Participation
        </Link>
      ) : (
        <Link
          href={`/admin/brackets/${entry.competitionId}`}
          className={changeLink}
        >
          Change in the Bracket
        </Link>
      )
    ) : (
      <div className="flex items-center gap-2">
        <Link href={`/admin/points/${entry.id}`} className={adminEditLinkClass}>
          Edit
        </Link>
        <DeletePointsEntryButton
          id={entry.id}
          description={`${formatPointsLabel(entry.points)} to ${entry.target} in ${entry.competition}`}
        />
      </div>
    );
  const entryNote = (entry: (typeof ledger)[number]) =>
    entry.generatedByBracket ? (
      <Badge variant="secondary">
        {generatedNote(entry.competitionFormat)}
      </Badge>
    ) : (
      entry.note
    );

  return (
    <AdminShell
      warWeek={warWeek}
      email={email}
      isOrganizer={isOrganizer}
      editions={editions}
      current="Points"
    >
      <div className="grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,24rem)_1fr]">
        {/* The quick links share the form's column: after the form, so it
            opens the page on a phone, and before the Standings. */}
        <div className="flex min-w-0 flex-col gap-8">
          <section className="flex flex-col gap-4">
            <h1 className="text-2xl font-bold">Add a Points Entry</h1>
            <PointsEntryForm
              options={options}
              teamLabel={warWeek.teamLabel}
              mode={warWeek.mode}
            />
          </section>
          {brackets.length > 0 && (
            <section className="flex flex-col gap-2" aria-label="Brackets">
              <h2 className="text-lg font-semibold">Brackets</h2>
              <ul className="flex flex-wrap gap-2">
                {brackets.map((b) => (
                  <li key={b.id}>
                    <Link
                      href={`/admin/brackets/${b.id}`}
                      className="border-border hover:bg-muted inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm font-medium"
                    >
                      {b.name}
                      <span className="text-foreground/60 text-xs font-normal">
                        {formatLabel(b.format)}
                        {b.finalizedAt ? " · finalized" : ""}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {games.length > 0 && (
            <section className="flex flex-col gap-2" aria-label="Games">
              <h2 className="text-lg font-semibold">Games</h2>
              <ul className="flex flex-wrap gap-2">
                {games.map((g) => (
                  <li key={g.id}>
                    <Link
                      href={`/admin/competitions/${g.id}/games`}
                      className="border-border hover:bg-muted inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm font-medium"
                    >
                      {g.name}
                      <span className="text-foreground/60 text-xs font-normal">
                        {g.finalizedAt ? "closed" : "open"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {participations.length > 0 && (
            <section className="flex flex-col gap-2" aria-label="Participation">
              <h2 className="text-lg font-semibold">Participation</h2>
              <ul className="flex flex-wrap gap-2">
                {participations.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/admin/competitions/${p.id}/participation`}
                      className="border-border hover:bg-muted inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm font-medium"
                    >
                      {p.name}
                      <span className="text-foreground/60 text-xs font-normal">
                        {p.finalizedAt ? "closed" : "open"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <section
          className="flex min-w-0 flex-col gap-4"
          aria-label="Admin standings"
        >
          <h2 className="text-lg font-semibold">Current standings</h2>
          <div className="grid gap-6 xl:grid-cols-2">
            {standings.main === "team" && (
              <div className="flex flex-col gap-2">
                <h3 className="font-medium">{warWeek.teamLabel} standings</h3>
                <TeamStandingsList rows={standings.team} />
              </div>
            )}
            <div className="flex flex-col gap-2">
              <h3 className="font-medium">
                {standings.main === "individual"
                  ? "Standings"
                  : "Individual leaderboard"}
              </h3>
              <IndividualStandingsList rows={standings.individual} />
            </div>
          </div>
        </section>
      </div>

      <section className="mt-10 flex flex-col gap-3" aria-label="Ledger">
        <h2 className="text-lg font-semibold">
          Ledger{" "}
          <span className="text-foreground/60 text-sm font-normal">
            ({ledger.length} {ledger.length === 1 ? "entry" : "entries"}, newest
            first)
          </span>
        </h2>
        {ledger.length === 0 ? (
          <p className="text-foreground/70 text-sm">No Points Entries yet.</p>
        ) : (
          <>
            <ul className="flex flex-col gap-3 md:hidden">
              {ledger.map((entry) => (
                <li key={entry.id}>
                  <Card size="sm" className="gap-2 px-4 py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="min-w-0 font-medium">
                        {entry.target}
                        <span className="text-foreground/70 block text-xs font-normal">
                          {entry.competition}
                        </span>
                      </p>
                      <p className="text-lg font-semibold tabular-nums">
                        {formatPoints(entry.points)}
                      </p>
                    </div>
                    {(entry.generatedByBracket || entry.note) && (
                      <p className="text-foreground/70 break-words">
                        {entryNote(entry)}
                      </p>
                    )}
                    <p className="text-foreground/60 text-xs break-words">
                      Entered by {entry.enteredByEmail} ·{" "}
                      {formatLedgerTime(entry.enteredAt)}
                      {entry.editedAt && (
                        <span className="block">
                          edited {formatLedgerTime(entry.editedAt)}
                        </span>
                      )}
                    </p>
                    <div>{entryActions(entry)}</div>
                  </Card>
                </li>
              ))}
            </ul>
            <div className="relative hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="text-foreground/60 border-border border-b">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Competition</th>
                    <th className="py-2 pr-4 font-medium">Awarded to</th>
                    <th className="py-2 pr-4 text-right font-medium">Points</th>
                    <th className="py-2 pr-4 font-medium">Note</th>
                    <th className="py-2 pr-4 font-medium">Entered by</th>
                    <th className="py-2 pr-4 font-medium">Entered at (ET)</th>
                    <th className="py-2 font-medium">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((entry) => (
                    <tr key={entry.id} className="border-border border-b">
                      <td className="py-2 pr-4">{entry.competition}</td>
                      <td className="py-2 pr-4 font-medium">{entry.target}</td>
                      <td className="py-2 pr-4 text-right font-semibold tabular-nums">
                        {formatPoints(entry.points)}
                      </td>
                      <td className="text-foreground/70 py-2 pr-4">
                        {entryNote(entry)}
                      </td>
                      <td className="py-2 pr-4">{entry.enteredByEmail}</td>
                      <td className="py-2 pr-4 whitespace-nowrap">
                        {formatLedgerTime(entry.enteredAt)}
                        {entry.editedAt && (
                          <span className="text-foreground/60 block text-xs">
                            edited {formatLedgerTime(entry.editedAt)}
                          </span>
                        )}
                      </td>
                      <td className="py-2">{entryActions(entry)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </AdminShell>
  );
}
