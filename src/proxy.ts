import { type NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth/server";
import { canUseMcp, isPublicPath } from "@/lib/access";
import { sessionIdentity } from "@/lib/test-sign-in";

/**
 * Every page and API route needs a Jahnel Group session. Pages redirect
 * anonymous visitors to `/sign-in` and come back afterwards; API routes
 * answer 401. `/api/mcp` also takes `Authorization: Bearer <MCP_TOKEN>`, so
 * MCP clients can connect.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();

  // The same rule as `getSessionIdentity`: a Test sign-in session counts as
  // anonymous (no page, no API, no MCP) once Test sign-in is off.
  const session = await auth.api.getSession({ headers: request.headers });
  const hasSession =
    sessionIdentity(
      session && {
        email: session.user.email,
        sessionId: session.session.id,
        testSignIn: session.session.testSignIn === true,
      },
      process.env,
    ) !== null;
  if (hasSession) return NextResponse.next();

  if (pathname === "/api/mcp") {
    const allowed = canUseMcp({
      hasSession,
      authorization: request.headers.get("authorization"),
      mcpToken: process.env.MCP_TOKEN,
    });
    if (allowed) return NextResponse.next();
    return NextResponse.json(
      {
        error:
          "Sign in with a @jahnelgroup.com account or send Authorization: Bearer <MCP_TOKEN>.",
      },
      { status: 401 },
    );
  }

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
