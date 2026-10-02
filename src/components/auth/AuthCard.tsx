import Image from "next/image";
import type { ReactNode } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

/** The card every auth screen sits in: logo, a title, an optional notice, then the form. */
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
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-sm shadow-xl">
        <CardHeader className="gap-3">
          <Image
            src="/repone-logo.png"
            alt="RepOne"
            width={472}
            height={240}
            priority
            className="h-10 w-auto"
          />
          <h1 className="font-display text-2xl font-bold tracking-wide uppercase">{title}</h1>
        </CardHeader>
        <CardContent className="gap-0">
          {notice ? (
            <p
              role="status"
              className="mb-4 rounded-md border border-success/40 bg-success/10 p-3 text-sm text-success-text"
            >
              {notice}
            </p>
          ) : null}
          {children}
        </CardContent>
      </Card>
    </div>
  );
}
