"use client";

import { Home, ListChecks, Menu, Newspaper, Trophy } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { SignOutButton } from "@/components/auth-buttons";
import { MoreMenu } from "@/components/more-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { WarWeek } from "@/db/schema";

/** The signed-in user, as shown in the navigation. */
export type NavAccount = { email: string; canOpenAdmin: boolean };

type Destination = {
  label: string;
  href: string;
  icon: typeof Home;
  // Pages reached from this destination that keep it highlighted.
  subpaths?: string[];
};

function destinationsFor(edition: string): Destination[] {
  return [
    { label: "Home", href: `/${edition}`, icon: Home },
    { label: "Schedule", href: `/${edition}/schedule`, icon: ListChecks },
    { label: "Leaderboard", href: `/${edition}/leaderboard`, icon: Trophy },
    { label: "News", href: `/${edition}/news`, icon: Newspaper },
    {
      label: "More",
      href: `/${edition}/more`,
      icon: Menu,
      subpaths: [
        `/${edition}/competitions`,
        `/${edition}/teams`,
        `/${edition}/awards`,
        `/${edition}/faq`,
      ],
    },
  ];
}

function isActive(pathname: string, destination: Destination, edition: string) {
  const { href } = destination;
  if (href === `/${edition}`) return pathname === href;
  return [href, ...(destination.subpaths ?? [])].some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

const TAB_CLASS = "flex flex-col items-center gap-1 py-2 text-xs";

/**
 * Mobile and tablet (below `lg`): a fixed bottom tab bar for one-thumb use.
 * The More tab opens a Sheet instead of navigating to `/[edition]/more`.
 */
export function BottomTabBar({
  edition,
  mode,
  teamLabel,
  account,
}: {
  edition: string;
  mode: WarWeek["mode"];
  teamLabel: string;
  account: NavAccount;
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
        {destinationsFor(edition).map((destination) => {
          const { label, href, icon: Icon } = destination;
          const active = isActive(pathname, destination, edition);
          const tabClassName = `${TAB_CLASS} ${
            active ? "text-primary-text" : "text-muted-foreground"
          }`;

          if (label === "More") {
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
                      account={account}
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
 * Desktop (`lg` and wider): a sticky top header with the War Week name and
 * the same destinations as the bottom tab bar.
 */
export function TopNav({
  edition,
  storyTheme,
  account,
}: {
  edition: string;
  storyTheme: string;
  account: NavAccount;
}) {
  const pathname = usePathname();

  return (
    <header className="border-border bg-background sticky top-0 z-50 hidden border-b lg:block">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-3">
        <Link
          href={`/${edition}`}
          className="flex shrink-0 items-baseline gap-2 whitespace-nowrap"
        >
          <span className="text-lg font-bold">
            War Week {edition.toUpperCase()}
          </span>
          <span className="text-primary-text text-sm">{storyTheme}</span>
        </Link>
        <nav aria-label="Primary">
          <ul className="flex items-center gap-1">
            {destinationsFor(edition).map((destination) => {
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
        <div className="flex min-w-0 items-center gap-3 text-sm whitespace-nowrap">
          {account.canOpenAdmin && (
            <Link
              href="/admin"
              className="text-primary-text underline-offset-4 hover:underline"
            >
              Admin
            </Link>
          )}
          <span
            title={account.email}
            className="text-muted-foreground hidden max-w-56 truncate lg:inline"
          >
            {account.email}
          </span>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
