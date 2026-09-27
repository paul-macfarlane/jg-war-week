import { PageSkeleton, RowSkeleton } from "@/components/page-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Hero, Now/Next cards, then a few standings rows, in the same container
 * `(home)/page.tsx` uses (`md:py-8`, no `px-4 py-6`), so nothing jumps when
 * the real page replaces it.
 */
export default function Loading() {
  return (
    <PageSkeleton
      title={false}
      className="mx-auto flex max-w-md flex-col md:max-w-3xl md:py-8"
    >
      <Skeleton className="h-48 w-full md:h-72 md:rounded-lg" />
      <div className="flex flex-col gap-4 px-4 pt-4 pb-6">
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-24 rounded-lg" />
        </div>
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <RowSkeleton key={index} className="h-10" />
          ))}
        </div>
      </div>
    </PageSkeleton>
  );
}
