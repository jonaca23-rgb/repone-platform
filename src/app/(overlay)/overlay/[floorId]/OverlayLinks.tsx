"use client";

import { useState } from "react";

export interface OverlaySource {
  slug: string;
  name: string;
  description: string;
}

/** One row per browser source: what it is, its full URL, Copy and Preview. */
export function OverlayLinks({
  origin,
  floorId,
  sources,
}: {
  origin: string;
  floorId: string;
  sources: OverlaySource[];
}) {
  const [copied, setCopied] = useState<string | null>(null);
  return (
    <ul className="flex flex-col gap-3">
      {sources.map((s) => {
        const url = `${origin}/overlay/${floorId}/${s.slug}`;
        return (
          <li
            key={s.slug}
            className="flex flex-wrap items-center gap-3 rounded bg-broadcast-fg/5 px-4 py-3"
          >
            <div className="min-w-0 flex-1">
              <p className="font-display text-lg font-bold uppercase tracking-wide">{s.name}</p>
              <p className="text-sm text-broadcast-fg/70">{s.description}</p>
              <p className="mt-1 font-mono text-xs break-all text-broadcast-fg/70">{url}</p>
            </div>
            <button
              type="button"
              className="min-h-11 rounded bg-broadcast-accent px-4 text-sm font-bold uppercase tracking-wide text-broadcast-fg"
              onClick={async () => {
                await navigator.clipboard.writeText(url);
                setCopied(s.slug);
                setTimeout(() => setCopied((c) => (c === s.slug ? null : c)), 2000);
              }}
            >
              {copied === s.slug ? "Copied" : "Copy URL"}
            </button>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center rounded border border-broadcast-fg/30 px-4 text-sm font-bold uppercase tracking-wide"
            >
              Preview<span className="sr-only"> {s.name} (opens in a new tab)</span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
