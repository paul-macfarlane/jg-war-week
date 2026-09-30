"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { SignOutButton } from "@/components/auth-buttons";
import { DisplayMenu } from "@/components/display-menu";
import { MoreLinkIcon } from "@/components/more-link-icon";
import type { NavAccount } from "@/components/primary-nav";
import { type MoreLinksInput, moreLinks } from "@/lib/more-links";

/**
 * The More Sheet's content on a phone: the same links as `/[edition]/more`,
 * plus the signed-in account row. Tapping a link calls `onNavigate` so the
 * caller can close the Sheet.
 */
export function MoreMenu({
  edition,
  mode,
  teamLabel,
  account,
  onNavigate,
}: {
  edition: string;
  mode: MoreLinksInput["mode"];
  teamLabel: string;
  account: NavAccount;
  onNavigate?: () => void;
}) {
  const links = moreLinks({
    edition,
    mode,
    teamLabel,
    canOpenAdmin: account.canOpenAdmin,
  });

  return (
    <div className="flex flex-col gap-4 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <ul className="border-border flex flex-col rounded-lg border">
        {links.map(({ label, href, icon }) => (
          <li key={href} className="border-border border-b last:border-b-0">
            <Link
              href={href}
              onClick={onNavigate}
              className="flex min-h-11 items-center gap-3 px-4 py-3"
            >
              <MoreLinkIcon icon={icon} />
              <span className="flex-1 font-medium">{label}</span>
              <ChevronRight aria-hidden className="text-foreground/40 size-4" />
            </Link>
          </li>
        ))}
      </ul>
      <div className="border-border flex flex-wrap items-center gap-3 gap-y-2 rounded-lg border px-4 py-3 text-sm">
        <span className="flex-1 font-medium">Display</span>
        <DisplayMenu />
      </div>
      <div className="border-border flex items-center gap-3 rounded-lg border px-4 py-3 text-sm">
        <span className="text-foreground/70 min-w-0 flex-1 truncate">
          Signed in as {account.email}
        </span>
        <SignOutButton />
      </div>
    </div>
  );
}
