import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getAthleteSessionContext } from "@/lib/auth/session";
import { createAthleteFromPortal } from "@/lib/actions/social";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
          <form action={createAthleteFromPortal} className="flex flex-col gap-4">
            <div className="grid gap-2">
              <Label htmlFor="new-first-name">First name</Label>
              <Input
                id="new-first-name"
                name="first_name"
                required
                autoComplete="off"
                className="h-11"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-last-name">Last name</Label>
              <Input
                id="new-last-name"
                name="last_name"
                required
                autoComplete="off"
                className="h-11"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-affiliate">Affiliate / gym (optional)</Label>
              <Input id="new-affiliate" name="affiliate" autoComplete="off" className="h-11" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-email">Email</Label>
              <Input
                id="new-email"
                type="email"
                name="email"
                required
                autoComplete="off"
                className="h-11"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-phone">Phone (optional)</Label>
              <Input id="new-phone" type="tel" name="phone" autoComplete="off" className="h-11" />
            </div>
            <Button type="submit" size="touch" className="mt-2 w-full">
              Add Athlete
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
