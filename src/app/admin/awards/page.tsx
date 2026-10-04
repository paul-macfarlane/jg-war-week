import type { Metadata } from "next";

import { AdminRefused, AdminShell } from "@/components/admin-shell";
import { AwardsEditor } from "@/components/awards-editor";
import { getAwardFormOptions, getAwards } from "@/queries/awards";

import { loadAdminPage } from "../gate";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Awards · JG War Week" };

export default async function AdminAwardsPage() {
  const { warWeek, email, allowed, isOrganizer, editions } =
    await loadAdminPage("/admin/awards", "organizers");
  if (!allowed) return <AdminRefused warWeek={warWeek} email={email} />;

  const [awards, options] = await Promise.all([
    getAwards(warWeek),
    getAwardFormOptions(warWeek),
  ]);
  // A free-for-all War Week with no Team on any Award has nothing to show.
  const showTeam =
    warWeek.mode !== "free-for-all" || awards.some((a) => a.team !== null);

  return (
    <AdminShell
      warWeek={warWeek}
      email={email}
      isOrganizer={isOrganizer}
      editions={editions}
      current="Awards"
    >
      <section className="flex max-w-3xl flex-col gap-4">
        <h1 className="text-2xl font-bold">Awards</h1>
        <AwardsEditor
          warWeekId={warWeek.id}
          awards={awards}
          options={options}
          teamLabel={warWeek.teamLabel}
          mode={warWeek.mode}
          showTeam={showTeam}
        />
      </section>
    </AdminShell>
  );
}
