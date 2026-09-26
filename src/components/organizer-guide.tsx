import Link from "next/link";

import { SETUP_SECTIONS } from "@/app/admin/setup/sections";

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

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <h1 className="text-2xl font-bold">Organizer guide</h1>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">First-time setup order</h2>
        <p className="text-foreground/70">
          Set up a War Week in this order; each step depends on the ones before
          it:
        </p>
        <ol className="text-foreground/70 list-decimal space-y-1 pl-5">
          {SETUP_SECTIONS.map((section) => (
            <li key={section.label}>
              {section.href ? (
                <Link
                  href={section.href}
                  className="text-primary underline underline-offset-4"
                >
                  {section.label === "Teams & roster"
                    ? `${teamLabel} & roster`
                    : section.label}
                </Link>
              ) : (
                section.label
              )}
              {" — "}
              {section.label === "Teams & roster"
                ? `${teamLabel}s, Participants and ${leaderTitle}s.`
                : section.description}
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Adding Organizers</h2>
        <p className="text-foreground/70">
          <Link
            href="/admin/setup/war-week"
            className="text-primary underline underline-offset-4"
          >
            War Week settings
          </Link>{" "}
          holds the Organizer emails list. Anyone whose email is on it gets the
          admin pages the next time they sign in — there are no other roles. You
          can&apos;t remove your own email from the list.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">What a Participant email does</h2>
        <p className="text-foreground/70">
          A Participant&apos;s email is optional. When a signed-in
          @jahnelgroup.com email matches a roster Participant&apos;s email, that
          Participant and their {teamLower} are highlighted as &quot;You&quot;
          wherever they appear. Nothing else reads it — it isn&apos;t used for
          sign-in or access.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Discretionary points</h2>
        <p className="text-foreground/70">
          For points that aren&apos;t tied to a specific Competition, make a
          Competition such as &quot;Spirit / Discretionary&quot; under{" "}
          <Link
            href="/admin/setup/competitions"
            className="text-primary underline underline-offset-4"
          >
            Competitions
          </Link>
          , then add{" "}
          <Link
            href="/admin/points"
            className="text-primary underline underline-offset-4"
          >
            Points Entries
          </Link>{" "}
          against it with a note explaining why. Going over the
          Competition&apos;s max points only shows a warning — it still saves,
          in case the entry is a bonus.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Placement Points</h2>
        <p className="text-foreground/70">
          Each Competition can preset Placement Points for 1st, 2nd, 3rd and on,
          highest place first, up to 5 places. They show up as one-tap buttons
          in Points Entry, so entering a result is a single click. 1st
          place&apos;s preset can&apos;t exceed the Competition&apos;s max
          points.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Running a Bracket</h2>
        <p className="text-foreground/70">
          Set a Competition&apos;s Format to single elimination under{" "}
          <Link
            href="/admin/setup/competitions"
            className="text-primary underline underline-offset-4"
          >
            Competitions
          </Link>
          , then open its Bracket builder to pick Entrants — all {teamLower}s,
          or specific Participants — and Generate the Bracket (Seed Positions
          are random; Re-roll before any Heat is played to try again). From the
          results screen, tap a Heat to record its winner, score or a forfeit;
          changing a decided Heat&apos;s winner resets the later Heats that
          followed from it, while a score-only edit keeps them. Finalize turns
          the Bracket&apos;s placings into Points Entries marked &quot;From
          bracket&quot;; un-finalize removes them so you can fix a Heat and
          finalize again. While it&apos;s finalized, the Competition&apos;s
          scoring and Placement Points can&apos;t change: un-finalize first.
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
            href="/admin/standings"
            className="text-primary underline underline-offset-4"
          >
            Finale
          </Link>{" "}
          on the projector and press Start: the Standings count in from last
          place to first. Replay runs it again. The Finale never changes the
          Standings, it only plays them.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">
          Ending {edition.toUpperCase()} and starting the next War Week
        </h2>
        <p className="text-foreground/70">
          The{" "}
          <Link
            href="/admin/setup"
            className="text-primary underline underline-offset-4"
          >
            Setup
          </Link>{" "}
          page&apos;s Lifecycle box moves a War Week through Start, End and
          Reopen. Only one War Week is ever live: End this one (confirming the
          Winner, prefilled from first place, and any highlights) before the
          next can Start. Create next War Week copies what you choose
          (Organizers and settings by default; Competitions and the FAQ are off)
          and opens the new edition as upcoming, so you can set it up while this
          one stays live. The header&apos;s edition switcher moves the admin
          between editions you may administer — a banner marks the Archive so
          you don&apos;t mistake it for the live one.
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
          don&apos;t reload it.
        </p>
      </section>
    </div>
  );
}
