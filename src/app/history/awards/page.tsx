import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { getAwardNamesWithHistory } from "@/queries/award-history";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Awards through the years · JG War Week",
};

/** Every Award name, each linking to that name through the years. */
export default async function AwardNamesPage() {
  const awardNames = await getAwardNamesWithHistory();

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-6 md:max-w-3xl md:py-10">
      <Link
        href="/history"
        className="text-foreground/70 flex items-center gap-1 text-sm font-medium"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Back to history
      </Link>
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold">Awards through the years</h1>
        <p className="text-foreground/70">
          Each Award name with every War Week&apos;s recipients.
        </p>
      </div>
      {awardNames.length === 0 ? (
        <p className="text-foreground/70 text-sm">No Awards yet.</p>
      ) : (
        <ul aria-label="Award names" className="flex flex-wrap gap-2">
          {awardNames.map((awardName) => (
            <li key={awardName.slug}>
              <Link
                href={`/history/awards/${awardName.slug}`}
                className="border-border hover:bg-muted inline-flex min-h-11 items-center rounded-md border px-3 text-sm font-medium sm:min-h-9"
              >
                {awardName.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
