import type { Metadata } from "next";

import { AdminRefused, AdminShell } from "@/components/admin-shell";
import { FaqEditor } from "@/components/faq-editor";
import { sanitizeContent } from "@/lib/rich-text/content";
import { getFaqItems } from "@/queries/faq";

import { loadAdminPage } from "../gate";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "FAQ · JG War Week" };

export default async function AdminFaqPage() {
  const { warWeek, email, allowed, isOrganizer, editions } =
    await loadAdminPage("/admin/faq", "organizers");
  if (!allowed) return <AdminRefused warWeek={warWeek} email={email} />;

  const items = (await getFaqItems(warWeek)).map((item) => {
    // Sanitized on write; again here so the editor only gets the closed set.
    const answer = sanitizeContent(item.answer);
    return {
      id: item.id,
      question: item.question,
      answer: answer.ok
        ? answer.content
        : { type: "doc" as const, content: [] },
    };
  });

  return (
    <AdminShell
      warWeek={warWeek}
      email={email}
      isOrganizer={isOrganizer}
      editions={editions}
      current="FAQ"
    >
      <section className="flex max-w-3xl flex-col gap-4">
        <h1 className="text-2xl font-bold">FAQ</h1>
        <p className="text-foreground/70 text-sm">
          FAQ Items show on the public FAQ in this order.
        </p>
        <FaqEditor warWeekId={warWeek.id} items={items} />
      </section>
    </AdminShell>
  );
}
