import { makeSignature } from "better-auth/crypto";
import { cookies } from "next/headers";

import { auth } from "@/auth/server";

/**
 * Sets better-auth's own session cookie for `token`, signed the way its
 * `setSignedCookie` signs it, with its name and attributes. `cookies().set`
 * URL-encodes the value itself, so it isn't encoded here.
 */
export async function setSessionCookie(token: string): Promise<void> {
  const ctx = await auth.$context;
  const { name, attributes } = ctx.authCookies.sessionToken;
  const signature = await makeSignature(token, ctx.secret);
  (await cookies()).set(name, `${token}.${signature}`, {
    path: attributes.path,
    httpOnly: attributes.httpOnly,
    secure: attributes.secure,
    sameSite: attributes.sameSite?.toLowerCase() as
      "lax" | "strict" | "none" | undefined,
    maxAge: attributes.maxAge,
    domain: attributes.domain,
  });
}

/**
 * Clears better-auth's session cookie, with its own attributes: a
 * `__Secure-` cookie (https) is only replaced by a Set-Cookie that is itself
 * Secure.
 */
export async function clearSessionCookie(): Promise<void> {
  const { name, attributes } = (await auth.$context).authCookies.sessionToken;
  (await cookies()).delete({
    name,
    path: attributes.path,
    secure: attributes.secure,
    httpOnly: attributes.httpOnly,
    domain: attributes.domain,
  });
}
