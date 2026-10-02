import { Skeleton } from "@/components/ui/skeleton";

// Renders inside the athlete shell (the layout stays up while a page loads).
export default function AthleteLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-4 w-40" />
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ))}
    </div>
  );
}
