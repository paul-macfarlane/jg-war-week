"use server";

import { makeSignature } from "better-auth/crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { guarded } from "@/actions/result";
import { auth } from "@/auth/server";
import { safeCallbackPath } from "@/lib/access";
import type { WriteResult } from "@/lib/result";
import { type TestSignInInput, testSignInRefusal } from "@/lib/test-sign-in";

/**
 * Test sign-in (local and staging only): signs in as any Jahnel Group email
 * without Google, given the server's `TEST_SIGN_IN_SECRET`. Refused on every
 * request while Test sign-in is off (`testSignInEnabled`). Finds or creates
 * the user, starts a session marked `testSignIn`, sets better-auth's own
 * session cookie and redirects to the callback path.
 */
export async function testSignIn(input: TestSignInInput): Promise<WriteResult> {
  return guarded(async () => {
    const checked = testSignInRefusal({
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

    // Signed the way better-auth's `setSignedCookie` signs it. `cookies().set`
    // URL-encodes the value itself, so it isn't encoded here.
    const { name, attributes } = ctx.authCookies.sessionToken;
    const signature = await makeSignature(session.token, ctx.secret);
    (await cookies()).set(name, `${session.token}.${signature}`, {
      path: attributes.path,
      httpOnly: attributes.httpOnly,
      secure: attributes.secure,
      sameSite: attributes.sameSite?.toLowerCase() as
        "lax" | "strict" | "none" | undefined,
      maxAge: attributes.maxAge,
      domain: attributes.domain,
    });

    redirect(safeCallbackPath(input.callbackURL));
  });
}
