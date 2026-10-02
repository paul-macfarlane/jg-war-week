import { getSessionIdentity } from "@/auth/server";

/**
 * A strip above every page while signed in through Test sign-in, so a
 * maintainer always knows they aren't on their own account. Root tokens,
 * not the War Week's Appearance Theme: it reads the same on every page.
 */
export async function SessionBanner() {
  const identity = await getSessionIdentity();
  if (!identity?.testSignIn) return null;
  return (
    <div
      role="status"
      className="bg-muted text-muted-foreground border-border border-b px-4 py-1.5 text-center text-xs font-medium"
    >
      Test sign-in: {identity.email}
    </div>
  );
}
