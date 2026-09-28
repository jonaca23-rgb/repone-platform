import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Turbopack's dev filesystem cache (on by default since Next 16.1,
    // writes to .next/dev/cache/turbopack as a small embedded database —
    // see node_modules/next/dist/docs/.../turbopackFileSystemCache.md)
    // keeps colliding with OneDrive's Files On-Demand sync on Jonathan's
    // machine, since the project folder lives under OneDrive\Documents.
    // OneDrive intercepting writes to that live database is what's been
    // producing both yesterday's Turbopack chunk-map panic ("os error 380")
    // and today's "Failed to open database / invalid digit found in
    // string" on startup. Disabling it trades away warm dev-server
    // restarts for a working dev server — worth re-enabling (or just
    // deleting this block) once the project is moved out of OneDrive
    // entirely, which is the real fix for the underlying conflict.
    turbopackFileSystemCacheForDev: false,
    serverActions: {
      // Next.js defaults Server Action request bodies to 1MB, which is well
      // under the app's own 8MB image-upload cap (athlete photos, event
      // cover photos — both go through Server Actions, not a separate
      // upload API route) — a typical phone photo alone can exceed 1MB, so
      // every upload was hitting Next's limit before ever reaching our own
      // validation. 10mb leaves headroom above the 8MB cap for the
      // multipart/form-data boundary/header overhead the docs mention.
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
