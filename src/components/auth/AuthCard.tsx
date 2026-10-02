import type { ReactNode } from "react";

/** The card every auth screen sits in: logo, a title line, an optional notice, then the form. */
export function AuthCard({
  title,
  notice,
  children,
}: {
  title: string;
  notice?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-repone-black px-4">
      <div className="w-full max-w-sm rounded-xl border border-white/10 bg-repone-gray p-8 shadow-xl">
        {/* eslint-disable-next-line @next/next/no-img-element -- local static asset in public/, not optimizable-domain content */}
        <img
          src="/repone-logo.png"
          alt="RepOne"
          className="mb-3 h-10 w-auto"
          width={472}
          height={240}
        />
        <h1 className="mb-6 text-sm text-white/60">{title}</h1>
        {notice ? (
          <p className="mb-4 rounded-md border border-white/20 bg-white/5 p-3 text-sm text-white/80">
            {notice}
          </p>
        ) : null}
        {children}
      </div>
    </div>
  );
}
