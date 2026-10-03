"use client";

import { Home, ListChecks, Medal, Menu, Newspaper, Trophy } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { AccountMenu } from "@/components/account-menu";
import { MoreMenu } from "@/components/more-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { WarWeek } from "@/db/schema";
import { type NavKey, destinationsFor, isActive } from "@/lib/primary-nav";

/** The signed-in user, as shown in the navigation. */
export type NavAccount = {
  email: string;
  /**
   * The Profile name, else the roster name when linked to a Participant,
   * else the email's local part.
   */
  name: string;
  /** The Profile picture URL, else the Google photo; null for initials. */
  image?: string | null;
  canOpenAdmin: boolean;
};

const ICONS: Record<NavKey, typeof Home> = {
  home: Home,
  schedule: ListChecks,
  competitions: Trophy,
  leaderboard: Medal,
  announcements: Newspaper,
  more: Menu,
};

const TAB_CLASS = "flex flex-col items-center gap-1 py-2 text-xs";

/**
 * Mobile and tablet (below `lg`): a fixed bottom tab bar for one-thumb use.
 * The More tab opens a Sheet instead of navigating to `/[edition]/more`.
 */
export function BottomTabBar({
  edition,
  mode,
  teamLabel,
}: {
  edition: string;
  mode: WarWeek["mode"];
  teamLabel: string;
}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  // Close the More Sheet on route change (e.g. a link inside it navigated).
  // Adjusting state during render, rather than in an effect, avoids an
  // extra render pass: https://react.dev/learn/you-might-not-need-an-effect
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setMoreOpen(false);
  }

  return (
    <nav
      aria-label="Primary"
      className="border-border bg-background fixed inset-x-0 bottom-0 z-50 border-t pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="flex items-stretch justify-around">
        {destinationsFor(edition, "phone").map((destination) => {
          const { key, label, href } = destination;
          const Icon = ICONS[key];
          const active = isActive(pathname, destination, edition);
          const tabClassName = `${TAB_CLASS} ${
            active ? "text-primary-text" : "text-muted-foreground"
          }`;

          if (key === "more") {
            return (
              <li key={href} className="flex-1">
                <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
                  <SheetTrigger
                    aria-current={active ? "page" : undefined}
                    className={`w-full ${tabClassName}`}
                  >
                    <Icon className="size-5" aria-hidden="true" />
                    {label}
                  </SheetTrigger>
                  <SheetContent
                    side="bottom"
                    className="max-h-[85dvh] w-full overflow-y-auto"
                  >
                    <SheetHeader>
                      <SheetTitle>More</SheetTitle>
                    </SheetHeader>
                    <MoreMenu
                      edition={edition}
                      mode={mode}
                      teamLabel={teamLabel}
                      onNavigate={() => setMoreOpen(false)}
                    />
                  </SheetContent>
                </Sheet>
              </li>
            );
          }

          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={tabClassName}
              >
                <Icon className="size-5" aria-hidden="true" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * A sticky top header at every width: the War Week name, the account menu
 * and, from `lg`, the same destinations as the bottom tab bar.
 */
export function TopNav({
  edition,
  storyTheme,
  primaryColor,
  slackUrl,
  account,
}: {
  edition: string;
  storyTheme: string;
  primaryColor: string;
  slackUrl: string;
  account: NavAccount;
}) {
  const pathname = usePathname();

  return (
    <header className="border-border bg-background sticky top-0 z-50 border-b">
      <div className="mx-auto grid max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-6 px-4 py-2 lg:px-6 lg:py-3">
        <Link
          href={`/${edition}`}
          className="flex min-w-0 items-baseline gap-2"
        >
          <span className="text-lg font-bold whitespace-nowrap">
            War Week {edition.toUpperCase()}
          </span>
          <span className="text-primary-text hidden min-w-0 truncate text-sm sm:inline">
            {storyTheme}
          </span>
        </Link>
        <nav aria-label="Primary" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {destinationsFor(edition, "desktop").map((destination) => {
              const { label, href } = destination;
              const active = isActive(pathname, destination, edition);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="col-start-3 justify-self-end">
          <AccountMenu
            name={account.name}
            image={account.image}
            email={account.email}
            edition={edition}
            primaryColor={primaryColor}
            canOpenAdmin={account.canOpenAdmin}
            slackUrl={slackUrl}
          />
        </div>
      </div>
    </header>
  );
}
