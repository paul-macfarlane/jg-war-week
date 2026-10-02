import { APIError, betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { headers } from "next/headers";
import { cache } from "react";

import { trustedOrigins } from "@/auth/trusted-origins";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { JG_EMAIL_DOMAIN, isJahnelGroupEmail } from "@/lib/access";
import { type SessionIdentity, sessionIdentity } from "@/lib/test-sign-in";

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

/** Google is the only sign-in method; without credentials there is none. */
export const isGoogleConfigured = Boolean(googleClientId && googleClientSecret);

function rejectNonJahnelGroup(email: string | null | undefined) {
  if (!isJahnelGroupEmail(email)) {
    // The `code` makes better-auth's OAuth callback redirect to
    // `/sign-in?error=...` instead of answering with a bare 403.
    throw new APIError("FORBIDDEN", {
      code: "NOT_JAHNEL_GROUP",
      message: `Only @${JG_EMAIL_DOMAIN} accounts can sign in.`,
    });
  }
}

export const auth = betterAuth({
  trustedOrigins: trustedOrigins({
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    VERCEL_URL: process.env.VERCEL_URL,
    VERCEL_BRANCH_URL: process.env.VERCEL_BRANCH_URL,
    VERCEL_ENV: process.env.VERCEL_ENV,
  }),
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  session: {
    additionalFields: {
      // Set only by Test sign-in; never from a request body.
      testSignIn: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false,
      },
    },
  },
  // No self-service profile edits: otherwise any signed-in user could set
  // their own `user.name` or `user.image` to anything.
  disabledPaths: ["/update-user"],
  socialProviders: isGoogleConfigured
    ? {
        google: {
          clientId: googleClientId!,
          clientSecret: googleClientSecret!,
          // Sent to Google as the hosted-domain hint and checked against the
          // verified `hd` claim of the returned id token.
          hd: JG_EMAIL_DOMAIN,
          prompt: "select_account",
        },
      }
    : {},
  // The app's own domain rule, independent of Google's consent screen: no
  // user row (and so no session) is ever written for a non-JG email.
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          rejectNonJahnelGroup(user.email);
        },
      },
      update: {
        before: async (user) => {
          if (user.email !== undefined) rejectNonJahnelGroup(user.email);
        },
      },
    },
  },
});

/**
 * Who is signed in for this request, or `null` when anonymous. A session
 * counts as anonymous when its email isn't a Jahnel Group email, or when it
 * is a Test sign-in session and Test sign-in is off (`sessionIdentity`).
 */
export const getSessionIdentity = cache(
  async (): Promise<SessionIdentity | null> => {
    const session = await auth.api.getSession({ headers: await headers() });
    return sessionIdentity(
      session && {
        email: session.user.email,
        sessionId: session.session.id,
        testSignIn: session.session.testSignIn === true,
      },
      process.env,
    );
  },
);

/** The signed-in user's email for this request, or `null` when anonymous. */
export const getSessionEmail = cache(
  async (): Promise<string | null> =>
    (await getSessionIdentity())?.email ?? null,
);
