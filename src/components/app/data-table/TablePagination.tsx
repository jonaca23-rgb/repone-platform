import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/** The result count, and Previous/Next when there is more than one page. */
export function TablePagination({
  total,
  page,
  pageCount,
  onPrevious,
  onNext,
}: {
  total: number;
  page: number;
  pageCount: number;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm text-muted-foreground tabular-nums">
        {total === 1 ? "1 result" : `${total} results`}
      </p>
      {pageCount > 1 ? (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onPrevious} disabled={page <= 1}>
            <ChevronLeft aria-hidden /> Previous
          </Button>
          <span className="text-sm tabular-nums text-muted-foreground">
            {page} / {pageCount}
          </span>
          <Button variant="outline" size="sm" onClick={onNext} disabled={page >= pageCount}>
            Next <ChevronRight aria-hidden />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
