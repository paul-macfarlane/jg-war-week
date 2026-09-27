import type { Metadata } from "next";

import { AdminRefused, AdminShell } from "@/components/admin-shell";
import { OrganizersEditor } from "@/components/organizers-editor";
import { getOrganizers } from "@/queries/organizers";

import { loadAdminPage } from "../gate";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Organizers · JG War Week" };

/** The global Organizer list. Organizers only. */
export default async function AdminOrganizersPage() {
  const { warWeek, email, allowed, isOrganizer, editions } =
    await loadAdminPage("/admin/organizers", "organizers");
  if (!allowed) return <AdminRefused warWeek={warWeek} email={email} />;

  const organizers = await getOrganizers();

  return (
    <AdminShell
      warWeek={warWeek}
      email={email}
      isOrganizer={isOrganizer}
      editions={editions}
      current="Organizers"
    >
      <section className="flex max-w-3xl flex-col gap-4">
        <h1 className="text-2xl font-bold">Organizers</h1>
        <p className="text-foreground/70 text-sm">
          Organizers run every War Week. Hosts are assigned per Competition, on
          its setup in Setup → Competitions.
        </p>
        <OrganizersEditor organizers={organizers} actorEmail={email} />
      </section>
    </AdminShell>
  );
}
