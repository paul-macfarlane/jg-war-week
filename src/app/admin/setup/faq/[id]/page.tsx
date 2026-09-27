import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminRefused, AdminShell } from "@/components/admin-shell";
import { FaqItemForm } from "@/components/faq-item-form";
import { sanitizeContent } from "@/lib/rich-text/content";
import { getFaqItemForEdit } from "@/queries/setup-schedule-faq";

import { loadAdminPage } from "../../../gate";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Edit FAQ Item · JG War Week" };

export default async function EditFaqItemPage({
  params,
}: PageProps<"/admin/setup/faq/[id]">) {
  const { id } = await params;
  const { warWeek, email, allowed, isOrganizer, editions } =
    await loadAdminPage(`/admin/setup/faq/${id}`, "organizers");
  if (!allowed) return <AdminRefused warWeek={warWeek} email={email} />;

  const item = await getFaqItemForEdit(warWeek, id);
  if (!item) notFound();

  // Sanitized on write; again here so the editor only gets the closed set.
  const answer = sanitizeContent(item.answer);

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
          href="/admin/setup/faq"
          className="text-primary text-sm underline-offset-4 hover:underline"
        >
          ← FAQ
        </Link>
        <h1 className="text-2xl font-bold">Edit FAQ Item</h1>
        <FaqItemForm
          warWeekId={warWeek.id}
          itemId={item.id}
          initial={{
            question: item.question,
            answer: answer.ok ? answer.content : { type: "doc", content: [] },
          }}
        />
      </section>
    </AdminShell>
  );
}
