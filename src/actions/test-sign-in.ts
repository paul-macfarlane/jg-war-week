"use server";

import { redirect } from "next/navigation";

import { guarded } from "@/actions/result";
import { auth } from "@/auth/server";
import { setSessionCookie } from "@/auth/session-cookie";
import { safeCallbackPath } from "@/lib/access";
import type { WriteResult } from "@/lib/result";
import { type TestSignInInput, checkTestSignIn } from "@/lib/test-sign-in";

/**
 * Test sign-in (local and staging only): signs in as any Jahnel Group email
 * without Google, given the server's `TEST_SIGN_IN_SECRET`. Refused on every
 * request while Test sign-in is off (`testSignInEnabled`). Finds or creates
 * the user, starts a session marked `testSignIn`, sets better-auth's own
 * session cookie and redirects to the callback path.
 */
export async function testSignIn(input: TestSignInInput): Promise<WriteResult> {
  return guarded(async () => {
    const checked = checkTestSignIn({
      env: process.env,
      typedSecret: String(input.secret ?? ""),
      email: String(input.email ?? ""),
    });
    if (!checked.ok) return checked;

    const ctx = await auth.$context;
    const found = await ctx.internalAdapter.findUserByEmail(checked.email);
    // Verified, so a later Google sign-in with the same email links to this
    // user instead of being refused. The user-create hook still checks the
    // domain.
    const user =
      found?.user ??
      (await ctx.internalAdapter.createUser(
        {
          email: checked.email,
          name: checked.email.split("@")[0],
          emailVerified: true,
        },
        { method: "test-sign-in" },
      ));
    // `overrideAll`: the override wins over the field's default (false).
    const session = await ctx.internalAdapter.createSession(
      user.id,
      false,
      { testSignIn: true },
      true,
    );
    if (!session) throw new Error("Test sign-in: no session was created");

    await setSessionCookie(session.token);

    redirect(safeCallbackPath(input.callbackURL));
  });
}
