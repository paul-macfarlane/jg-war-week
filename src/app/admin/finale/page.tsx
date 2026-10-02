import { Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AdminRefused, AdminShell } from "@/components/admin-shell";
import { buttonVariants } from "@/components/ui/button";
import { getBracketCompetitions } from "@/queries/brackets";

import { loadAdminPage } from "../gate";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Finale · JG War Week",
};

/**
 * The Organizer's way into the Finale, and into each finalized Bracket's
 * Bracket Finale ("Finale: <Competition>").
 */
export default async function AdminFinalePage() {
  const { warWeek, email, allowed, isOrganizer, editions } =
    await loadAdminPage("/admin/finale");
  if (!allowed) return <AdminRefused warWeek={warWeek} email={email} />;

  const edition = warWeek.edition;
  const finalized = (await getBracketCompetitions(warWeek)).filter(
    (competition) => competition.finalizedAt !== null,
  );

  return (
    <AdminShell
      warWeek={warWeek}
      email={email}
      isOrganizer={isOrganizer}
      editions={editions}
      current="Finale"
    >
      <div className="flex max-w-2xl flex-col gap-4">
        <h1 className="text-2xl font-bold">Finale</h1>
        <p className="text-foreground/70">
          The Finale is the closing-ceremony screen. Open it on the projector
          and press Start (or Space): the Standings count in from last place to
          first, tied places together, and every total lands at once. Replay
          runs it again. It plays the same Standings as the{" "}
          <Link
            href={`/${edition}/leaderboard`}
            className="text-primary underline underline-offset-4"
          >
            leaderboard
          </Link>{" "}
          and never changes them. Anyone signed in can watch it at{" "}
          <code>/{edition}/finale</code>.
        </p>
        <div>
          <Link
            href={`/${edition}/finale`}
            className={buttonVariants({ size: "lg" })}
          >
            <Sparkles aria-hidden />
            Open Finale
          </Link>
        </div>
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Bracket Finales</h2>
          {finalized.length === 0 ? (
            <p className="text-foreground/70 text-sm">
              Each finalized Bracket gets its own Finale, counting its placings
              in to the champion. None is finalized yet.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {finalized.map((competition) => (
                <li key={competition.id}>
                  <Link
                    href={`/${edition}/finale/${competition.id}`}
                    className={buttonVariants({ variant: "outline" })}
                  >
                    <Sparkles aria-hidden />
                    Finale: {competition.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AdminShell>
  );
}
