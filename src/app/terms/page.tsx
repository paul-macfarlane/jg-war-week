import type { Metadata } from "next";
import Link from "next/link";

import { SiteFooter } from "@/components/site-footer";
import { ThemeRoot } from "@/components/theme-root";
import { ABOUT_FALLBACK_THEME } from "@/lib/about";
import { warWeekThemeStyle } from "@/lib/theme";
import { getCurrentWarWeek } from "@/queries/war-weeks";

export const metadata: Metadata = {
  title: "Terms · JG War Week",
  description: "The terms for using JG War Week.",
};

/** Never statically prerendered: it reads the current War Week. */
export const dynamic = "force-dynamic";

/**
 * The public Terms page: plain-language terms for using JG War Week. Copy only,
 * but like `/about` it wears the current War Week's Appearance
 * Theme (`getCurrentWarWeek`), else `ABOUT_FALLBACK_THEME`. No session reads;
 * still one of the `PUBLIC_PATHS` in `src/lib/access.ts`.
 */
export default async function TermsPage() {
  const current = await getCurrentWarWeek();
  const theme = current ?? ABOUT_FALLBACK_THEME;

  return (
    <ThemeRoot
      style={warWeekThemeStyle(theme)}
      className="bg-background text-foreground flex min-h-dvh flex-col font-sans"
    >
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Link href="/about" className="text-sm font-bold tracking-wide">
          JG War Week
        </Link>
        <Link
          href="/sign-in"
          className="text-foreground/70 hover:text-foreground text-sm underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Terms
          </h1>
          <p className="text-foreground/60 text-sm">
            Last updated: October 2, 2026
          </p>
        </div>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold tracking-tight">
            An internal tool
          </h2>
          <p className="text-foreground/80 leading-relaxed">
            The JG War Week app is an internal Jahnel Group tool for Jahnel
            Group employees only. Signing in requires an @jahnelgroup.com Google
            account.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold tracking-tight">
            Provided as is
          </h2>
          <p className="text-foreground/80 leading-relaxed">
            The JG War Week app is provided as is, with no warranty of any kind.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold tracking-tight">
            Acceptable use
          </h2>
          <p className="text-foreground/80 leading-relaxed">
            Don&apos;t post offensive, harassing or confidential content in
            Announcements, Team names, your Profile name and picture or anything
            else you enter.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold tracking-tight">Test sign-in</h2>
          <p className="text-foreground/80 leading-relaxed">
            Test sign-in is a maintainer tool for testing. It is never on for
            the production site.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold tracking-tight">
            Edits and changes
          </h2>
          <p className="text-foreground/80 leading-relaxed">
            Jahnel Group and War Week Organizers can edit or remove any content,
            and can change these terms.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold tracking-tight">Questions</h2>
          <p className="text-foreground/80 leading-relaxed">
            Contact the Jahnel Group admins.
          </p>
        </section>
      </main>
      <SiteFooter />
    </ThemeRoot>
  );
}
