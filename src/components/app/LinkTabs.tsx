"use client";

import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/**
 * Tabs whose state is the URL (?tab=), so a tab can be linked, shared and
 * gone back to. The page picks `current` with pickTab and renders only that
 * tab's content as children.
 */
export function LinkTabs({
  tabs,
  current,
  label,
  children,
}: {
  tabs: readonly { value: string; label: string }[];
  current: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Tabs value={current}>
      <TabsList
        aria-label={label}
        className="max-sm:w-full max-sm:justify-start max-sm:overflow-x-auto"
      >
        {tabs.map((t) => (
          <TabsTrigger key={t.value} value={t.value} asChild className="max-sm:min-h-11">
            <Link href={`?tab=${t.value}`} scroll={false}>
              {t.label}
            </Link>
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value={current} className="pt-4">
        {children}
      </TabsContent>
    </Tabs>
  );
}
