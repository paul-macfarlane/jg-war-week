import { redirect } from "next/navigation";
import { cache } from "react";

import { getActor } from "@/auth/actor";
import { nameFromEmail } from "@/lib/account";

/** The signed-in user, as shown in the navigation. */
export type NavAccount = {
  email: string;
  /**
   * The Profile name, else the roster name when linked to a Participant,
   * else the email's local part.
   */
  name: string;
  /** The Profile picture URL, else the Google photo; null for initials. */
  image?: string | null;
  canOpenAdmin: boolean;
};

/**
 * The signed-in user for the navigation, memoized per request. The Admin
 * link shows for an Organizer, or anyone who hosts a Competition in any War
 * Week (the `/admin` gate then opens their edition). The proxy already
 * requires sign-in; a missing session goes to sign-in.
 */
export const getNavAccount = cache(async (): Promise<NavAccount> => {
  const actor = await getActor();
  if (!actor) redirect("/sign-in");
  return {
    email: actor.email,
    name: nameFromEmail(actor.email),
    canOpenAdmin: actor.isOrganizer || actor.hosts.length > 0,
  };
});
