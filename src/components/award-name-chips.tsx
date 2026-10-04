import Link from "next/link";

/**
 * Award names as links to their history (`/history/awards/<slug>`), one chip
 * per name, wrapping. Shared by the History page and the Awards index.
 */
export function AwardNameChips({
  names,
  label,
}: {
  names: { slug: string; name: string }[];
  label?: string;
}) {
  return (
    <ul aria-label={label} className="flex flex-wrap gap-2">
      {names.map((awardName) => (
        <li key={awardName.slug}>
          <Link
            href={`/history/awards/${awardName.slug}`}
            className="border-border hover:bg-muted inline-flex min-h-11 items-center rounded-md border px-3 text-sm font-medium sm:min-h-9"
          >
            {awardName.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}
