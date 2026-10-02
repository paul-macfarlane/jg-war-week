import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getSessionEmail, isGoogleConfigured } from "@/auth/server";
import { GoogleSignInButton } from "@/components/auth-buttons";
import { SiteFooter } from "@/components/site-footer";
import { ThemeRoot } from "@/components/theme-root";
import { JG_EMAIL_DOMAIN, safeCallbackPath } from "@/lib/access";
import { firstParam } from "@/lib/search-params";
import { warWeekThemeStyle } from "@/lib/theme";
import { WAR_WEEK_STATUS_LABEL, formatDateRange } from "@/lib/war-week-display";
import { getCurrentWarWeek } from "@/queries/war-weeks";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Sign in · JG War Week" };

/**
 * Dressed in the current War Week's Appearance Theme (colors, font, banner,
 * logo), so it changes with each year's Story Theme.
 */
export default async function SignInPage({
  searchParams,
}: PageProps<"/sign-in">) {
  const params = await searchParams;
  const callbackURL = safeCallbackPath(firstParam(params.callbackURL));
  const error = firstParam(params.error);

  if (await getSessionEmail()) redirect(callbackURL);

  const warWeek = await getCurrentWarWeek();
  const editionLabel = warWeek?.edition.toUpperCase();

  return (
    <ThemeRoot
      style={warWeek ? warWeekThemeStyle(warWeek) : undefined}
      className="bg-background text-foreground relative flex min-h-dvh flex-col items-center justify-center gap-6 overflow-hidden px-4 py-10 font-sans"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklch,var(--primary)_22%,transparent),transparent_60%)]"
      />
      <main className="border-border bg-background/90 relative flex w-full max-w-md flex-col overflow-hidden rounded-2xl border shadow-[0_0_60px_-15px_var(--primary)] backdrop-blur">
        {warWeek?.bannerUrl ? (
          <img
            src={warWeek.bannerUrl}
            alt={`War Week ${editionLabel} banner`}
            className="border-border h-40 w-full border-b object-cover"
          />
        ) : null}

        <div className="flex flex-col gap-6 p-8">
          {warWeek ? (
            <div className="flex items-center gap-4">
              {warWeek.logoUrl ? (
                <img
                  src={warWeek.logoUrl}
                  alt={`War Week ${editionLabel} logo`}
                  className="size-14 shrink-0 rounded-md"
                />
              ) : null}
              <div className="flex min-w-0 flex-col gap-1">
                <p className="text-2xl font-bold">War Week {editionLabel}</p>
                <p className="text-primary font-semibold">
                  {warWeek.storyTheme}
                </p>
                <p className="text-foreground/60 text-xs">
                  {WAR_WEEK_STATUS_LABEL[warWeek.status]} ·{" "}
                  {formatDateRange(warWeek.startDate, warWeek.endDate)}
                </p>
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <h1 className="text-xl font-semibold">Sign in to JG War Week</h1>
            <p className="text-foreground/70 text-sm">
              {`Use your @${JG_EMAIL_DOMAIN} Google account.`}
            </p>
          </div>

          {error && (
            <p
              role="alert"
              className="border-destructive/40 bg-destructive/10 text-destructive rounded-lg border px-4 py-3 text-sm"
            >
              Sign-in failed. Only @{JG_EMAIL_DOMAIN} Google accounts can sign
              in.
            </p>
          )}

          {isGoogleConfigured ? (
            <GoogleSignInButton callbackURL={callbackURL} />
          ) : (
            <p className="text-foreground/70 text-sm">
              Google sign-in isn&apos;t configured on this server.
            </p>
          )}
        </div>
      </main>
      <p className="text-foreground/70 relative text-sm">
        New here?{" "}
        <Link
          href="/about"
          className="hover:text-foreground underline underline-offset-4"
        >
          What the JG War Week app is
        </Link>
      </p>
      <SiteFooter className="relative py-0" />
    </ThemeRoot>
  );
}
