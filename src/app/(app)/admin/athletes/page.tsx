import type { Metadata } from "next";
import { getSessionContext } from "@/lib/auth/session";
import { getAthletePrivateDetails } from "@/lib/db/athletePrivate";
import { createClient } from "@/lib/db/server";
import { computeAgeCategory, type Gender } from "@/lib/scoring/ageCategory";
import { PageHeader } from "@/components/app/PageHeader";
import { type AthleteRow, AthletesTable } from "./AthletesTable";

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

  const rows: AthleteRow[] = (athletes ?? []).map((a) => ({
    id: a.id,
    name: `${a.first_name} ${a.last_name}`,
    affiliate: a.affiliate,
    gender: (a.gender as Gender | null) ?? null,
    ageCategory:
      computeAgeCategory(
        privateDetails.get(a.id)?.dateOfBirth,
        a.gender as Gender | null,
        new Date(),
      ) ?? null,
    photoUrl: a.photo_url,
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Athletes"
        description="Your organization's athlete pool. Register them into a division per event from that event's Athletes page. Open an athlete to add their lifts and benchmark times."
      />
      <AthletesTable rows={rows} />
    </div>
  );
}
