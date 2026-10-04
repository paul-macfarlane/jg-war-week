import { ChevronDown } from "lucide-react";
import { notFound } from "next/navigation";

import { RichText } from "@/components/rich-text";
import { getFaqItems } from "@/queries/faq";

import { getWarWeekForEdition } from "../war-week";

export default async function FaqPage({ params }: PageProps<"/[edition]/faq">) {
  const { edition } = await params;
  const warWeek = await getWarWeekForEdition(edition);
  if (!warWeek) notFound();

  const items = await getFaqItems(warWeek);

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-6 md:max-w-3xl">
      <h1 className="text-2xl font-bold">FAQ</h1>
      {items.length === 0 ? (
        <p className="text-foreground/70 text-sm">No FAQ yet.</p>
      ) : (
        <ul className="border-border flex flex-col rounded-lg border">
          {items.map((item) => (
            <li
              key={item.id}
              className="border-border border-b last:border-b-0"
            >
              <details className="group">
                <summary className="flex list-none items-center gap-3 px-4 py-3 font-medium [&::-webkit-details-marker]:hidden">
                  <h2 className="flex-1 text-base">{item.question}</h2>
                  <ChevronDown
                    aria-hidden
                    className="text-foreground/50 size-4 shrink-0 transition-transform group-open:rotate-180"
                  />
                </summary>
                <div className="text-foreground/80 px-4 pb-4 text-sm">
                  {/* One below the question's `h2`. */}
                  <RichText content={item.answer} headingFloor={3} />
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
