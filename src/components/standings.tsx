import { Avatar } from "@/components/avatar";
import { ResultsTable } from "@/components/results-table";
import { Card } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { YouTag } from "@/components/you";
import { type RowFinale, countUpTotal } from "@/lib/finale";
import { formatPoints } from "@/lib/points";
import type {
  PointsBreakdown,
  PointsBreakdownRow,
} from "@/lib/points-breakdown";
import { formatLedgerTime } from "@/lib/points-entry";
import type {
  IndividualStanding,
  Standings,
  TeamStanding,
} from "@/lib/standings";
import { YOU_ROW_CLASS } from "@/lib/you";

function NoPointsYet() {
  return <p className="text-foreground/70 text-sm">No points yet.</p>;
}

/**
 * A row's classes and shown total during the Finale (`finale` is the row's
 * state, or undefined when no Finale is playing). Rows not yet shown stay
 * in place but invisible, so the list doesn't jump.
 */
function finaleRow(total: number, finale: RowFinale | undefined) {
  if (!finale) return { className: "", total };
  return {
    className: finale.shown
      ? "translate-y-0 opacity-100 transition-all duration-500"
      : "translate-y-2 opacity-0",
    total: countUpTotal(total, finale.progress),
  };
}

/** The Points Entries behind a row's total, shown once its disclosure opens. */
function PointsBreakdownList({ rows }: { rows: PointsBreakdownRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-foreground/60 border-t pt-2 text-xs">
        No Points Entries yet.
      </p>
    );
  }
  return (
    <ol className="flex flex-col gap-1.5 border-t pt-2 text-xs">
      {rows.map((row) => (
        <li
          key={row.id}
          className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5"
        >
          <span className="text-foreground/80 min-w-0">{row.competition}</span>
          <span className="flex items-baseline gap-3">
            <span className="text-foreground/60 whitespace-nowrap">
              {formatLedgerTime(row.when)}
            </span>
            <span className="font-medium whitespace-nowrap tabular-nums">
              {formatPoints(row.points)}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}

export function TeamStandingsList({
  rows,
  finale,
  breakdown,
}: {
  rows: TeamStanding[];
  /** Each row's Finale state, in row order, while the Finale plays. */
  finale?: RowFinale[];
  /** Each Team's Points Entries by id; when given, rows expand to show them. */
  breakdown?: Map<string, PointsBreakdownRow[]>;
}) {
  if (rows.length === 0) return <NoPointsYet />;

  return (
    <ol className="flex flex-col gap-2">
      {rows.map((row, i) => {
        const shown = finaleRow(row.total, finale?.[i]);
        const rowBreakdown = breakdown?.get(row.id);
        const content = (
          <>
            <span className="text-foreground/60 w-6 text-sm font-medium tabular-nums">
              {row.rank}
            </span>
            <span
              aria-hidden
              className="size-4 shrink-0 rounded-full"
              style={{ backgroundColor: row.color }}
            />
            <span className="flex-1 font-semibold">{row.name}</span>
            <span className="text-xl font-bold tabular-nums">
              {formatPoints(shown.total)}
            </span>
          </>
        );
        return (
          <li key={row.id} className={shown.className || undefined}>
            {rowBreakdown ? (
              <Collapsible>
                <Card size="sm" className="flex flex-col gap-2 px-4 py-3">
                  <CollapsibleTrigger className="flex w-full items-center gap-3 text-left">
                    {content}
                    <span className="sr-only">, show points breakdown</span>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <PointsBreakdownList rows={rowBreakdown} />
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            ) : (
              <Card size="sm" className="flex-row items-center gap-3 px-4 py-3">
                {content}
              </Card>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function IndividualStandingsList({
  rows,
  finale,
  primaryColor,
  breakdown,
}: {
  rows: IndividualStanding[];
  /** Each row's Finale state, in row order, while the Finale plays. */
  finale?: RowFinale[];
  /**
   * The Appearance Theme primary color. When given, each row shows the
   * Participant's Avatar (admin omits it).
   */
  primaryColor?: string;
  /**
   * Each Participant's Points Entries by id; when given, rows expand to
   * show them.
   */
  breakdown?: Map<string, PointsBreakdownRow[]>;
}) {
  if (rows.length === 0) return <NoPointsYet />;

  return (
    <Card size="sm" className="py-1">
      <ol className="flex flex-col divide-y px-(--card-spacing)">
        {rows.map((row, i) => {
          const { team } = row;
          const shown = finaleRow(row.total, finale?.[i]);
          const rowBreakdown = breakdown?.get(row.id);
          const content = (
            <>
              <span className="text-foreground/60 w-6 text-sm font-medium tabular-nums">
                {row.rank}
              </span>
              {primaryColor ? (
                <Avatar
                  name={row.name}
                  teamColor={team?.color ?? null}
                  primaryColor={primaryColor}
                  image={row.image}
                />
              ) : null}
              <span className="flex-1">
                {row.name}
                {team ? (
                  <span
                    className="ml-2 text-xs font-medium"
                    style={{ color: team.color }}
                  >
                    {team.name}
                  </span>
                ) : null}
              </span>
              <YouTag participantId={row.id} />
              <span className="font-semibold tabular-nums">
                {formatPoints(shown.total)}
              </span>
            </>
          );
          return (
            <li
              key={row.id}
              className={`px-2 py-2 ${YOU_ROW_CLASS} ${shown.className}`}
            >
              {rowBreakdown ? (
                <Collapsible>
                  <div className="flex flex-col gap-2">
                    <CollapsibleTrigger className="flex w-full items-center gap-3 text-left">
                      {content}
                      <span className="sr-only">, show points breakdown</span>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <PointsBreakdownList rows={rowBreakdown} />
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ) : (
                <div className="flex items-center gap-3">{content}</div>
              )}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

/** The home page's main leaderboard. */
export function HomeStandings({
  standings,
  individualLimit,
  primaryColor,
  breakdown,
}: {
  standings: Standings;
  /** How many individual rows the home page shows. */
  individualLimit: number;
  /** The Appearance Theme primary color, for Avatars with no Team. */
  primaryColor: string;
  breakdown?: PointsBreakdown;
}) {
  return standings.main === "team" ? (
    <TeamStandingsList rows={standings.team} breakdown={breakdown?.byTeam} />
  ) : (
    <IndividualStandingsList
      rows={standings.individual.slice(0, individualLimit)}
      primaryColor={primaryColor}
      breakdown={breakdown?.byParticipant}
    />
  );
}

/** The War Week's Team standings as a results table. */
function TeamStandingsTable({
  rows,
  teamLabel,
  breakdown,
}: {
  rows: TeamStanding[];
  teamLabel: string;
  breakdown?: Map<string, PointsBreakdownRow[]>;
}) {
  if (rows.length === 0) return <NoPointsYet />;
  return (
    <ResultsTable
      label={`${teamLabel} standings`}
      entrantHeader={teamLabel}
      rows={rows.map((row) => {
        const rowBreakdown = breakdown?.get(row.id);
        return {
          key: row.id,
          rank: row.rank,
          name: row.name,
          lead: (
            <span
              aria-hidden
              className="mt-1 size-3 shrink-0 rounded-full"
              style={{ backgroundColor: row.color }}
            />
          ),
          points: row.total,
          expansion: rowBreakdown
            ? {
                label: `Show points breakdown for ${row.name}`,
                content: <PointsBreakdownList rows={rowBreakdown} />,
              }
            : undefined,
        };
      })}
    />
  );
}

/** The War Week's individual leaderboard as a results table. */
function IndividualStandingsTable({
  rows,
  label,
  primaryColor,
  breakdown,
}: {
  rows: IndividualStanding[];
  label: string;
  primaryColor: string;
  breakdown?: Map<string, PointsBreakdownRow[]>;
}) {
  if (rows.length === 0) return <NoPointsYet />;
  return (
    <ResultsTable
      label={label}
      entrantHeader="Participant"
      rows={rows.map((row) => {
        const rowBreakdown = breakdown?.get(row.id);
        return {
          key: row.id,
          rank: row.rank,
          name: row.name,
          lead: (
            <Avatar
              name={row.name}
              teamColor={row.team?.color ?? null}
              primaryColor={primaryColor}
              image={row.image}
              className="size-6"
            />
          ),
          after: <YouTag participantId={row.id} />,
          // The Team by name and color dot: colored text wouldn't read on
          // every row's background.
          detail: row.team ? (
            <span className="inline-flex items-center gap-1">
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: row.team.color }}
              />
              {row.team.name}
            </span>
          ) : null,
          points: row.total,
          className: YOU_ROW_CLASS,
          expansion: rowBreakdown
            ? {
                label: `Show points breakdown for ${row.name}`,
                content: <PointsBreakdownList rows={rowBreakdown} />,
              }
            : undefined,
        };
      })}
    />
  );
}

/**
 * Both leaderboards, the main one first, each as the results table (spec
 * R20, decision 1): Rank, name and War Week points, no Score column and no
 * Provisional badge; each row opens its points breakdown.
 */
export function LeaderboardStandings({
  standings,
  teamLabel,
  primaryColor,
  breakdown,
}: {
  standings: Standings;
  teamLabel: string;
  /** The Appearance Theme primary color, for Avatars with no Team. */
  primaryColor: string;
  breakdown?: PointsBreakdown;
}) {
  const teamTitle = `${teamLabel} standings`;
  // A free-for-all War Week's main list is titled "Standings"; in `teams`
  // mode this is the secondary, individual list.
  const individualTitle =
    standings.main === "individual" ? "Standings" : "Individual leaderboard";
  const teamSection = (
    <StandingsSection key="team" title={teamTitle}>
      <TeamStandingsTable
        rows={standings.team}
        teamLabel={teamLabel}
        breakdown={breakdown?.byTeam}
      />
    </StandingsSection>
  );
  const individualSection = (
    <StandingsSection key="individual" title={individualTitle}>
      <IndividualStandingsTable
        rows={standings.individual}
        label={individualTitle}
        primaryColor={primaryColor}
        breakdown={breakdown?.byParticipant}
      />
    </StandingsSection>
  );
  // A free-for-all War Week has no Teams, so it shows no team section.
  const sections =
    standings.main === "team"
      ? [teamSection, individualSection]
      : [individualSection];

  return <div className="flex flex-col gap-6">{sections}</div>;
}

function StandingsSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}
