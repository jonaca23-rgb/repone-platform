import localFont from "next/font/local";

// Bundled and served from our own origin: no font CDN at build or runtime
// (broadcast reliability). Barlow Condensed for display and numbers, Inter for text.
export const barlow = localFont({
  src: [
    { path: "../fonts/barlow-condensed-latin-600-normal.woff2", weight: "600" },
    { path: "../fonts/barlow-condensed-latin-700-normal.woff2", weight: "700" },
  ],
  variable: "--font-barlow",
  display: "swap",
});

export const inter = localFont({
  src: "../fonts/inter-latin-wght-normal.woff2",
  variable: "--font-inter",
  display: "swap",
});

export const fontVariables = `${barlow.variable} ${inter.variable}`;
