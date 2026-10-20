import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getAthleteSessionContext } from "@/lib/auth/session";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { NewAthleteForm } from "./NewAthleteForm";

export const metadata: Metadata = { title: "Add New Athlete" };

/**
 * Self-service "Add New Athlete" — adds a bare roster row (name + affiliate)
 * to the current athlete's own organization. Insert-only: this can never
 * edit or delete an existing athlete (see "athlete add org roster athlete",
 * 0017_athlete_likes_and_roster_add.sql). Doesn't link to that person's own
 * future signup — flagged to Jonathan as a possible follow-up.
 */

export default async function AddAthletePage() {
  const ctx = await getAthleteSessionContext();
  if (!ctx) redirect("/login");
  if (!ctx.athleteId) redirect("/");

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <PageHeader
        breadcrumb={
          <Button
            asChild
            variant="ghost"
            className="-ml-3 min-h-11 gap-2 self-start text-muted-foreground"
          >
            <Link href="/athlete/directory">
              <ChevronLeft aria-hidden />
              Athletes
            </Link>
          </Button>
        }
        title="Add New Athlete"
        description="Add someone to the roster. They can create their own RepOne account later — using this same email — to log in and manage their own profile. An email is required for every athlete, and the same email or phone can't be added twice."
      />

      <Card>
        <CardContent>
          <NewAthleteForm />
        </CardContent>
      </Card>
    </div>
  );
}
