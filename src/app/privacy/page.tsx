import type { Metadata } from "next";
import Link from "next/link";

import { SiteFooter } from "@/components/site-footer";
import { ThemeRoot } from "@/components/theme-root";
import { ABOUT_FALLBACK_THEME } from "@/lib/about";
import { warWeekThemeStyle } from "@/lib/theme";
import { getCurrentWarWeek } from "@/queries/war-weeks";

export const metadata: Metadata = {
  title: "Privacy · JG War Week",
  description: "What JG War Week collects, why, and who can see it.",
};

/** Never statically prerendered: it reads the current War Week. */
export const dynamic = "force-dynamic";

/**
 * The public Privacy page: what JG War Week collects and why, in plain
 * language. Copy only, but like `/about` it wears the current War Week's
 * Appearance Theme (`getCurrentWarWeek`), else `ABOUT_FALLBACK_THEME`. No
 * session reads; still one of the `PUBLIC_PATHS` in `src/lib/access.ts`.
 */
export default async function PrivacyPage() {
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
            Privacy
          </h1>
          <p className="text-foreground/60 text-sm">
            Last updated: October 1, 2026
          </p>
        </div>

        <p className="text-foreground/80 leading-relaxed">
          The JG War Week app is an internal Jahnel Group tool for running and
          following War Week. This page explains what it collects, why, and who
          can see it.
        </p>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold tracking-tight">
            What sign-in collects
          </h2>
          <p className="text-foreground/80 leading-relaxed">
            Signing in uses Google, restricted to @jahnelgroup.com Google
            accounts. Google gives us your name, email address, whether Google
            verified it, and your profile picture URL. We also keep a session
            per signed-in browser: a session token, your IP address, your
            browser&apos;s user agent and the session&apos;s expiry; and the
            link to your Google account (Google&apos;s account ID and the OAuth
            tokens Google returns at sign-in), plus short-lived sign-in state
            used only to complete the sign-in.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold tracking-tight">
            Roster data Organizers enter
          </h2>
          <p className="text-foreground/80 leading-relaxed">
            Organizers enter each Participant&apos;s display name, Company Tag,
            their Team and whether they lead it (when the War Week has Teams),
            and an optional email. That email links a signed-in visitor to their
            Participant: it highlights &quot;You&quot;, and lets them enroll in
            a Bracket, log Games and report Heats.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold tracking-tight">Who did what</h2>
          <p className="text-foreground/80 leading-relaxed">
            The Organizer email list is kept once, for every War Week, and each
            Competition keeps its Host emails. The email of whoever entered a
            Points Entry is shown in Admin to Organizers and to that
            Competition&apos;s Hosts. An Announcement author&apos;s email is
            shown in Admin to Organizers and Hosts; everyone else sees only the
            author&apos;s roster name, or the part of their email before the @.
            The email of whoever logs a Game or reports a Bracket result is kept
            for audit and never shown.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold tracking-tight">Why</h2>
          <p className="text-foreground/80 leading-relaxed">
            We collect this to run War Week and keep its history. Ask Claude,
            the JG War Week app&apos;s read-only MCP connector, never returns an
            email address.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold tracking-tight">Sharing</h2>
          <p className="text-foreground/80 leading-relaxed">
            Nothing is sold or shared. The JG War Week app is hosted on Vercel
            with its database on Neon (Postgres). There is no analytics, no
            advertising and no tracking cookies — only the sign-in session
            cookie.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold tracking-tight">Retention</h2>
          <p className="text-foreground/80 leading-relaxed">
            Sessions expire. Accounts and War Week history (rosters, points,
            Announcements, Awards) are kept indefinitely as part of the War Week
            archive.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold tracking-tight">
            Corrections or removal
          </h2>
          <p className="text-foreground/80 leading-relaxed">
            Contact the Jahnel Group admins.
          </p>
        </section>
      </main>
      <SiteFooter />
    </ThemeRoot>
  );
}
