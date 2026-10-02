import { AccountMenu } from "@/components/account-menu";
import { resolveProfileForEmail } from "@/lib/profile";
import { getProfilesByEmail } from "@/queries/profile-join";

/**
 * The admin header's account menu, with the actor's own Profile name (else
 * the email's local part) and picture. Its Profile item opens the current
 * War Week's Profile page.
 */
export async function AdminAccountMenu({
  email,
  edition,
  profileEdition,
  primaryColor,
  slackUrl,
}: {
  email: string;
  /** The War Week being administered: Back to War Week goes there. */
  edition: string;
  /** The current War Week, whose Profile page the menu links to. */
  profileEdition: string;
  primaryColor: string;
  slackUrl?: string | null;
}) {
  const { name, image } = resolveProfileForEmail(
    email,
    await getProfilesByEmail([email]),
  );
  return (
    <AccountMenu
      name={name}
      image={image}
      email={email}
      edition={edition}
      profileEdition={profileEdition}
      primaryColor={primaryColor}
      canOpenAdmin
      inAdmin
      slackUrl={slackUrl}
    />
  );
}
