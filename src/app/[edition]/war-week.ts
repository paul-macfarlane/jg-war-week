import { redirect } from "next/navigation";
import { cache } from "react";

import { getActor } from "@/auth/actor";
import type { NavAccount } from "@/components/primary-nav";
import { getWarWeekByEdition } from "@/queries/war-weeks";

/**
 * Loads a War Week by its edition segment, memoized per request so the
 * `[edition]` layout and its pages can each call it without issuing
 * duplicate queries.
 */
export const getWarWeekForEdition = cache(async (edition: string) => {
  return getWarWeekByEdition(edition.toLowerCase());
});

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
    canOpenAdmin: actor.isOrganizer || actor.hosts.length > 0,
  };
});
