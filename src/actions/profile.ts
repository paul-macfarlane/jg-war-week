"use server";

import { guarded } from "@/actions/result";
import { revalidateSite } from "@/actions/revalidate";
import { authorizeSelf } from "@/auth/authorize";
import { fieldErrorsFrom } from "@/lib/form-errors";
import { type ProfileInput, profileSchema } from "@/lib/profile";
import type { WriteResult } from "@/lib/result";
import * as mutations from "@/mutations/profile";

/**
 * Saves the signed-in person's own Profile name and picture URL; both
 * empty clears the Profile. Keyed on the actor's email, so nobody can change
 * another person's Profile. Revalidates every page, since the name and
 * picture show wherever the email is linked.
 */
export async function saveProfile(input: ProfileInput): Promise<WriteResult> {
  return guarded(async () => {
    const authorized = await authorizeSelf("profile.save");
    if (!authorized.ok) return authorized;
    const parsed = profileSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        ...fieldErrorsFrom(parsed.error, {
          labels: { name: "Profile name", imageUrl: "Picture URL" },
        }),
      };
    }
    const result = await mutations.saveProfile(
      authorized.actor.email,
      parsed.data,
    );
    if (result.ok) revalidateSite();
    return result;
  });
}
