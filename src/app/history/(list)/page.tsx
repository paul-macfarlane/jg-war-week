import type { Metadata } from "next";
import Link from "next/link";

import { ArchiveCard } from "@/components/archive";
import { listArchive } from "@/queries/archive";
import { getCategoriesWithAwards } from "@/queries/award-category-history";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "History · JG War Week" };

/** The Archive: every past War Week, newest first, each in its own theme. */
export default async function HistoryPage() {
  const [warWeeks, categories] = await Promise.all([
    listArchive(),
    getCategoriesWithAwards(),
  ]);

  return (
    <>
      <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-6 md:max-w-5xl md:py-10">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold">War Week history</h1>
          <p className="text-foreground/70">
            Every past War Week, newest first.
          </p>
        </div>
        {warWeeks.length === 0 ? (
          <p className="text-foreground/70 text-sm">No past War Weeks yet.</p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {warWeeks.map((warWeek) => (
              <ArchiveCard key={warWeek.id} warWeek={warWeek} />
            ))}
          </ul>
        )}
        {categories.length > 0 ? (
          <section
            aria-labelledby="awards-through-the-years"
            className="flex flex-col gap-2"
          >
            <h2 id="awards-through-the-years" className="text-2xl font-bold">
              Awards through the years
            </h2>
            <p className="text-foreground/70 text-sm">
              Each Award Category with every War Week&apos;s recipients.
            </p>
            <ul className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <li key={category.id}>
                  <Link
                    href={`/history/awards/${category.id}`}
                    className="border-border hover:bg-muted inline-flex min-h-11 items-center rounded-md border px-3 text-sm font-medium sm:min-h-9"
                  >
                    {category.name}
                    {category.archived ? (
                      <span className="text-foreground/60 ml-1 font-normal">
                        (archived)
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>
    </>
  );
}
