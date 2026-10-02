"use server";

import { redirect } from "next/navigation";

import { guarded } from "@/actions/result";
import { revalidateSite } from "@/actions/revalidate";
import { authorizeSelf } from "@/auth/authorize";
import { clearSessionCookie } from "@/auth/session-cookie";
import { type DeleteAccountInput, deleteAccountSchema } from "@/lib/account";
import { confirmTextMatches } from "@/lib/confirm-text";
import type { WriteResult } from "@/lib/result";
import * as mutations from "@/mutations/account";

/**
 * Deletes the signed-in person's own account, once they've typed their email
 * to confirm. Keyed on the actor's email, so nobody can delete another
 * account. A refusal (the last Organizer) comes back; on success the session
 * cookie is cleared and they land on the home page, signed out.
 */
export async function deleteMyAccount(
  input: DeleteAccountInput,
): Promise<WriteResult> {
  return guarded(async () => {
    const authorized = await authorizeSelf("account.delete");
    if (!authorized.ok) return authorized;
    const { actor } = authorized;
    const { confirmEmail } = deleteAccountSchema.parse(input);
    if (!confirmTextMatches(confirmEmail, actor.email)) {
      const error = "Type your email exactly to confirm.";
      return { ok: false, error, fieldErrors: { confirmEmail: error } };
    }
    const result = await mutations.deleteAccount(actor.email);
    if (!result.ok) return result;

    // Their Profile name and picture leave every page.
    revalidateSite();
    await clearSessionCookie();
    redirect("/");
  });
}
