import Link from "next/link";

import { type AdminSection, adminSectionsFor } from "@/lib/admin-sections";

/**
 * The in-app guide for a first-time Organizer, at `/admin/guide`. Plain
 * server-rendered JSX: no database reads or session, just the War Week's
 * edition and labels for the examples.
 */
export function OrganizerGuide({
  edition,
  teamLabel,
  leaderTitle,
}: {
  edition: string;
  teamLabel: string;
  leaderTitle: string;
}) {
  const teamLower = teamLabel.toLowerCase();
  /** What each admin section is for, in the tour of the nav. */
  const help: Record<AdminSection, string> = {
    Competitions:
      "Competitions, each with one page for its settings, scoring, Placement Points, Hosts and description, and for running its Placements, Bracket, Head-to-head, Best score or Participation.",
    "Discretionary points":
      "Give points to a Team or Participant with a reason and no Competition behind them; edit or delete them in the ledger.",
    Schedule:
      "The War Week's Days with their Day Themes and short descriptions, and each Day's Schedule Items.",
    Roster: `${teamLabel}s, Participants and ${leaderTitle}s, with Import from a sheet or CSV and a search by name or email.`,
    Announcements: "Post, pin and edit Announcements.",
    Awards: `Give Awards to a ${teamLower} or to Participants, and add one from a preset name.`,
    FAQ: "FAQ Items and their order on the public FAQ.",
    Finale: "Open the Finale on the projector, and order or hide its slides.",
    Settings:
      "Story Theme, dates, mode, labels, links and the Appearance Theme; the Lifecycle box (Start, End, Unstart, Reopen, and Create next War Week once the latest War Week has ended).",
    Organizers: "Who the Organizers are.",
    Guide: "This page.",
  };
  const link = (href: string, label: string) => (
    <Link href={href} className="text-primary underline underline-offset-4">
      {label}
    </Link>
  );
  const setupOrder = [
    [
      "/admin/settings",
      "Settings",
      "the Story Theme, dates, mode and labels first.",
    ],
    ["/admin/schedule", "Schedule", "add the Days and their Day Themes."],
    [
      "/admin/roster",
      "Roster",
      `${teamLabel}s, Participants and ${leaderTitle}s (or Import them from a sheet or CSV).`,
    ],
    [
      "/admin/competitions",
      "Competitions",
      "Competitions, scoring, Placement Points and Hosts.",
    ],
    [
      "/admin/schedule",
      "Schedule",
      "each Day's Schedule Items, once the Days and Competitions exist.",
    ],
    ["/admin/faq", "FAQ", "FAQ Items and their order."],
  ] as const;

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <h1 className="text-2xl font-bold">Organizer guide</h1>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Finding your way</h2>
        <p className="text-foreground/70">
          Every admin page is one click from the nav, in this order:
        </p>
        <ul className="text-foreground/70 list-disc space-y-1 pl-5">
          {adminSectionsFor(true).map(({ label, href }) => (
            <li key={label}>
              {link(href, label)}
              {" — "}
              {help[label]}
            </li>
          ))}
        </ul>
        <p className="text-foreground/70">
          On a phone, Competitions, Discretionary points, Schedule and
          Announcements are tabs (with shortened labels) on the bar at the
          bottom of the screen; the rest are under More, with the edition
          switcher. Display, Back to War Week and Sign out are in the account
          menu (your initials, top right).
        </p>
        <p className="text-foreground/70">
          A Host sees only the Competitions they host and the Guide; the other
          pages are for Organizers.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">First-time setup order</h2>
        <p className="text-foreground/70">
          Set up a War Week in this order; each step depends on the ones before
          it:
        </p>
        <ol className="text-foreground/70 list-decimal space-y-1 pl-5">
          {setupOrder.map(([href, label, what], index) => (
            <li key={index}>
              {link(href, label)}
              {" — "}
              {what}
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Organizers and Hosts</h2>
        <p className="text-foreground/70">
          Organizers run every War Week. The{" "}
          <Link
            href="/admin/organizers"
            className="text-primary underline underline-offset-4"
          >
            Organizers
          </Link>{" "}
          page holds the list: add a @jahnelgroup.com email and they get the
          admin pages the next time they load one. You can remove anyone,
          yourself included, as long as one Organizer is left.
        </p>
        <p className="text-foreground/70">
          A Host runs one Competition for you, and is a Participant on the
          roster. Assign Hosts on{" "}
          <Link
            href="/admin/competitions"
            className="text-primary underline underline-offset-4"
          >
            Competitions
          </Link>{" "}
          (the Hosts field in each Competition&apos;s Settings, picked from the
          roster by name; no email is shown). A Host gets access when they sign
          in with the email on their roster entry, so add it in Roster if they
          have none (changing a Participant&apos;s email moves their Host access
          to whoever owns the new one). A Host sees only the Competitions they
          host and this Guide in Admin: they record a Competition&apos;s
          results, run its Bracket, Matches and Attempts, and change its
          settings. Schedule, Announcements, the Finale and everything else stay
          with Organizers. A Schedule Item&apos;s Hosts are just who the
          schedule shows as &ldquo;Hosted by&rdquo;; it doesn&apos;t make anyone
          a Host.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">What a Participant email does</h2>
        <p className="text-foreground/70">
          A Participant&apos;s email is optional. When a signed-in
          @jahnelgroup.com email matches a roster Participant&apos;s email, that
          Participant&apos;s own rows are tagged &quot;You&quot; on the roster,
          the individual leaderboards, Award recipients on the Awards page and
          Participation lists; their Entrant in a Bracket (themselves, their
          Squad, or their {teamLower} in a team Bracket) is marked
          &quot;You&quot;; and a Head-to-head or Best score Competition&apos;s
          leaderboard marks their {teamLower} &quot;Your Team&quot;. {teamLabel}{" "}
          standings rows are not highlighted. They can log Matches and Attempts
          and report Bracket Matches when &quot;Participants can log their own
          results&quot; is on, and check in when Self check-in is on. A
          Participant without an email is never linked. It isn&apos;t used for
          sign-in and grants nothing beyond those Participant writes.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Discretionary points</h2>
        <p className="text-foreground/70">
          For points that aren&apos;t tied to a Competition, give{" "}
          <Link
            href="/admin/discretionary-points"
            className="text-primary underline underline-offset-4"
          >
            Discretionary points
          </Link>{" "}
          to a {teamLower} or a Participant with a reason. Only Organizers do
          this. A Participant&apos;s points also count toward their {teamLower}.
          You can edit or delete an entry in the ledger below the form.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Placement Points</h2>
        <p className="text-foreground/70">
          Each Competition can preset Placement Points for 1st, 2nd, 3rd and on,
          highest place first and never rising, with as many places as you need
          (a Bracket allows up to 5). A new Competition is a Placement: open its
          page and, under Record placements, add who took part, give each a
          Place (or a Score, with a Score direction that fills the Places) and
          Close, and the Standings move through its Placement Points. Reopen
          withdraws them. A Competition&apos;s top prize is its 1st place.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Running a Bracket</h2>
        <p className="text-foreground/70">
          Choose Bracket as a Competition&apos;s Format when you add it under{" "}
          <Link
            href="/admin/competitions"
            className="text-primary underline underline-offset-4"
          >
            Competitions
          </Link>{" "}
          and you land on its page, with the Settings on top (each field saves
          as you change it) and the Bracket below. The Format can change between
          any Formats until the Competition has a result. Settings that decide
          how it runs lock as it goes, each showing why: the Format and scoring
          once any result exists; a Head-to-head Competition&apos;s draws and
          Best of once it has a Match; and the Match size, how many advance, the
          3rd place Match, the Entrants and building the Bracket once a Match
          has a result. Nothing resets a Bracket; add a new Competition to start
          over. A Bracket is Head-to-head or Group: Head-to-head is one against
          one, the Winner going on Round after Round to the final; Group puts 3
          to 8 Entrants per Match and sends the top few on, Round after Round,
          until one Match is left. In a Head-to-head Bracket with at least 4
          Entrants, turn on the 3rd place Match to have the semifinal losers
          play for 3rd and 4th beside the final. Placings come only from the
          final and the 3rd place Match: the final gives 1st and 2nd, the 3rd
          place Match 3rd and 4th; without one, only 1st and 2nd are placed and
          the semifinal losers get nothing. In a Group Bracket, the final&apos;s
          finishing order gives places 1 to 4. Nothing goes past 4th, and nobody
          else is placed. On the same page, pick Entrants — all {teamLower}s, or
          specific Participants — and Generate the Bracket (Seed Positions are
          random; Re-roll before any Match is played to try again). Once a Match
          has a result, the Entrants and Seed Positions fold away under
          &quot;Entrants and Seed Positions&quot;. Below it is the
          Bracket&apos;s tree, the same one Participants see (an Entrant gets a
          &quot;Jump to your Match&quot; button on it). In a Group Bracket, Edit
          on each Round heading sets that Round&apos;s defaults (Match size and
          how many advance), how many advance from one Match, and moves an
          Entrant to another Match of the Round. A Round locks once it has a
          result. Press Record result on a Match in the tree (Edit once
          it&apos;s recorded) to enter it: its Winner, or for a bigger Match its
          Entrants in finishing order, with scores, in a dialog centered on a
          screen or a bottom sheet on a phone; the tree shows when each Match
          was recorded. Only the latest result along a path changes: a Match a
          later Match already used shows a lock icon with Edit and Clear result
          disabled (hover, focus or tap them for &quot;Change that Match
          first&quot;), and in a Group Bracket every Match before a round with a
          result is the same (&quot;Change that round first&quot;). To correct
          one, clear results back from the latest one, then record again. Close,
          once every Match is played (the 3rd place Match too), turns the
          Bracket&apos;s placings into Points Entries marked &quot;From
          bracket&quot;; Reopen removes them so you can fix a Match and Close
          again. While it&apos;s Closed, its settings except the name,
          description, Group, Hosts and Placement Points are locked: Reopen
          first (a Placement Points change applies at the next Close).
        </p>
        <h3 className="font-semibold">Squads and self-report</h3>
        <p className="text-foreground/70">
          A {teamLower} Competition can enter Squads instead of whole{" "}
          {teamLower}s. In the Bracket section&apos;s Squads, Add Squad names a
          group of one {teamLower}&apos;s Participants (each in one Squad per
          Competition); then set Entrants are to Squads and press All Squads.
          Each Squad&apos;s Placement Points go to its {teamLower}, and Squads
          are seeded at random. Turn on Participants can log their own results
          and a Participant whose roster email matches their sign-in can record
          their own Match, from Your next Match or its Record result in the
          tree, and change it until a later Match uses it (in a Group Bracket,
          until a later round has a result); it counts at once. The tree shows
          &quot;Reported by&quot; on that Match, and you can still change any
          result there. Turn it off to stop new reports; results already
          reported stand.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">
          Running a Participation Competition
        </h2>
        <p className="text-foreground/70">
          For something people either did or didn&apos;t (Black Midnight, a
          daily workout). Choose the Format Participation when you add it under{" "}
          <Link
            href="/admin/competitions"
            className="text-primary underline underline-offset-4"
          >
            Competitions
          </Link>{" "}
          and you land on its page; the Format can change until anyone is
          marked. Set the points per Participant for an individual Competition;
          a {teamLower} Competition ranks {teamLower}s by headcount and pays its
          Placement Points for each place. Tick who took part, or turn on Self
          check-in so Participants can Check in themselves (they can only remove
          their own check-in, never your tick). Nothing scores until you Close
          it, which turns who took part into Points Entries; Reopen withdraws
          them. Close it before you end the War Week: End warns about one left
          open.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Awards across years</h2>
        <p className="text-foreground/70">
          When you add an Award on{" "}
          <Link
            href="/admin/awards"
            className="text-primary underline underline-offset-4"
          >
            Awards
          </Link>
          , the Preset picker offers every Award name used in any War Week, plus
          War Week MVP, Billable Hours Champ, Black Midnight, Grow, Grind, Serve
          and Inspire. Picking one fills in the name and its latest description;
          both stay editable, and a brand-new name works too. There are no
          Categories: the same name, ignoring case and punctuation, is what
          History uses to show an Award through the years.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">
          The Finale at closing ceremony
        </h2>
        <p className="text-foreground/70">
          Standings are always visible to Participants and Claude. At closing
          ceremonies, open the{" "}
          <Link
            href="/admin/finale"
            className="text-primary underline underline-offset-4"
          >
            Finale
          </Link>{" "}
          on the projector: it is a slideshow, and you step through it with the
          right arrow, Space or a click (the left arrow goes back, Escape
          returns to the first slide). Nothing moves on its own. The slides are
          Title, By the numbers, Awards, Winners, the Standings countdown (last
          place to first, for the top 10 only, then how many more scored) and
          Winner; the countdown plays when you arrive on it, and Replay runs it
          again. On the Finale page you can reorder or hide the slides, add your
          own Custom slides (only Organizers open this page). The Awards slide
          reveals one Award per step. The Finale never changes the Standings, it
          only plays them.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">
          Ending {edition.toUpperCase()} and starting the next War Week
        </h2>
        <p className="text-foreground/70">
          The{" "}
          <Link
            href="/admin/settings"
            className="text-primary underline underline-offset-4"
          >
            Settings
          </Link>{" "}
          page&apos;s Lifecycle box moves a War Week through Start, End, Unstart
          and Reopen. Unstart sends a live War Week back to Upcoming, but only
          while nothing has been scored. Only one War Week is ever live: End
          this one (it shows the Winner it will record — first place in the
          Standings, a &quot;Tie: A &amp; B&quot; when Teams or Participants
          tie, blank when nobody scored, with no way to type a different one —
          and any highlights) before the next can Start. Once the latest War
          Week has ended, its Lifecycle box shows Create next War Week: it
          copies nothing (default settings, no Competitions, no FAQ) and opens
          the new edition as upcoming. It isn&apos;t offered while the latest
          War Week is upcoming or live, or on an older one. The End confirm
          names any Bracket that isn&apos;t closed: close it first so its
          placings count (it warns, it doesn&apos;t stop you). The header&apos;s
          edition switcher (in More on a phone) moves the admin between editions
          you may administer — a banner marks the Archive so you don&apos;t
          mistake it for the live one.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Announcements and Slack</h2>
        <p className="text-foreground/70">
          <Link
            href="/admin/announcements"
            className="text-primary underline underline-offset-4"
          >
            Announcements
          </Link>{" "}
          support rich text and video, and one can be pinned to the home screen.
          The JG War Week app doesn&apos;t post to Slack for you — it only
          stores the War Week&apos;s Slack URL and links to it. Post the
          Announcement&apos;s link in Slack yourself.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">The seed warning</h2>
        <p className="text-foreground/70">
          Reloading this War Week&apos;s seed file (
          <code>pnpm seed:load seeds/{edition}.json</code>) overwrites the setup
          edited here with the seed&apos;s values. Update the seed too, or
          don&apos;t reload it. Settings shows this warning at the top.
        </p>
      </section>
    </div>
  );
}
