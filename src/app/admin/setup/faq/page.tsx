import type { Metadata } from "next";
import Link from "next/link";

import { AdminRefused, AdminShell } from "@/components/admin-shell";
import { SeedOverwriteWarning } from "@/components/seed-overwrite-warning";
import {
  DeleteSetupItemButton,
  MoveFaqItemButtons,
} from "@/components/setup-schedule-faq-buttons";
import { buttonVariants } from "@/components/ui/button";
import { getFaqItems } from "@/queries/faq";

import { loadAdminPage } from "../../gate";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "FAQ · JG War Week" };

export default async function SetupFaqPage() {
  const { warWeek, email, allowed, isOrganizer, editions } =
    await loadAdminPage("/admin/setup/faq", "organizers");
  if (!allowed) return <AdminRefused warWeek={warWeek} email={email} />;

  const items = await getFaqItems(warWeek);

  return (
    <AdminShell
      warWeek={warWeek}
      email={email}
      isOrganizer={isOrganizer}
      editions={editions}
      current="Setup"
    >
      <section className="flex max-w-3xl flex-col gap-4">
        <Link
          href="/admin/setup"
          className="text-primary text-sm underline-offset-4 hover:underline"
        >
          ← Setup
        </Link>
        <div className="flex flex-wrap items-center gap-4">
          <h1 className="text-2xl font-bold">FAQ</h1>
          <Link
            href="/admin/setup/faq/new"
            className={buttonVariants({ className: "ml-auto" })}
          >
            New FAQ Item
          </Link>
        </div>
        <p className="text-foreground/70 text-sm">
          FAQ Items show on the public FAQ in this order.
        </p>
        <SeedOverwriteWarning />

        {items.length === 0 ? (
          <p className="text-foreground/70 text-sm">No FAQ Items yet.</p>
        ) : (
          <ol
            aria-label="FAQ Items"
            className="border-border divide-border divide-y rounded-lg border"
          >
            {items.map((item, index) => (
              <li
                key={item.id}
                className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center"
              >
                <span className="min-w-0 flex-1 font-medium">
                  {item.question}
                </span>
                <div className="flex items-center gap-2">
                  <MoveFaqItemButtons
                    id={item.id}
                    question={item.question}
                    first={index === 0}
                    last={index === items.length - 1}
                  />
                  <Link
                    href={`/admin/setup/faq/${item.id}`}
                    className="text-primary text-xs underline-offset-4 hover:underline"
                  >
                    Edit
                  </Link>
                  <DeleteSetupItemButton
                    id={item.id}
                    name={item.question}
                    kind="faq-item"
                  />
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </AdminShell>
  );
}
