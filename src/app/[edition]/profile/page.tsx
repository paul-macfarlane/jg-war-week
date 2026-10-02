import { notFound, redirect } from "next/navigation";

import { getActor } from "@/auth/actor";
import { DeleteAccountSection } from "@/components/delete-account-section";
import { ProfileForm } from "@/components/profile-form";
import { Toaster } from "@/components/ui/sonner";
import { nameFromEmail } from "@/lib/account";
import { resolveProfile } from "@/lib/profile";
import { warWeekThemeStyle } from "@/lib/theme";
import { resolveYou } from "@/lib/you";
import { getProfilesByEmail } from "@/queries/profile-join";
import { getYouCandidates } from "@/queries/roster";

import { getWarWeekForEdition } from "../war-week";

/**
 * The signed-in person's Profile: the name and picture shown wherever their
 * email is linked, in every War Week. The roster name in the hint is the
 * one they're linked to in this War Week (You).
 */
export default async function ProfilePage({
  params,
}: PageProps<"/[edition]/profile">) {
  const { edition } = await params;
  const warWeek = await getWarWeekForEdition(edition);
  if (!warWeek) notFound();
  const actor = await getActor();
  if (!actor) {
    redirect(
      `/sign-in?callbackURL=${encodeURIComponent(`/${warWeek.edition}/profile`)}`,
    );
  }

  const [candidates, profiles] = await Promise.all([
    getYouCandidates(warWeek),
    getProfilesByEmail([actor.email]),
  ]);
  const linked = resolveYou({
    sessionEmail: actor.email,
    participants: candidates,
  });
  const rosterName = candidates.find(
    (c) => c.id === linked?.participantId,
  )?.displayName;
  const stored = profiles.get(actor.email.toLowerCase());
  // Only a Google photo reaches the form (`resolveProfile`'s rule).
  const googleImage = resolveProfile({
    rosterName: "",
    googleImage: stored?.googleImage,
  }).image;

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-6 md:max-w-3xl">
      <h1 className="text-2xl font-bold">Profile</h1>
      <p className="text-foreground/70 text-sm">
        Your name and picture show wherever your email is on a roster, in every
        War Week.
      </p>
      <ProfileForm
        fallbackName={rosterName ?? nameFromEmail(actor.email)}
        hint={
          rosterName
            ? `Shown as ${rosterName} until you set one.`
            : `Shown as ${nameFromEmail(actor.email)}.`
        }
        profileName={stored?.profileName ?? null}
        profileImage={stored?.profileImage ?? null}
        googleImage={googleImage}
        primaryColor={warWeek.primaryColor}
        themeStyle={warWeekThemeStyle(warWeek)}
      />
      <DeleteAccountSection email={actor.email} />
      <Toaster position="bottom-center" closeButton />
    </main>
  );
}
