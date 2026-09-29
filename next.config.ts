import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
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
