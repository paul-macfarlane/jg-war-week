import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BottomTabBar, TopNav } from "@/components/primary-nav";
import { SiteFooter } from "@/components/site-footer";
import { ThemeRoot } from "@/components/theme-root";
import { YouProvider } from "@/components/you";
import { warWeekThemeStyle } from "@/lib/theme";
import { resolveYou } from "@/lib/you";
import { getYouCandidates } from "@/queries/roster";

import { getNavAccount, getWarWeekForEdition } from "./war-week";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: LayoutProps<"/[edition]">): Promise<Metadata> {
  const { edition } = await params;
  const warWeek = await getWarWeekForEdition(edition);
  if (!warWeek) return {};

  return {
    title: `War Week ${warWeek.edition.toUpperCase()} · ${warWeek.storyTheme}`,
  };
}

export default async function EditionLayout({
  params,
  children,
}: LayoutProps<"/[edition]">) {
  const { edition } = await params;
  const warWeek = await getWarWeekForEdition(edition);
  if (!warWeek) notFound();
  const [account, candidates] = await Promise.all([
    getNavAccount(),
    getYouCandidates(warWeek),
  ]);
  // Account linking happens here, on the server, so Participant emails
  // never reach the client: only the matched id does.
  const linked = resolveYou({
    sessionEmail: account.email,
    participants: candidates,
  });

  const rosterName = candidates.find(
    (c) => c.id === linked?.participantId,
  )?.displayName;

  const themeStyle = warWeekThemeStyle(warWeek);

  return (
    <ThemeRoot
      style={themeStyle}
      className="bg-background text-foreground flex min-h-dvh flex-col pb-20 font-sans lg:pb-0"
    >
      <TopNav
        edition={warWeek.edition}
        storyTheme={warWeek.storyTheme}
        primaryColor={warWeek.primaryColor}
        slackUrl={warWeek.slackChannelUrl}
        account={{ ...account, name: rosterName ?? account.name }}
      />
      <div className="flex-1">
        <YouProvider linkedId={linked?.participantId ?? null}>
          {children}
        </YouProvider>
      </div>
      <SiteFooter />
      <BottomTabBar
        edition={warWeek.edition}
        mode={warWeek.mode}
        teamLabel={warWeek.teamLabel}
      />
    </ThemeRoot>
  );
}
