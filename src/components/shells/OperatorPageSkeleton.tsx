import { Skeleton } from "@/components/ui/skeleton";

/**
 * The loading placeholder for an operator page. `withBar` adds the top bar's
 * outline for a segment that renders before the shell does.
 */
export function OperatorPageSkeleton({ withBar = false }: { withBar?: boolean }) {
  const page = (
    <div
      className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-6"
      role="status"
      aria-busy="true"
      aria-label="Loading"
    >
      <Skeleton className="h-9 w-64" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
  if (!withBar) return page;
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex h-14 items-center gap-3 border-b border-border bg-card px-4">
        <Skeleton className="h-6 w-12" />
        <Skeleton className="h-4 w-20" />
      </div>
      {page}
    </div>
  );
}
