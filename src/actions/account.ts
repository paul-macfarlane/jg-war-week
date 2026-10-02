"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { guarded } from "@/actions/result";
import { authorizeSelf } from "@/auth/authorize";
import { auth } from "@/auth/server";
import type { WriteResult } from "@/lib/result";
import * as mutations from "@/mutations/account";

/**
 * Deletes the signed-in person's own account, once they've typed their email
 * to confirm. Keyed on the actor's email, so nobody can delete another
 * account. A refusal (the last Organizer) comes back; on success the session
 * cookie is cleared and they land on the home page, signed out.
 */
export async function deleteMyAccount(input: {
  confirmEmail: string;
}): Promise<WriteResult> {
  return guarded(async () => {
    const authorized = await authorizeSelf("account.delete");
    if (!authorized.ok) return authorized;
    const { actor } = authorized;
    const typed = String(input?.confirmEmail ?? "")
      .trim()
      .toLowerCase();
    if (typed !== actor.email.trim().toLowerCase()) {
      const error = "Type your email exactly to confirm.";
      return { ok: false, error, fieldErrors: { confirmEmail: error } };
    }
    const result = await mutations.deleteAccount(actor.email);
    if (!result.ok) return result;

    // With its own attributes: a `__Secure-` cookie (https) is only
    // replaced by a Set-Cookie that is itself Secure.
    const { name, attributes } = (await auth.$context).authCookies.sessionToken;
    (await cookies()).delete({
      name,
      path: attributes.path,
      secure: attributes.secure,
      httpOnly: attributes.httpOnly,
      domain: attributes.domain,
    });
    redirect("/");
  });
}
