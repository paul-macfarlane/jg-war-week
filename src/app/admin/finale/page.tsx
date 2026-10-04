import { Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AdminRefused, AdminShell } from "@/components/admin-shell";
import { FinaleSlidesEditor } from "@/components/finale-slides-editor";
import { buttonVariants } from "@/components/ui/button";
import { sanitizeContent } from "@/lib/rich-text/content";
import { themeSwatches } from "@/lib/theme";
import { getFinaleSlides } from "@/queries/finale-slides";

import { loadAdminPage } from "../gate";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Finale · JG War Week",
};

/**
 * The Organizer's way into the Finale, its slide list (order and hidden
 * slides; Organizers change it, Hosts see it).
 */
export default async function AdminFinalePage() {
  const { warWeek, email, allowed, isOrganizer, editions } =
    await loadAdminPage("/admin/finale", "organizers");
  if (!allowed) return <AdminRefused warWeek={warWeek} email={email} />;

  const edition = warWeek.edition;
  const slides = await getFinaleSlides(warWeek.id);

  return (
    <AdminShell
      warWeek={warWeek}
      email={email}
      isOrganizer={isOrganizer}
      editions={editions}
      current="Finale"
    >
      <div className="flex max-w-2xl flex-col gap-4">
        <h1 className="text-2xl font-bold">Finale</h1>
        <p className="text-foreground/70">
          The Finale is the closing-ceremony slideshow. Open it on the projector
          and step through its slides: → or Space shows the next one, ← goes
          back, Escape returns to the first. Nothing moves on by itself. The
          Standings countdown slide counts the Standings in from last place to
          first as you arrive on it; it plays the same Standings as the{" "}
          <Link
            href={`/${edition}/leaderboard`}
            className="text-primary underline underline-offset-4"
          >
            leaderboard
          </Link>{" "}
          and never changes them. Anyone signed in can watch it at{" "}
          <code>/{edition}/finale</code>.
        </p>
        <div>
          <Link
            href={`/${edition}/finale`}
            className={buttonVariants({ size: "lg" })}
          >
            <Sparkles aria-hidden />
            Open Finale
          </Link>
        </div>
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Slides</h2>
          <p className="text-foreground/70 text-sm">
            {isOrganizer
              ? "The Finale plays these in order. Drag a slide, or use its arrows, to move it; hide a slide to skip it. Each change saves at once."
              : "The Finale plays these in order. Only an Organizer can change them."}
          </p>
          <FinaleSlidesEditor
            warWeekId={warWeek.id}
            slides={slides.map(
              ({ key, id, kind, name, hidden, body, backgroundColor }) => {
                // Sanitized on write; again here so the editor only gets
                // the closed set.
                const sanitized = sanitizeContent(body);
                return {
                  key,
                  id,
                  kind,
                  name,
                  hidden,
                  body: sanitized.ok ? sanitized.content : null,
                  backgroundColor,
                };
              },
            )}
            canEdit={isOrganizer}
            themeSwatches={themeSwatches(warWeek)}
          />
        </section>
      </div>
    </AdminShell>
  );
}
