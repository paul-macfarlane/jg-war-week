import type { Metadata } from "next";
import Link from "next/link";

import { AdminRefused, AdminShell } from "@/components/admin-shell";
import { DeleteAwardButton } from "@/components/delete-award-button";
import { buttonVariants } from "@/components/ui/button";
import { getAwards } from "@/queries/awards";

import { loadAdminPage } from "../gate";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Awards · JG War Week" };

export default async function AdminAwardsPage() {
  const { warWeek, email, allowed, isOrganizer, editions } =
    await loadAdminPage("/admin/awards", "organizers");
  if (!allowed) return <AdminRefused warWeek={warWeek} email={email} />;

  const awards = await getAwards(warWeek);

  return (
    <AdminShell
      warWeek={warWeek}
      email={email}
      isOrganizer={isOrganizer}
      editions={editions}
      current="Awards"
    >
      <section className="flex max-w-5xl flex-col gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">Awards</h1>
          <Link
            href="/admin/awards/new"
            className={buttonVariants({ className: "ml-auto" })}
          >
            New Award
          </Link>
        </div>

        {awards.length === 0 ? (
          <p className="text-foreground/70 text-sm">No Awards yet.</p>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-foreground/60 border-border border-b">
                <tr>
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">{warWeek.teamLabel}</th>
                  <th className="py-2 pr-4 font-medium">Participants</th>
                  <th className="py-2 font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {awards.map((row) => (
                  <tr key={row.id} className="border-border border-b">
                    <td className="py-2 pr-4 font-medium">{row.name}</td>
                    <td className="py-2 pr-4">{row.team?.name ?? "—"}</td>
                    <td className="py-2 pr-4">
                      {row.participants.map((p) => p.displayName).join(", ") ||
                        "—"}
                    </td>
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/awards/${row.id}`}
                          className="text-primary text-xs underline-offset-4 hover:underline"
                        >
                          Edit
                        </Link>
                        <DeleteAwardButton id={row.id} name={row.name} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AdminShell>
  );
}
