"use client";

import { useEffect } from "react";
import Link from "next/link";

// Any unexpected error on a staff, athlete or public page. Keeps the operator
// on a page with a way forward instead of Next's bare error screen; `retry`
// re-fetches the segment, which is usually all a dropped connection needs.
export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="max-w-md text-black/60">
        This page couldn&apos;t load or finish that action. Nothing else was changed. Try again; if
        it keeps happening, check the connection.
      </p>
      {error.digest && <p className="text-xs text-black/40">Reference: {error.digest}</p>}
      <div className="flex gap-3">
        <button className="control-btn control-btn-red px-6" onClick={() => retry()}>
          Try again
        </button>
        <Link href="/" className="control-btn px-6">
          Home
        </Link>
      </div>
    </main>
  );
}
