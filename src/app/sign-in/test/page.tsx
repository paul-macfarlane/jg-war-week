import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { TestSignInForm } from "@/components/test-sign-in-form";
import { safeCallbackPath } from "@/lib/access";
import { firstParam } from "@/lib/search-params";
import { testSignInEnabled } from "@/lib/test-sign-in";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Test sign-in · JG War Week" };

/**
 * Test sign-in: sign in as any @jahnelgroup.com address (`+` aliases too)
 * without Google, to test as a Participant, Host or Organizer. Not found
 * whenever Test sign-in is off, which it always is on Vercel Production.
 */
export default async function TestSignInPage({
  searchParams,
}: PageProps<"/sign-in/test">) {
  if (!testSignInEnabled(process.env)) notFound();
  const params = await searchParams;
  const callbackURL = safeCallbackPath(firstParam(params.callbackURL));

  return (
    <main className="bg-background text-foreground flex min-h-dvh flex-col items-center justify-center px-4 py-10 font-sans">
      <div className="border-border flex w-full max-w-md flex-col gap-6 rounded-2xl border p-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-semibold">Test sign-in</h1>
          <p className="text-foreground/70 text-sm">
            Sign in as any @jahnelgroup.com address, + aliases included, without
            Google. Local and staging only.
          </p>
        </div>
        <TestSignInForm callbackURL={callbackURL} />
      </div>
    </main>
  );
}
