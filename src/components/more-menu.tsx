"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { SignOutButton } from "@/components/auth-buttons";
import { DisplayMenu } from "@/components/display-menu";
import { MoreLinkIcon } from "@/components/more-link-icon";
import type { NavAccount } from "@/components/primary-nav";
import { type MoreLinksInput, moreLinks } from "@/lib/more-links";

/** A More Sheet's bordered list of links (`MoreMenuLink` rows). */
export const MORE_MENU_LIST = "border-border flex flex-col rounded-lg border";
const MORE_MENU_LINK = "flex min-h-11 items-center gap-3 px-4 py-3";
/** A More Sheet's bordered row that isn't a link (Display, the account). */
export const MORE_MENU_ROW =
  "border-border flex items-center gap-3 rounded-lg border px-4 py-3 text-sm";

/**
 * One link row in a More Sheet's list. `current` highlights it and marks it
 * `aria-current="page"`; tapping it calls `onNavigate`.
 */
export function MoreMenuLink({
  href,
  label,
  icon,
  current = false,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  current?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <li className="border-border border-b last:border-b-0">
      <Link
        href={href}
        onClick={onNavigate}
        aria-current={current ? "page" : undefined}
        className={
          current
            ? `${MORE_MENU_LINK} bg-primary/10 text-primary`
            : MORE_MENU_LINK
        }
      >
        {icon}
        <span className="flex-1 font-medium">{label}</span>
        <ChevronRight aria-hidden className="text-foreground/40 size-4" />
      </Link>
    </li>
  );
}

/** The More Sheet's Display row. */
export function MoreMenuDisplayRow() {
  return (
    <div className={`${MORE_MENU_ROW} flex-wrap gap-y-2`}>
      <span className="flex-1 font-medium">Display</span>
      <DisplayMenu />
    </div>
  );
}

/** The More Sheet's "Signed in as …" row with Sign out. */
export function MoreMenuAccountRow({ email }: { email: string }) {
  return (
    <div className={MORE_MENU_ROW}>
      <span className="text-foreground/70 min-w-0 flex-1 truncate">
        Signed in as {email}
      </span>
      <SignOutButton />
    </div>
  );
}

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
    surface: "phone",
    edition,
    mode,
    teamLabel,
    canOpenAdmin: account.canOpenAdmin,
  });

  return (
    <div className="flex flex-col gap-4 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <ul className={MORE_MENU_LIST}>
        {links.map(({ label, href, icon }) => (
          <MoreMenuLink
            key={href}
            href={href}
            label={label}
            icon={<MoreLinkIcon icon={icon} />}
            onNavigate={onNavigate}
          />
        ))}
      </ul>
      <MoreMenuDisplayRow />
      <MoreMenuAccountRow email={account.email} />
    </div>
  );
}
