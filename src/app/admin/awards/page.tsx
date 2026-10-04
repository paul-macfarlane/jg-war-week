import type { Metadata } from "next";

import { AdminRefused, AdminShell } from "@/components/admin-shell";
import { AwardCategoriesEditor } from "@/components/award-categories-editor";
import { AwardsEditor } from "@/components/awards-editor";
import { getAwardCategories } from "@/queries/award-categories";
import { getAwardFormOptions, getAwards } from "@/queries/awards";
import { getParticipantEmails } from "@/queries/target-options";

import { loadAdminPage } from "../gate";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Awards · JG War Week" };

export default async function AdminAwardsPage() {
  const { warWeek, email, allowed, isOrganizer, editions } =
    await loadAdminPage("/admin/awards", "organizers");
  if (!allowed) return <AdminRefused warWeek={warWeek} email={email} />;

  const [awards, formOptions, categories, emails] = await Promise.all([
    getAwards(warWeek),
    getAwardFormOptions(warWeek),
    getAwardCategories(),
    getParticipantEmails(warWeek),
  ]);
  const options = {
    ...formOptions,
    participants: formOptions.participants.map((p) => ({
      ...p,
      email: emails.get(p.id),
    })),
  };
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
      <section
        aria-labelledby="award-categories-heading"
        className="mt-8 flex max-w-3xl flex-col gap-3"
      >
        <h2 id="award-categories-heading" className="text-xl font-bold">
          Categories
        </h2>
        <p className="text-foreground/70 text-sm">
          Categories group Awards across War Weeks (War Week MVP, Grow…). They
          are the same in every War Week.
        </p>
        <AwardCategoriesEditor categories={categories} />
      </section>
    </AdminShell>
  );
}
