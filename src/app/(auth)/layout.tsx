import type { Metadata } from "next";
import "../globals.css";
import { fontVariables } from "../fonts";

export const metadata: Metadata = {
  title: "RepOne",
};

// A separate root layout (like (overlay)) so the sign-in screens share one dark
// shell for everyone, whatever module they end up in. No next/font/google, same
// reason as (app)/layout.tsx.
export default function AuthRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full antialiased ${fontVariables}`}>
      <body className="min-h-full bg-repone-black">{children}</body>
    </html>
  );
}
