"use client";

import { LeagueRounds, LeagueYouMark } from "@/components/league-rounds";
import { Lead, RowTeam } from "@/components/logged-results-view";
import { ResultsTable, type ResultsTableRow } from "@/components/results-table";
import { TOP_PLACES, TopFinishers } from "@/components/top-finishers";
import { Card } from "@/components/ui/card";
import { formatMatchPoints } from "@/lib/league/standings";
import { type ResultsStat, winnerKeys } from "@/lib/results-table";
import type { LeagueView as LeagueData } from "@/queries/league";

const asPoints = (value: number | string) =>
  typeof value === "number" ? formatMatchPoints(value) : value;

const asHalves = (value: number | string) => String(value);

/** The results table's stat columns for the League's Pairing (reading R6). */
export function leagueStats(pairing: "round-robin" | "swiss"): ResultsStat[] {
  return [
    { id: "wins", header: "W", label: "W", fold: true, labelAfter: true },
    { id: "draws", header: "D", label: "D", fold: true, labelAfter: true },
    { id: "losses", header: "L", label: "L", fold: true, labelAfter: true },
    {
      id: "matchPoints",
      header: "Match points",
      label: "Match points",
      fold: false,
      format: asPoints,
    },
    ...(pairing === "round-robin"
      ? [
          {
            id: "headToHead",
            header: "H2H",
            label: "H2H",
            fold: true,
            format: asPoints,
          },
          {
            id: "sonnebornBerger",
            header: "SB",
            label: "SB",
            fold: true,
            format: asHalves,
          },
        ]
      : [
          {
            id: "buchholz",
            header: "Buchholz",
            label: "Buchholz",
            fold: true,
            format: asHalves,
          },
        ]),
  ];
}

/**
 * A League's page (spec R23, decisions 10 and 11): Top finishers once
 * Closed (R14), the results table with W · D · L · Match points and the
 * tiebreaks and the Provisional badge while open, "Your next Match" for a
 * linked Participant, and the rounds with the viewer's Match highlighted
 * and Record result where the server allows it. Names, ids and booleans
 * only, never an email.
 */
export function LeagueView({
  view,
  primaryColor,
  teamLabel,
  now,
}: {
  view: LeagueData;
  primaryColor: string;
  /** What this War Week calls a Team, for a team League's header. */
  teamLabel: string;
  now: Date;
}) {
  const { competition, standings, entrants, rounds, linked } = view;
  const scoring = competition.scoring;
  const pairing = competition.config.pairing;
  const byId = new Map(entrants.map((e) => [e.id, e]));

  const tableRows: ResultsTableRow[] = standings.map((row) => {
    const entrant = byId.get(row.entrantId);
    return {
      key: row.entrantId,
      rank: row.rank,
      name: row.name,
      lead: <Lead scoring={scoring} row={row} primaryColor={primaryColor} />,
      after: entrant ? (
        <LeagueYouMark entrant={entrant} scoring={scoring} linked={linked} />
      ) : null,
      detail: (
        <RowTeam scoring={scoring} row={{ ...row, teamName: row.team }} />
      ),
      points: row.points,
      stats: {
        wins: row.wins,
        draws: row.draws,
        losses: row.losses,
        matchPoints: row.matchPoints,
        headToHead: row.headToHead,
        sonnebornBerger: row.sonnebornBerger,
        buchholz: row.buchholz,
      },
      className: row.yours ? "bg-accent/40" : undefined,
    };
  });
  const winners = winnerKeys(tableRows);
  const finishers = competition.closed
    ? standings.flatMap((row) =>
        row.rank <= TOP_PLACES
          ? [
              {
                key: row.entrantId,
                place: row.rank,
                name: row.name,
                points: row.points,
                lead: (
                  <Lead
                    scoring={scoring}
                    row={row}
                    primaryColor={primaryColor}
                  />
                ),
                team: (
                  <RowTeam
                    scoring={scoring}
                    row={{ ...row, teamName: row.team }}
                  />
                ),
              },
            ]
          : [],
      )
    : [];

  const next = view.yourNextMatch;
  const nextText = next
    ? next.opponent === null
      ? `Round ${next.round} · You have a bye`
      : `Round ${next.round} · v ${next.opponent}`
    : null;

  return (
    <div className="flex flex-col gap-6">
      {next && nextText ? (
        <Card size="sm" className="gap-1 px-4">
          <section
            aria-labelledby="league-next-match"
            className="flex flex-col gap-1"
          >
            <h3
              id="league-next-match"
              className="text-foreground/70 text-sm font-semibold"
            >
              Your next Match
            </h3>
            <p className="font-medium break-words">{nextText}</p>
          </section>
        </Card>
      ) : null}

      {entrants.length === 0 ? (
        <p className="text-foreground/70 text-sm">No Entrants yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          <TopFinishers finishers={finishers} winners={winners} />
          <ResultsTable
            rows={tableRows}
            label="League results"
            entrantHeader={scoring === "team" ? teamLabel : "Participant"}
            provisional={view.provisional}
            stats={leagueStats(pairing)}
          />
        </div>
      )}

      {rounds.length === 0 ? (
        entrants.length > 0 ? (
          <p className="text-foreground/70 text-sm">
            Round 1 isn&apos;t paired yet.
          </p>
        ) : null
      ) : (
        <LeagueRounds
          competitionId={competition.id}
          scoring={scoring}
          pairing={pairing}
          scoreDirection={competition.scoreDirection}
          scoreUnit={competition.scoreUnit}
          entrants={entrants}
          rounds={rounds}
          // Edit pairings is the admin page's.
          runs={false}
          linked={linked}
          now={now}
        />
      )}
    </div>
  );
}
