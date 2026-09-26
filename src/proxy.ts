import { type NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth/server";
import { canUseMcp, isJahnelGroupEmail, isPublicPath } from "@/lib/access";

/**
 * Every page and API route needs a Jahnel Group session. Pages redirect
 * anonymous visitors to `/sign-in` and come back afterwards; API routes
 * answer 401. `/api/mcp` also takes `Authorization: Bearer <MCP_TOKEN>`, so
 * MCP clients can connect.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();

  const session = await auth.api.getSession({ headers: request.headers });
  const hasSession = !!session && isJahnelGroupEmail(session.user.email);
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
