"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * The recovery screen for an unexpected error: what happened, a retry and a
 * way home. `as="main"` (default) fills the page on its own; `as="div"` sits
 * inside a shell that already has the page's <main>.
 */
export function ErrorScreen({
  error,
  retry,
  as: Landmark = "main",
}: {
  error: Error & { digest?: string };
  retry: () => void;
  as?: "main" | "div";
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Landmark
      className={`flex flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground ${
        Landmark === "main" ? "min-h-screen" : "py-16"
      }`}
    >
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="max-w-md text-muted-foreground">
        This page couldn&apos;t load or finish that action. Nothing else was changed. Try again; if
        it keeps happening, check the connection.
      </p>
      {error.digest && <p className="text-xs text-muted-foreground">Reference: {error.digest}</p>}
      <div className="flex gap-3">
        <Button onClick={() => retry()}>Try again</Button>
        <Button asChild variant="outline">
          <Link href="/">Home</Link>
        </Button>
      </div>
    </Landmark>
  );
}
