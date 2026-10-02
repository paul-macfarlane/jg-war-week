/** The eyebrow over a slide's heading: "War Week XI · The Matrix". */
export function SlideEyebrow({
  edition,
  storyTheme,
}: {
  edition: string;
  storyTheme: string;
}) {
  return (
    <p className="text-primary-text text-[clamp(0.75rem,1.4vw,1.25rem)] font-semibold tracking-[0.25em] uppercase">
      War Week {edition.toUpperCase()} · {storyTheme}
    </p>
  );
}
