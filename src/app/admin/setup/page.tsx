import type { Metadata } from "next";
import Link from "next/link";

import { AdminRefused, AdminShell } from "@/components/admin-shell";
import { SeedOverwriteWarning } from "@/components/seed-overwrite-warning";
import { Badge } from "@/components/ui/badge";
import { WarWeekLifecycleControls } from "@/components/war-week-lifecycle-controls";
import { STATUS_LABELS, defaultWinner } from "@/lib/war-week-lifecycle";
import { getStandings } from "@/queries/standings";

import { loadAdminPage } from "../gate";
import { SETUP_SECTIONS } from "./sections";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Setup · JG War Week" };

const STATUS_HELP = {
  upcoming: "Set it up in advance. Start it when the current War Week ends.",
  live: "This is the current War Week. End it to move it to the Archive with its Winner.",
  complete:
    "In the Archive. You can still correct its results, or reopen it for the live view.",
} as const;

export default async function AdminSetupPage() {
  const { warWeek, email, allowed, isOrganizer, editions } =
    await loadAdminPage("/admin/setup");
  if (!allowed) return <AdminRefused warWeek={warWeek} email={email} />;

  const suggestedWinner = !isOrganizer
    ? ""
    : warWeek.status === "live"
      ? defaultWinner(await getStandings(warWeek))
      : (warWeek.winner ?? "");

  return (
    <AdminShell
      warWeek={warWeek}
      email={email}
      isOrganizer={isOrganizer}
      editions={editions}
      current="Setup"
    >
      <section className="flex max-w-3xl flex-col gap-4">
        <h1 className="text-2xl font-bold">Setup</h1>
        <p className="text-foreground/70">
          Set up War Week {warWeek.edition.toUpperCase()} here instead of in its
          seed file.
        </p>
        {isOrganizer && (
          <section
            aria-labelledby="lifecycle-heading"
            className="border-border flex flex-col gap-3 rounded-lg border p-4"
          >
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="lifecycle-heading" className="font-semibold">
                Lifecycle
              </h2>
              <Badge variant="secondary">{STATUS_LABELS[warWeek.status]}</Badge>
            </div>
            <p className="text-foreground/70 text-sm">
              {STATUS_HELP[warWeek.status]}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <WarWeekLifecycleControls
                warWeekId={warWeek.id}
                edition={warWeek.edition}
                status={warWeek.status}
                suggestedWinner={suggestedWinner}
                highlights={warWeek.highlights}
              />
              <Link
                href="/admin/setup/next"
                className="text-primary text-sm underline-offset-4 hover:underline"
              >
                Create next War Week
              </Link>
            </div>
          </section>
        )}
        <SeedOverwriteWarning />
        <ul className="grid gap-3 sm:grid-cols-2">
          {SETUP_SECTIONS.filter(
            (section) => isOrganizer || !section.organizerOnly,
          ).map(({ label, description, href }) => (
            <li key={label}>
              {href ? (
                <Link
                  href={href}
                  className="border-border hover:bg-muted flex h-full flex-col gap-1 rounded-lg border p-4"
                >
                  <span className="text-primary font-semibold">{label}</span>
                  <span className="text-foreground/70 text-sm">
                    {description}
                  </span>
                </Link>
              ) : (
                <div className="border-border text-foreground/50 flex h-full flex-col gap-1 rounded-lg border border-dashed p-4">
                  <span className="font-semibold">
                    {label} <span className="text-xs font-normal">Soon</span>
                  </span>
                  <span className="text-sm">{description}</span>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </AdminShell>
  );
}
