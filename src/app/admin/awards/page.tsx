import type { Metadata } from "next";
import Link from "next/link";

import { adminEditLinkClass } from "@/components/admin-edit-link";
import { AdminRefused, AdminShell } from "@/components/admin-shell";
import { DeleteAwardButton } from "@/components/delete-award-button";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getAwards } from "@/queries/awards";

import { loadAdminPage } from "../gate";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Awards · JG War Week" };

export default async function AdminAwardsPage() {
  const { warWeek, email, allowed, isOrganizer, editions } =
    await loadAdminPage("/admin/awards", "organizers");
  if (!allowed) return <AdminRefused warWeek={warWeek} email={email} />;

  const awards = await getAwards(warWeek);
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
          <>
            <ul className="flex flex-col gap-3 md:hidden">
              {awards.map((row) => (
                <li key={row.id}>
                  <Card size="sm" className="gap-2 px-4 py-3">
                    <p className="font-medium break-words">{row.name}</p>
                    {showTeam && (
                      <p className="text-foreground/70 text-xs">
                        {warWeek.teamLabel}: {row.team?.name ?? "—"}
                      </p>
                    )}
                    <p className="text-foreground/70 text-xs break-words">
                      Participants:{" "}
                      {row.participants.map((p) => p.displayName).join(", ") ||
                        "—"}
                    </p>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/admin/awards/${row.id}`}
                        className={adminEditLinkClass}
                      >
                        Edit
                      </Link>
                      <DeleteAwardButton id={row.id} name={row.name} />
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
            <div className="relative hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="text-foreground/60 border-border border-b">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Name</th>
                    {showTeam && (
                      <th className="py-2 pr-4 font-medium">
                        {warWeek.teamLabel}
                      </th>
                    )}
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
                      {showTeam && (
                        <td className="py-2 pr-4">{row.team?.name ?? "—"}</td>
                      )}
                      <td className="py-2 pr-4">
                        {row.participants
                          .map((p) => p.displayName)
                          .join(", ") || "—"}
                      </td>
                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/admin/awards/${row.id}`}
                            className={adminEditLinkClass}
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
          </>
        )}
      </section>
    </AdminShell>
  );
}
