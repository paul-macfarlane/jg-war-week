import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SignOutButton } from "@/components/auth-buttons";
import { moreLinks } from "@/lib/more-links";

import { getNavAccount, getWarWeekForEdition } from "../war-week";

export default async function MorePage({
  params,
}: PageProps<"/[edition]/more">) {
  const { edition } = await params;
  const warWeek = await getWarWeekForEdition(edition);
  if (!warWeek) notFound();
  const account = await getNavAccount();

  const links = moreLinks({
    edition: warWeek.edition,
    mode: warWeek.mode,
    teamLabel: warWeek.teamLabel,
    canOpenAdmin: account.canOpenAdmin,
  });

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-6 md:max-w-3xl">
      <h1 className="text-2xl font-bold">More</h1>
      <ul className="border-border flex flex-col rounded-lg border">
        {links.map(({ label, href, icon: Icon }) => (
          <li key={href} className="border-border border-b last:border-b-0">
            <Link href={href} className="flex items-center gap-3 px-4 py-3">
              <Icon aria-hidden className="text-primary size-5" />
              <span className="flex-1 font-medium">{label}</span>
              <ChevronRight aria-hidden className="text-foreground/40 size-4" />
            </Link>
          </li>
        ))}
      </ul>
      <div className="border-border flex items-center gap-3 rounded-lg border px-4 py-3 text-sm">
        <span className="text-foreground/70 min-w-0 flex-1 truncate">
          Signed in as {account.email}
        </span>
        <SignOutButton />
      </div>
    </main>
  );
}
