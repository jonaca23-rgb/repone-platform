import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Athletes sign in and sign up through the same screens as everyone else.
  // Query strings carry over by default.
  async redirects() {
    return [
      { source: "/athlete/login", destination: "/login", permanent: true },
      { source: "/athlete/signup", destination: "/signup", permanent: true },
    ];
  },
  experimental: {
    // Unmatched URLs get src/app/global-not-found.tsx: with three root layouts
    // there is no single layout for Next's default 404 to render in.
    globalNotFound: true,
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
