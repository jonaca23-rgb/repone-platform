import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { UserPlus } from "lucide-react";
import { getAthleteSessionContext } from "@/lib/auth/session";
import { getAthleteDirectory } from "@/lib/db/messages";
import { AthleteDirectoryList } from "@/components/AthleteDirectoryList";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Athletes" };

/**
 * Athletes section — add a new athlete to the roster and search/browse
 * everyone else (their lift info and WOD position history live one click
 * away, on each profile). Messages is a tab of its own. Basic roster info
 * (name, affiliate, photo) is shown right here; personal details like date
 * of birth are never shown.
 */
export default async function AthleteDirectoryPage() {
  const ctx = await getAthleteSessionContext();
  if (!ctx) redirect("/login");
  if (!ctx.athleteId) redirect("/");

  const athletes = await getAthleteDirectory(ctx.organizationId ?? "", ctx.athleteId);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Athletes"
        description="Everyone else competing with RepOne Platform."
        actions={
          <Button asChild className="min-h-11 gap-2">
            <Link href="/athlete/directory/new">
              <UserPlus aria-hidden />
              Add New Athlete
            </Link>
          </Button>
        }
      />
      <AthleteDirectoryList athletes={athletes} />
    </div>
  );
}
