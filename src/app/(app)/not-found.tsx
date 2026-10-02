import Link from "next/link";
import { SearchX } from "lucide-react";
import { EmptyState } from "@/components/app/EmptyState";
import { Button } from "@/components/ui/button";

// The (app) body is still light until each area migrates, so this page brings
// its own dark surface.
export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <EmptyState
        icon={SearchX}
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
