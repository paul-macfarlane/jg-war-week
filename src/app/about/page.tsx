import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AboutFeatureGrid } from "@/components/about-feature-grid";
import { AboutFinaleDemo } from "@/components/about-finale-demo";
import { SiteFooter } from "@/components/site-footer";
import { ThemeRoot } from "@/components/theme-root";
import { buttonVariants } from "@/components/ui/button";
import type { WarWeek } from "@/db/schema";
import { ABOUT_FALLBACK_THEME } from "@/lib/about";
import { warWeekThemeStyle } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { getCurrentWarWeek } from "@/queries/war-weeks";

export const metadata: Metadata = {
  title: "About · JG War Week",
  description:
    "The JG War Week app is where Jahnel Group runs War Week: the Story Theme, schedule, players, Competitions, points and the Finale.",
};

/** Never statically prerendered: it reads the current War Week (ticket 03). */
export const dynamic = "force-dynamic";

/**
 * The public About page (tickets 28, 42): what the app is, why we built it
 * and what it does, in copy that holds for any edition (Teams or
 * free-for-all). Mostly static copy and stills, but it wears and links to
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
        <section className="animate-in fade-in flex flex-col duration-700 motion-reduce:animate-none">
          <div className="flex min-w-0 flex-col gap-6">
            <p className="text-primary text-xs font-semibold tracking-[0.2em] uppercase">
              Jahnel Group War Week · since 2016
            </p>
            <h1 className="text-4xl leading-[1.05] font-bold tracking-tight sm:text-6xl">
              Everything War Week, in one place.
            </h1>
            <p className="text-foreground/75 max-w-xl text-lg leading-relaxed sm:text-xl">
              The JG War Week app is where Jahnel Group runs War Week: the Story
              Theme, the schedule, the players, the Competitions, the points and
              the Finale, on every phone in the building.
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
        </section>

        <section className="border-border bg-background/60 flex flex-col gap-4 rounded-2xl border p-6 sm:p-10">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Why we built this
          </h2>
          <div className="text-foreground/80 flex max-w-3xl flex-col gap-4 leading-relaxed">
            <p>
              War Week has run at Jahnel Group every year since 2016. Each year,
              the schedule, the Teams, the rules and the points were spread
              across a wiki page, Slack and a scoring tool, and Organizers spent
              the week answering what&apos;s on, where, and who&apos;s winning.
            </p>
            <p>
              The JG War Week app is the one place for all of it. Organizers and
              Hosts run the week here, everyone else follows along from their
              phone, and past War Weeks are a tap away.
            </p>
          </div>
        </section>

        <section id="features" className="flex scroll-mt-8 flex-col gap-8">
          <h2 className="text-2xl font-bold tracking-tight sm:text-4xl">
            What it does
          </h2>
          <AboutFeatureGrid />
          <div className="border-border bg-background/60 flex flex-col items-center gap-4 rounded-xl border p-6 sm:flex-row sm:justify-center sm:gap-10">
            <AboutFinaleDemo />
            <p className="text-foreground/75 max-w-sm text-sm leading-relaxed">
              And at closing ceremonies, the Finale is a slideshow on the
              projector: By the numbers, Awards and Winners, then the Standings
              countdown, from last place to first.
            </p>
          </div>
          <p className="text-foreground/75 max-w-3xl leading-relaxed">
            Once you&apos;re signed in, <strong>More → Install app</strong> puts
            it on your home screen.
          </p>
        </section>

        <section className="flex flex-col items-start gap-5">
          <h2 className="text-3xl font-bold tracking-tight sm:text-5xl">
            Ready when you are.
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <OpenCurrentEdition current={current} />
          </div>
          <p className="text-foreground/60 text-sm">
            Sign-in is Google, @jahnelgroup.com accounts only.
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
