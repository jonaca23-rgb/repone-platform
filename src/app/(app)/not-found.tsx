import Link from "next/link";
import { SearchX } from "lucide-react";
import { EmptyState } from "@/components/app/EmptyState";
import { Button } from "@/components/ui/button";

// Also rendered by src/app/global-not-found.tsx for URLs that match no route.
export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <EmptyState
        icon={SearchX}
        titleAs="h1"
        title="Page not found"
        description="It may have moved or you may not have access."
        action={
          <Button asChild>
            <Link href="/">Home</Link>
          </Button>
        }
      />
    </main>
  );
}
