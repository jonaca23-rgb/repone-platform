import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { getAthletePrivateDetails } from "@/lib/db/athletePrivate";
import { createClient } from "@/lib/db/server";
import { requireOrgManager } from "@/lib/auth/guards";
import { computeAgeCategory, type Gender } from "@/lib/scoring/ageCategory";
import { EmptyState } from "@/components/app/EmptyState";
import { PageHeader } from "@/components/app/PageHeader";
import { AdminBreadcrumb, eventCrumbs } from "@/components/shells/AdminBreadcrumb";
import { Button } from "@/components/ui/button";
import { getAdminEvent, requireAdminEvent } from "../adminEvent";
import { type RegistrationRow, RegistrationsTable } from "./RegistrationsTable";

type Props = { params: Promise<{ eventId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const event = await getAdminEvent((await params).eventId);
  return { title: event ? `Athletes · ${event.name}` : "Athletes" };
}

export default async function EventAthletesPage({ params }: Props) {
  const { eventId } = await params;
  const { organizationId } = await requireOrgManager();
  const supabase = await createClient();
  const cookieStore = await cookies();
  const lastDivisionId = cookieStore.get(`repone_last_division_${eventId}`)?.value ?? "";

  const [adminEvent, { data: divisions }, { data: athletes }, { data: registrations }] =
    await Promise.all([
      requireAdminEvent(eventId),
      supabase
        .from("divisions")
        .select("id, name, entry_format")
        .eq("event_id", eventId)
        .order("sort_order"),
      supabase
        .from("athletes")
        .select("id, first_name, last_name, affiliate, gender")
        .eq("organization_id", organizationId)
        .order("last_name"),
      supabase
        .from("registrations")
        .select(
          "id, bib_number, division_id, athlete_id, athletes(first_name, last_name, affiliate, gender), teams(name, affiliate)",
        )
        .eq("event_id", eventId),
    ]);

  // Category is computed as of the event's date, per RepOne's masters rules —
  // falls back to today only if the event has no start date set yet.
  const categoryAsOf = adminEvent.starts_on ?? new Date();

  // See lib/db/queries.ts header comment: our untyped Supabase client can't
  // infer that a many-to-one embed comes back as one object, not an array.
  const typedRegistrations = (registrations ?? []) as unknown as Array<{
    id: string;
    bib_number: string | null;
    division_id: string;
    athlete_id: string | null;
    athletes: {
      first_name: string;
      last_name: string;
      affiliate: string | null;
      gender: Gender | null;
    } | null;
    teams: { name: string; affiliate: string | null } | null;
  }>;
  const privateDetails = await getAthletePrivateDetails(
    supabase,
    typedRegistrations.flatMap((r) => (r.athlete_id ? [r.athlete_id] : [])),
  );

  const header = (
    <PageHeader
      title="Athletes & registrations"
      breadcrumb={<AdminBreadcrumb items={eventCrumbs(adminEvent, { label: "Athletes" })} />}
    />
  );

  if (!divisions?.length) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <EmptyState
          title="No divisions yet"
          description="Create at least one division before registering athletes."
          action={
            <Button asChild variant="outline">
              <Link href={`/admin/events/${eventId}/divisions`}>Go to Divisions</Link>
            </Button>
          }
        />
      </div>
    );
  }

  // Athletes register on their own only in individual divisions (0036).
  const individual = divisions.filter((d) => d.entry_format === "individual");
  const divisionOrder = new Map(divisions.map((d, i) => [d.id, i]));
  const divisionName = new Map(divisions.map((d) => [d.id, d.name]));
  const rows: RegistrationRow[] = typedRegistrations
    .map((r) => ({
      id: r.id,
      name: r.athletes
        ? `${r.athletes.first_name} ${r.athletes.last_name}`
        : `Team · ${r.teams?.name ?? "Unknown team"}`,
      affiliate: r.athletes ? r.athletes.affiliate : (r.teams?.affiliate ?? null),
      type: r.athletes ? ("individual" as const) : ("team" as const),
      divisionId: r.division_id,
      divisionName: divisionName.get(r.division_id) ?? "—",
      bib: r.bib_number,
      ageCategory: r.athletes
        ? (computeAgeCategory(
            privateDetails.get(r.athlete_id ?? "")?.dateOfBirth,
            r.athletes.gender,
            categoryAsOf,
          ) ?? null)
        : null,
    }))
    // Division order first, then name: how the desk reads the field.
    .sort(
      (x, y) =>
        (divisionOrder.get(x.divisionId) ?? 0) - (divisionOrder.get(y.divisionId) ?? 0) ||
        x.name.localeCompare(y.name),
    );

  return (
    <div className="flex flex-col gap-6">
      {header}
      <p className="-mt-3 max-w-prose text-muted-foreground">
        Athletes are managed once at the organization level (
        <Link href="/admin/athletes" className="text-brand-text underline">
          Athletes
        </Link>
        ) and registered per event into an individual division here. Pairs and teams are created on
        this event&apos;s{" "}
        <Link href={`/admin/events/${eventId}/teams`} className="text-brand-text underline">
          Teams
        </Link>{" "}
        page, which registers them. Set registration fees on{" "}
        <Link href={`/admin/events/${eventId}/fees`} className="text-brand-text underline">
          Fees
        </Link>{" "}
        and track who&apos;s paid on{" "}
        <Link href={`/admin/events/${eventId}/payments`} className="text-brand-text underline">
          Payments
        </Link>
        . Once everyone&apos;s registered, build heats and assign lanes on{" "}
        <Link href={`/admin/events/${eventId}/heats`} className="text-brand-text underline">
          Heats
        </Link>
        .
      </p>

      <RegistrationsTable
        eventId={eventId}
        rows={rows}
        divisions={divisions.map((d) => ({ id: d.id, label: d.name }))}
        athletes={(athletes ?? []).map((a) => ({
          id: a.id,
          label: `${a.first_name} ${a.last_name}${a.affiliate ? ` (${a.affiliate})` : ""}`,
        }))}
        individualDivisions={individual.map((d) => ({ id: d.id, label: d.name }))}
        defaultDivisionId={
          individual.some((d) => d.id === lastDivisionId)
            ? lastDivisionId
            : (individual[0]?.id ?? "")
        }
      />
    </div>
  );
}
