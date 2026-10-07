import { type NextRequest, NextResponse } from "next/server";

import { auth, identityFromSession } from "@/auth/server";
import { isPublicPath } from "@/lib/access";

/**
 * Every page and API route needs a Jahnel Group session. Pages redirect
 * anonymous visitors to `/sign-in` and come back afterwards; API routes
 * answer 401.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();

  // The same rule as `getSessionIdentity`: a Test sign-in session counts as
  // anonymous (no page, no API) once Test sign-in is off.
  const hasSession =
    identityFromSession(
      await auth.api.getSession({ headers: request.headers }),
    ) !== null;
  if (hasSession) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Sign in with a @jahnelgroup.com account." },
      { status: 401 },
    );
  }

  const signIn = new URL("/sign-in", request.url);
  signIn.searchParams.set("callbackURL", `${pathname}${search}`);
  return NextResponse.redirect(signIn);
}

export const config = {
  // Skip Next's build assets and public files: any path with an extension.
  // No route has one today; a future one (e.g. `/xi/export.csv`) would need
  // this matcher narrowed.
  matcher: ["/((?!_next/static|_next/image|.*\\.[a-zA-Z0-9]+$).*)"],
};
