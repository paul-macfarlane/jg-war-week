import type { ReactNode } from "react";

import { getNavAccount } from "@/app/[edition]/war-week";
import { BottomTabBar, TopNav } from "@/components/primary-nav";
import { SiteFooter } from "@/components/site-footer";
import { ThemeRoot } from "@/components/theme-root";
import { YouProvider } from "@/components/you";
import type { WarWeek } from "@/db/schema";
import { resolveProfileForEmail } from "@/lib/profile";
import { warWeekThemeStyle } from "@/lib/theme";
import { resolveYou } from "@/lib/you";
import { getProfilesByEmail } from "@/queries/profile-join";
import { getYouCandidates } from "@/queries/roster";

/**
 * The themed War Week chrome: top nav, bottom tab bar, footer and the signed-in
 * You, around `children`. Used by the `[edition]` layout and by `/history`,
 * which wears the current War Week's chrome.
 */
export async function WarWeekChrome({
  warWeek,
  children,
}: {
  warWeek: WarWeek;
  children: ReactNode;
}) {
  // Only the Profile lookup waits for the email.
  const [candidates, [account, profiles]] = await Promise.all([
    getYouCandidates(warWeek),
    getNavAccount().then(
      async (account) =>
        [account, await getProfilesByEmail([account.email])] as const,
    ),
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
  const { name, image } = resolveProfileForEmail(
    account.email,
    profiles,
    rosterName,
  );

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
        account={{ ...account, name, image }}
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
