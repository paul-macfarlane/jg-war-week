import { PageSkeleton, RowSkeleton } from "@/components/page-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

/** Matches `/history`'s wider container and card grid. */
export default function Loading() {
  return (
    <PageSkeleton
      title={false}
      className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-6 md:max-w-5xl md:py-10"
    >
      <Skeleton className="h-9 w-64" />
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <RowSkeleton key={index} className="h-32" />
        ))}
      </div>
    </PageSkeleton>
  );
}
