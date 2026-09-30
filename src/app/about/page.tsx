import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AboutFeatureGrid } from "@/components/about-feature-grid";
import { AboutFinaleDemo } from "@/components/about-finale-demo";
import { AboutStandingsDemo } from "@/components/about-standings-demo";
import { SiteFooter } from "@/components/site-footer";
import { ThemeRoot } from "@/components/theme-root";
import { buttonVariants } from "@/components/ui/button";
import type { WarWeek } from "@/db/schema";
import { ABOUT_FALLBACK_THEME, MAINTAINERS_GUIDE_URL } from "@/lib/about";
import { REPO_URL } from "@/lib/site";
import { warWeekThemeStyle } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { getCurrentWarWeek } from "@/queries/war-weeks";

export const metadata: Metadata = {
  title: "About · JG War Week",
  description:
    "The JG War Week app is where Jahnel Group runs War Week: setup, schedule, Teams, Competitions, points, the Finale, and every War Week since 2016.",
};

/** Never statically prerendered: it reads the current War Week (ticket 03). */
export const dynamic = "force-dynamic";

/**
 * The public About page (ticket 28): what War Week is, the problem, the
 * features and the history, for Jason first, then Organizers, then
 * Participants. Mostly static copy and stills, but it wears and links to
 * the *current* War Week's Appearance Theme (ticket 03): the live one, else
 * the next upcoming one, else the most recently completed one — the same
 * resolution the root page uses (`getCurrentWarWeek`). With no War Week at
 * all it falls back to `ABOUT_FALLBACK_THEME` and drops the "Open War
 * Week" button so the page stays readable either way. It is one of the
 * pages an anonymous visitor can open (`PUBLIC_PATHS` in
 * `src/lib/access.ts`).
 * The entrance fade is tw-animate-css's `animate-in`, turned off with
 * `motion-reduce:animate-none` for visitors who asked for no motion.
 */
