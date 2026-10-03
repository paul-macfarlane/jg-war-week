import Link from "next/link";

import { AdminAccountMenu } from "@/components/admin-account-menu";
import { AdminBottomBar } from "@/components/admin-bottom-bar";
import { AdminEditionSwitcher } from "@/components/admin-edition-switcher";
import { AdminSectionIcon } from "@/components/admin-section-icon";
import { SignOutButton } from "@/components/auth-buttons";
import { SiteFooter } from "@/components/site-footer";
import { ThemeRoot } from "@/components/theme-root";
import { Toaster } from "@/components/ui/sonner";
import type { WarWeek } from "@/db/schema";
import { ADMIN_REFUSAL, type AdminEdition } from "@/lib/access";
import { type AdminSection, adminSectionsFor } from "@/lib/admin-sections";
import { warWeekThemeStyle } from "@/lib/theme";

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
 * and content. From `md` the nav is a side column; below it the header is
 * one row and the nav is `AdminBottomBar`, fixed to the bottom, whose More
 * Sheet holds the rest of the header. A Host doesn't see the
 * Organizer-only sections.
 *
 * `--admin-bar-height` is the bar's height (0 from `md`, where there's no
 * bar) and `--admin-bar-inset` the space it takes at the bottom of the
 * viewport, safe area included: the root's bottom padding, so `main` and
 * the footer clear it, and the toasts' offset.
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
      className="bg-background text-foreground flex min-h-dvh flex-col pb-(--admin-bar-inset) font-sans [--admin-bar-height:4.5rem] [--admin-bar-inset:calc(var(--admin-bar-height)+env(safe-area-inset-bottom))] md:[--admin-bar-height:0px] md:[--admin-bar-inset:0px]"
    >
      <header className="border-border flex items-center gap-x-4 gap-y-1 border-b px-4 py-3 md:flex-wrap md:px-6">
        <Link
          href="/admin/competitions"
          className="min-w-0 truncate font-bold whitespace-nowrap"
        >
          War Week {warWeek.edition.toUpperCase()} admin
        </Link>
        {/* Below `md` the rest of the header is in the bar's More Sheet. */}
        <span className="text-foreground/60 hidden text-sm md:inline">
          {warWeek.storyTheme}
        </span>
        {editions.length > 1 && (
          <span className="hidden md:contents">
            <AdminEditionSwitcher
              editions={editions}
              selected={warWeek.edition}
            />
          </span>
        )}
        <div className="ml-auto flex min-w-0 items-center gap-3 text-sm">
          {/* Below `md` the way back is in the account menu. */}
          <Link
            href={`/${warWeek.edition}`}
            className="text-primary hidden underline-offset-4 hover:underline md:inline"
          >
            Back to War Week {warWeek.edition.toUpperCase()}
          </Link>
          <AdminAccountMenu
            email={email}
            edition={warWeek.edition}
            profileEdition={
              editions.find((e) => e.current)?.edition ?? warWeek.edition
            }
            primaryColor={warWeek.primaryColor}
            slackUrl={warWeek.slackChannelUrl}
          />
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
          className="border-border hidden shrink-0 overflow-x-auto border-r p-3 md:block md:w-56"
        >
          <ul className="flex flex-col gap-1">
            {adminSectionsFor(isOrganizer).map(({ label, icon, href }) => {
              const isCurrent = label === current;
              return (
                <li key={label}>
                  <Link
                    href={href}
                    aria-current={isCurrent ? "page" : undefined}
                    className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm whitespace-nowrap ${
                      isCurrent
                        ? "bg-primary/10 text-primary font-medium"
                        : "hover:bg-muted"
                    }`}
                  >
                    <AdminSectionIcon icon={icon} className="size-4 shrink-0" />
                    <span className="flex-1">{label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
      </div>
      <SiteFooter className="border-border border-t" />
      <AdminBottomBar
        edition={warWeek.edition}
        storyTheme={warWeek.storyTheme}
        isOrganizer={isOrganizer}
        current={current}
        editions={editions}
      />
      {/* Inside the themed root so the edition's colors apply to toasts.
          The offsets are Sonner's defaults (24px, and 16px up to 600px
          wide) plus the bottom bar's inset, which is 0 from `md`. */}
      <Toaster
        position="bottom-center"
        closeButton
        offset={{
          bottom: "calc(var(--admin-bar-inset) + 24px)",
        }}
        mobileOffset={{
          bottom: "calc(var(--admin-bar-inset) + 16px)",
        }}
      />
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
    <ThemeRoot
      style={warWeekThemeStyle(warWeek)}
      className="bg-background text-foreground flex min-h-dvh flex-col font-sans"
    >
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
      <SiteFooter className="mt-auto" />
    </ThemeRoot>
  );
}
