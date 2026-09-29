"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { DirectoryAthlete } from "@/lib/db/messages";

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
    <div>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search athletes by name or affiliate…"
        className="mb-4 w-full rounded-lg border border-white/10 bg-repone-gray px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-repone-red/50 focus:outline-none"
      />

      <div className="flex flex-col gap-2">
        {filtered.map((a) => (
          <Link
            key={a.id}
            href={`/athlete/directory/${a.id}`}
            className="flex items-center gap-4 rounded-lg border border-white/10 bg-repone-gray px-4 py-3 hover:border-repone-red/40"
          >
            {a.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage URL, not a local/optimizable asset
              <img
                src={a.photoUrl}
                alt=""
                className="h-12 w-12 rounded-full object-cover object-top"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/40 text-xs text-white/40">
                No photo
              </div>
            )}
            <div>
              <p className="font-semibold text-white">
                {a.firstName} {a.lastName}
              </p>
              {a.affiliate ? <p className="text-sm text-white/50">{a.affiliate}</p> : null}
            </div>
          </Link>
        ))}
        {filtered.length === 0 && (
          <p className="text-white/50">
            {athletes.length === 0 ? "No other athletes yet." : "No athletes match your search."}
          </p>
        )}
      </div>
    </div>
  );
}
