"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Users } from "lucide-react";
import type { DirectoryAthlete } from "@/lib/db/messages";
import { EmptyState } from "@/components/app/EmptyState";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Client-side search over the roster — the org's athlete list is small
 * enough (single-org deployment) to ship whole and filter in the browser
 * rather than round-tripping a query to the server on every keystroke.
 */
export function AthleteDirectoryList({ athletes }: { athletes: DirectoryAthlete[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return athletes;
    return athletes.filter((a) =>
      `${a.firstName} ${a.lastName} ${a.affiliate ?? ""}`.toLowerCase().includes(q),
    );
  }, [athletes, query]);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Label htmlFor="athlete-search" className="sr-only">
          Search athletes
        </Label>
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          id="athlete-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or affiliate…"
          autoComplete="off"
          className="h-11 pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={athletes.length === 0 ? "No other athletes yet" : "No athletes match your search"}
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((a) => (
            <li key={a.id}>
              <Link
                href={`/athlete/directory/${a.id}`}
                className="flex min-h-14 items-center gap-4 rounded-lg border border-border bg-card px-4 py-3 hover:border-brand-text/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
              >
                {a.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage URL, not a local/optimizable asset
                  <img
                    src={a.photoUrl}
                    alt=""
                    className="size-12 shrink-0 rounded-full object-cover object-top"
                  />
                ) : (
                  <div
                    aria-hidden
                    className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted font-semibold text-muted-foreground"
                  >
                    {a.firstName.charAt(0)}
                    {a.lastName.charAt(0)}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate font-semibold">
                    {a.firstName} {a.lastName}
                  </p>
                  {a.affiliate ? (
                    <p className="truncate text-sm text-muted-foreground">{a.affiliate}</p>
                  ) : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
