import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";
import { getSessionContext } from "@/lib/auth/session";
import { getAthletePrivateDetails } from "@/lib/db/athletePrivate";
import { createClient } from "@/lib/db/server";
import { createAthlete, deleteAthlete } from "@/lib/actions/athletes";
import { AGE_CATEGORY_LABELS, computeAgeCategory } from "@/lib/scoring/ageCategory";
import type { Gender } from "@/lib/scoring/ageCategory";
import { ConfirmAction } from "@/components/app/ConfirmAction";
import { EmptyState } from "@/components/app/EmptyState";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NONE } from "@/lib/validation/none";

export const metadata: Metadata = { title: "Athletes" };

export default async function AthletesPage() {
  const ctx = await getSessionContext();
  const supabase = await createClient();
  const { data: athletes } = await supabase
    .from("athletes")
    .select("id, first_name, last_name, affiliate, gender, photo_url")
    .eq("organization_id", ctx?.organizationId ?? "")
    .order("last_name");
  const privateDetails = await getAthletePrivateDetails(
    supabase,
    (athletes ?? []).map((a) => a.id),
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Athletes"
        description="Your organization's athlete pool. Register them into a division per event from that event's Athletes page. Open an athlete to add their lifts and benchmark times."
      />

      <Card>
        <CardContent>
          <form action={createAthlete} className="flex flex-wrap items-end gap-3">
            <div className="grid gap-2">
              <Label htmlFor="athlete-first">First name</Label>
              <Input id="athlete-first" name="first_name" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="athlete-last">Last name</Label>
              <Input id="athlete-last" name="last_name" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="athlete-affiliate">Box / affiliate</Label>
              <Input id="athlete-affiliate" name="affiliate" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="athlete-email">Email</Label>
              <Input id="athlete-email" type="email" name="email" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="athlete-phone">Phone</Label>
              <Input id="athlete-phone" type="tel" name="phone" placeholder="Optional" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="athlete-dob">Date of birth</Label>
              <Input id="athlete-dob" type="date" name="date_of_birth" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="athlete-gender">Gender</Label>
              <Select name="gender" defaultValue={NONE}>
                <SelectTrigger id="athlete-gender" className="min-w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Not set</SelectItem>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit">Add athlete</Button>
          </form>
        </CardContent>
      </Card>

      {athletes?.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No athletes yet"
          description="Add your first athlete with the form above."
        />
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {(athletes ?? []).map((a) => {
            const name = `${a.first_name} ${a.last_name}`;
            const category = computeAgeCategory(
              privateDetails.get(a.id)?.dateOfBirth,
              a.gender as Gender | null,
              new Date(),
            );
            return (
              <div
                key={a.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-4 py-3"
              >
                <Link href={`/admin/athletes/${a.id}`} className="flex flex-1 items-center gap-3">
                  {a.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage URL, not a local/optimizable asset
                    <img
                      src={a.photo_url}
                      alt=""
                      className="h-9 w-9 shrink-0 rounded-full border border-border object-cover object-top"
                    />
                  ) : (
                    <div className="h-9 w-9 shrink-0 rounded-full border border-border bg-muted" />
                  )}
                  <span>
                    <span className="font-semibold hover:text-brand-text">{name}</span>
                    {a.affiliate ? (
                      <span className="ml-2 text-sm text-muted-foreground">{a.affiliate}</span>
                    ) : null}
                    {category ? (
                      <span className="ml-2 text-xs font-semibold uppercase tracking-wide text-brand-text">
                        {AGE_CATEGORY_LABELS[category]}
                      </span>
                    ) : null}
                  </span>
                </Link>
                <ConfirmAction
                  trigger="Remove"
                  title={`Remove ${name}?`}
                  description="This deletes the athlete from your roster, with their lifts, benchmarks, registrations and results. This cannot be undone."
                  confirmLabel="Remove athlete"
                  onConfirm={deleteAthlete.bind(null, a.id)}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
