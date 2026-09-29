import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import type { GameType } from "@/lib/enums";
import { gameTypeLabel } from "@/lib/games/config";

/**
 * The home page's "Log a Game" card (Q22): the open `games` Competitions
 * the linked Participant may log in right now, each opening its page with
 * the Game form up. Nothing when there are none, so a pick-only You (who
 * can't log) never sees it.
 */
export function LogAGame({
  edition,
  competitions,
}: {
  edition: string;
  competitions: { id: string; name: string; gameType: GameType }[];
}) {
  if (competitions.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Log a Game</h2>
      <Card size="sm" className="py-1">
        <ul className="flex flex-col divide-y px-(--card-spacing)">
          {competitions.map((c) => (
            <li key={c.id}>
              <Link
                href={`/${edition}/competitions/${c.id}?log=1`}
                className="flex min-h-11 items-center gap-3 px-2 py-2"
              >
                <span className="flex flex-1 flex-col">
                  <span className="font-medium">{c.name}</span>
                  <span className="text-foreground/60 text-xs">
                    {gameTypeLabel(c.gameType)}
                  </span>
                </span>
                <ChevronRight aria-hidden className="text-primary size-4" />
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}
