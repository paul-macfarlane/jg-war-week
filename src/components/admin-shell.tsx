import {
  BookOpen,
  LayoutDashboard,
  Medal,
  Megaphone,
  PlusCircle,
  Settings,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

import { AdminEditionSwitcher } from "@/components/admin-edition-switcher";
import { SignOutButton } from "@/components/auth-buttons";
import { SiteFooter } from "@/components/site-footer";
import { ThemeRoot } from "@/components/theme-root";
import { Toaster } from "@/components/ui/sonner";
import type { WarWeek } from "@/db/schema";
import { ADMIN_REFUSAL, type AdminEdition } from "@/lib/access";
import { warWeekThemeStyle } from "@/lib/theme";

// `organizerOnly` sections are hidden from Hosts.
const SECTIONS = [
  { label: "Overview", icon: LayoutDashboard, href: "/admin" },
  { label: "Guide", icon: BookOpen, href: "/admin/guide" },
  { label: "Points Entries", icon: PlusCircle, href: "/admin/points" },
  { label: "Finale", icon: Sparkles, href: "/admin/standings" },
  { label: "Announcements", icon: Megaphone, href: "/admin/announcements" },
  {
    label: "Awards",
    icon: Medal,
    href: "/admin/awards",
    organizerOnly: true,
  },
  { label: "Setup", icon: Settings, href: "/admin/setup" },
  {
    label: "Organizers",
    icon: ShieldCheck,
    href: "/admin/organizers",
    organizerOnly: true,
  },
] as const;

/** A section an admin page can be: only sections that have a page. */
export type AdminSection = Extract<
  (typeof SECTIONS)[number],
  { href: string }
>["label"];

/**
 * The banner under the admin header when the War Week being administered
 * isn't the current one, or null.
 */
export function editingBanner(
  warWeek: Pick<WarWeek, "edition" | "status">,
  editions: AdminEdition[],
): string | null {
  const selected = editions.find((e) => e.edition === warWeek.edition);
  if (!selected || selected.current) return null;
  const name = `War Week ${warWeek.edition.toUpperCase()}`;
  return warWeek.status === "complete"
    ? `Editing the Archive: ${name}`
    : `Editing ${warWeek.status} ${name}`;
}

/**
 * Frame for every `/admin` page: header (with the edition switcher), nav
 * and content. The nav is a side column on desktop and a scrolling row on a
 * phone; a Host doesn't see the Organizer-only sections.
 */
export function AdminShell({
  warWeek,
  email,
  isOrganizer,
  editions = [],
  current,
  children,
}: {
  warWeek: WarWeek;
  email: string;
  /** False for a Host: hides the Organizer-only sections. */
  isOrganizer: boolean;
  /** Editions the Organizer or Host may open, for the switcher. */
  editions?: AdminEdition[];
  current: AdminSection;
  children: React.ReactNode;
}) {
  const banner = editingBanner(warWeek, editions);
  return (
    <ThemeRoot
      style={warWeekThemeStyle(warWeek)}
      className="bg-background text-foreground flex min-h-dvh flex-col font-sans"
    >
      <header className="border-border flex flex-wrap items-center gap-x-4 gap-y-1 border-b px-4 py-3 md:px-6">
        <Link href="/admin" className="font-bold">
          War Week {warWeek.edition.toUpperCase()} admin
        </Link>
        <span className="text-foreground/60 text-sm">{warWeek.storyTheme}</span>
        {editions.length > 1 && (
          <AdminEditionSwitcher
            editions={editions}
            selected={warWeek.edition}
          />
        )}
        <div className="flex min-w-0 flex-wrap items-center gap-3 text-sm md:ml-auto">
          <Link
            href={`/${warWeek.edition}`}
            className="text-primary underline-offset-4 hover:underline"
          >
            Back to War Week {warWeek.edition.toUpperCase()}
          </Link>
          <span className="text-foreground/70 truncate">{email}</span>
          <SignOutButton />
        </div>
      </header>
      {banner && (
        <p
          role="status"
          className="bg-accent text-accent-foreground px-4 py-2 text-sm font-medium md:px-6"
        >
          {banner}
        </p>
      )}
      <div className="flex flex-1 flex-col md:flex-row">
        <nav
          aria-label="Admin sections"
          className="border-border shrink-0 overflow-x-auto border-b p-2 md:w-56 md:border-r md:border-b-0 md:p-3"
        >
          <ul className="flex gap-1 md:flex-col">
            {SECTIONS.filter(
              (section) => isOrganizer || !("organizerOnly" in section),
            ).map(({ label, icon: Icon, href }) => {
              const content = (
                <>
                  <Icon aria-hidden className="size-4 shrink-0" />
                  <span className="flex-1">{label}</span>
                  {!href && <span className="text-xs">Soon</span>}
                </>
              );
              const base =
                "flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm";
              return (
                <li key={label}>
                  {href && label === current ? (
                    <Link
                      href={href}
                      aria-current="page"
                      className={`${base} bg-primary/10 text-primary font-medium`}
                    >
                      {content}
                    </Link>
                  ) : href ? (
                    <Link href={href} className={`${base} hover:bg-muted`}>
                      {content}
                    </Link>
                  ) : (
                    <span className={`${base} text-foreground/50`}>
                      {content}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>
        <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
      </div>
      <SiteFooter className="border-border border-t" />
      {/* Inside the themed root so the edition's colors apply to toasts. */}
      <Toaster position="bottom-center" closeButton />
    </ThemeRoot>
  );
}

/**
 * Shown to a signed-in Jahnel Group user who may not use an `/admin` page:
 * neither an Organizer nor a Host there, or a Host on an Organizer-only
 * page.
 */
export function AdminRefused({
  warWeek,
  email,
}: {
  warWeek: WarWeek;
  email: string;
}) {
  return (
    <>
      <main className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="text-2xl font-bold">{ADMIN_REFUSAL}</h1>
        <p className="text-foreground/70">
          {email} can&apos;t use this page for War Week{" "}
          {warWeek.edition.toUpperCase()}. Ask an Organizer if you should have
          access.
        </p>
        <div className="flex items-center gap-3">
          <Link
            href={`/${warWeek.edition}`}
            className="text-primary underline underline-offset-4"
          >
            Go to War Week {warWeek.edition.toUpperCase()}
          </Link>
          <SignOutButton />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
