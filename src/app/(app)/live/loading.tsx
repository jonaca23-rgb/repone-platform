import { Skeleton } from "@/components/ui/skeleton";

// Renders inside the public shell (the layout stays up while a page loads).
export default function LiveLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-48" />
      </div>
      {[0, 1].map((i) => (
        <div key={i} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-24 w-full" />
        </div>
      ))}
    </div>
  );
}
