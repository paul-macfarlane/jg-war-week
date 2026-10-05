"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { AdminEditionSwitcher } from "@/components/admin-edition-switcher";
import { AdminSectionIcon } from "@/components/admin-section-icon";
import {
  MORE_MENU_LIST,
  MORE_MENU_ROW,
  MoreMenuLink,
} from "@/components/more-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { AdminEdition } from "@/lib/access";
import { type AdminSection, adminNavFor } from "@/lib/admin-sections";

// Inter whatever the War Week's font preset: a monospace preset's wide
// labels would overflow the five tabs.
const TAB_CLASS =
  "font-[family-name:var(--font-preset-sans)] flex h-full flex-col items-center justify-center gap-1 px-1 text-center text-xs leading-tight";

/**
 * Below `md`: the admin's fixed bottom section bar, for one-thumb use. Four
 * tabs (Competitions, Points, Schedule, News) and a More tab whose Sheet holds the viewer's other sections, the
 * edition switcher. Display, the way back and the account are in the
 * header's account menu.
 * Its height is the admin root's `--admin-bar-height`. Highlights from
 * `current`, the page's own section, not the pathname.
 */
export function AdminBottomBar({
  edition,
  storyTheme,
  isOrganizer,
  current,
  editions,
}: {
  edition: string;
  storyTheme: string;
  isOrganizer: boolean;
  current: AdminSection;
  editions: AdminEdition[];
}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  // Close the More Sheet on route change (e.g. a link inside it navigated),
  // adjusting state during render as `BottomTabBar` does.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setMoreOpen(false);
  }

  const { tabs, more, moreCurrent } = adminNavFor(isOrganizer, current);
  const tabClassName = (active: boolean) =>
    `${TAB_CLASS} ${active ? "text-primary-text" : "text-muted-foreground"}`;
  const close = () => setMoreOpen(false);
  const name = `War Week ${edition.toUpperCase()}`;

  return (
    <nav
      aria-label="Admin sections"
      className="border-border bg-background fixed inset-x-0 bottom-0 z-50 border-t pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="flex h-(--admin-bar-height) items-stretch justify-around">
        {tabs.map(({ label, tabLabel, href, icon, current: active }) => (
          <li key={href} className="flex-1">
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              aria-label={tabLabel === label ? undefined : label}
              className={tabClassName(active)}
            >
              <AdminSectionIcon icon={icon} className="size-5" />
              {tabLabel}
            </Link>
          </li>
        ))}
        <li className="flex-1">
          <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
            <SheetTrigger
              aria-current={moreCurrent ? "page" : undefined}
              className={`w-full ${tabClassName(moreCurrent)}`}
            >
              <Menu className="size-5" aria-hidden="true" />
              More
            </SheetTrigger>
            <SheetContent
              side="bottom"
              className="max-h-[85dvh] w-full overflow-y-auto"
            >
              <SheetHeader>
                <SheetTitle>More</SheetTitle>
                <SheetDescription>{`${name} · ${storyTheme}`}</SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-4 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                <ul className={MORE_MENU_LIST}>
                  {more.map(({ label, href, icon, current: active }) => (
                    <MoreMenuLink
                      key={href}
                      href={href}
                      label={label}
                      current={active}
                      icon={
                        <AdminSectionIcon
                          icon={icon}
                          className="text-primary size-5"
                        />
                      }
                      onNavigate={close}
                    />
                  ))}
                </ul>
                {editions.length > 1 && (
                  <div className={`${MORE_MENU_ROW} flex-wrap gap-y-2`}>
                    <span className="flex-1 font-medium">War Week</span>
                    <AdminEditionSwitcher
                      editions={editions}
                      selected={edition}
                    />
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </li>
      </ul>
    </nav>
  );
}