export default async function AboutPage() {
  const current = await getCurrentWarWeek();
  const theme = current ?? ABOUT_FALLBACK_THEME;

  return (
    <ThemeRoot
      style={warWeekThemeStyle(theme)}
      className="bg-background text-foreground relative flex min-h-dvh flex-col overflow-hidden font-sans"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[60rem] bg-[radial-gradient(ellipse_at_top,color-mix(in_oklch,var(--primary)_18%,transparent),transparent_60%)]"
      />

      <header className="relative mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <span className="text-sm font-bold tracking-wide">JG War Week</span>
        <Link
          href="/"
          className="text-foreground/70 hover:text-foreground text-sm underline-offset-4 hover:underline"
        >
          Open JG War Week
        </Link>
      </header>

      <main className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col gap-20 px-4 pt-6 pb-20 sm:gap-28 sm:px-6 sm:pt-10">
        <section className="animate-in fade-in grid items-center gap-12 duration-700 motion-reduce:animate-none md:grid-cols-[minmax(0,1fr)_auto] md:gap-16">
          <div className="flex flex-col gap-6">
            <p className="text-primary text-xs font-semibold tracking-[0.2em] uppercase">
              Jahnel Group War Week · since 2016
            </p>
            <h1 className="text-4xl leading-[1.05] font-bold tracking-tight sm:text-6xl">
              Run War Week in one place, and keep every year of it.
            </h1>
            <p className="text-foreground/75 max-w-xl text-lg leading-relaxed sm:text-xl">
              The JG War Week app is where Jahnel Group runs War Week: the Story
              Theme, the schedule, the Teams, the Competitions, the points and
              the Finale, on every phone in the building. Organizers set it up
              with no code, and every War Week since 2016 is still here. Every
              edition works in light and dark, and each viewer picks Light, Dark
              or System.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <OpenCurrentEdition current={current} />
              <a
                href="#features"
                className={buttonVariants({ size: "lg", variant: "outline" })}
              >
                What it does
              </a>
            </div>
          </div>
          <AboutStandingsDemo />
        </section>

        <section className="flex flex-col gap-6">
          <h2 className="text-2xl font-bold tracking-tight sm:text-4xl">
            Why it exists
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            <Problem title="Competiscore was too general.">
              An earlier attempt: a general-purpose scoring platform, built for
              any kind of competition, that never quite fit how War Week works.
            </Problem>
            <Problem title="The history is scattered.">
              Ten years of War Week lived only in old wiki pages, one per year,
              each a little harder to find than the last.
            </Problem>
            <Problem title="The week ran on spreadsheets.">
              Organizers juggled spreadsheets, Slack and wikis, and answered the
              same questions all week: what&apos;s on, where, and who&apos;s
              winning.
            </Problem>
          </div>
          <p className="text-foreground/75 max-w-3xl text-lg leading-relaxed">
            The JG War Week app puts all of it in one place. Organizers set up
            an edition with no code, from the theme to the FAQ. Participants get
            a phone app. The history is back. And it is Jahnel Group&apos;s to
            change: the source is on GitHub, and the maintainer&apos;s guide
            walks through the first change.
          </p>
        </section>

        <section id="features" className="flex scroll-mt-8 flex-col gap-8">
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-bold tracking-tight sm:text-4xl">
              What it does
            </h2>
            <p className="text-foreground/60">
              Every still below is the app on the seeded demo War Week.
            </p>
          </div>
          <AboutFeatureGrid />
          <div className="border-border bg-background/60 flex flex-col items-center gap-4 rounded-xl border p-6 sm:flex-row sm:justify-center sm:gap-10">
            <AboutFinaleDemo />
            <p className="text-foreground/75 max-w-sm text-sm leading-relaxed">
              And at closing ceremonies, the Finale plays every Team&apos;s
              Standings counting up into place on the projector, from last to
              first.
            </p>
          </div>
          <p className="text-foreground/75 max-w-3xl leading-relaxed">
            Sign in and the JG War Week app finds you on the roster, so your
            Team is highlighted wherever it appears. Once you&apos;re signed in,{" "}
            <strong>More → Install app</strong> puts it on your home screen, and
            every War Week keeps its own colors and logo.
          </p>
        </section>

        <section className="border-border bg-background/60 flex flex-col gap-4 rounded-2xl border p-6 sm:p-10">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Why we built this
          </h2>
          <div className="text-foreground/80 flex max-w-3xl flex-col gap-4 leading-relaxed">
            <p>
              War Week has run every year since 2016; XI, in 2026, is the
              eleventh. For most of those years the points lived in one tool and
              the rest of each War Week in a wiki page that only the people who
              wrote it could find. Organizers juggled spreadsheets, Slack and
              wikis to run a week that was supposed to be fun.
            </p>
            <p>
              We wanted the next Organizer to open one screen, set the week up,
              and get back to competing. And we wanted to read about War Week
              2016 without asking anyone where the page went.
            </p>
            <p className="text-foreground/60 text-sm">Jahnel Group</p>
          </div>
        </section>

        <section className="flex flex-col items-start gap-5">
          <h2 className="text-3xl font-bold tracking-tight sm:text-5xl">
            Ready when you are.
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <OpenCurrentEdition current={current} />
            <a
              href={MAINTAINERS_GUIDE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ size: "lg", variant: "outline" })}
            >
              Read the maintainer&apos;s guide
            </a>
          </div>
          <p className="text-foreground/60 text-sm">
            Sign-in is Google, @jahnelgroup.com accounts only. The source is on{" "}
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4"
            >
              GitHub
            </a>
            .
          </p>
        </section>
      </main>
      <SiteFooter className="relative" />
    </ThemeRoot>
  );
}

/**
 * The page's one call to action, in the hero and at the end: opens the
 * current War Week (live, else next upcoming, else most recently
 * completed). With no War Week at all there is nothing to open, so this
 * renders a neutral, non-interactive stand-in instead of a live button.
 */
function OpenCurrentEdition({ current }: { current: WarWeek | undefined }) {
  if (!current) {
    return (
      <span
        className={cn(
          buttonVariants({ size: "lg", variant: "outline" }),
          "pointer-events-none opacity-60",
        )}
      >
        No War Week yet
      </span>
    );
  }
  return (
    <Link
      href={`/${current.edition}`}
      className={cn(buttonVariants({ size: "lg" }), "gap-2")}
    >
      Open War Week {current.edition.toUpperCase()}
      <ArrowRight aria-hidden className="size-4" />
    </Link>
  );
}

function Problem({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-border flex flex-col gap-2 rounded-xl border p-5">
      <h3 className="text-primary font-semibold">{title}</h3>
      <p className="text-foreground/75 text-sm leading-relaxed">{children}</p>
    </div>
  );
}
