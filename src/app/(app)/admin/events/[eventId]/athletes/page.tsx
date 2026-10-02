import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { getAthletePrivateDetails } from "@/lib/db/athletePrivate";
import { createClient } from "@/lib/db/server";
import { getSessionContext } from "@/lib/auth/session";
import { removeRegistration } from "@/lib/actions/registrations";
import { AGE_CATEGORY_LABELS, computeAgeCategory, type Gender } from "@/lib/scoring/ageCategory";
import { ConfirmAction } from "@/components/app/ConfirmAction";
import { EmptyState } from "@/components/app/EmptyState";
import { PageHeader } from "@/components/app/PageHeader";
import { AdminBreadcrumb, eventCrumbs } from "@/components/shells/AdminBreadcrumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getAdminEvent, requireAdminEvent } from "../adminEvent";
import { RegisterForms } from "./RegisterForms";

type Props = { params: Promise<{ eventId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const event = await getAdminEvent((await params).eventId);
  return { title: event ? `Athletes · ${event.name}` : "Athletes" };
}

export default async function EventAthletesPage({ params }: Props) {
  const { eventId } = await params;
  const ctx = await getSessionContext();
  const supabase = await createClient();
  const cookieStore = await cookies();
  const lastDivisionId = cookieStore.get(`repone_last_division_${eventId}`)?.value ?? "";

  const [
    adminEvent,
    { data: divisions },
    { data: athletes },
    { data: teams },
    { data: registrations },
  ] = await Promise.all([
    requireAdminEvent(eventId),
    supabase.from("divisions").select("id, name").eq("event_id", eventId).order("sort_order"),
    supabase
      .from("athletes")
      .select("id, first_name, last_name, affiliate, gender")
      .eq("organization_id", ctx?.organizationId ?? "")
      .order("last_name"),
    supabase
      .from("teams")
      .select("id, name, affiliate, entry_format")
      .eq("organization_id", ctx?.organizationId ?? "")
      .order("name"),
    supabase
      .from("registrations")
      .select(
        "id, bib_number, division_id, athlete_id, athletes(first_name, last_name, affiliate, gender), teams(name, affiliate, entry_format)",
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
    teams: { name: string; affiliate: string | null; entry_format: string } | null;
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

  return (
    <div className="flex flex-col gap-6">
      {header}
      <p className="-mt-3 max-w-prose text-muted-foreground">
        Athletes are managed once at the organization level (
        <Link href="/admin/athletes" className="text-brand-text underline">
          Athletes
        </Link>
        ) and registered per event into a division here. Pairs, teams and custom-format entries come
        from{" "}
        <Link href="/admin/teams" className="text-brand-text underline">
          Teams
        </Link>
        . Set registration fees on{" "}
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

      <RegisterForms
        eventId={eventId}
        athletes={athletes ?? []}
        teams={teams ?? []}
        divisions={divisions}
        lastDivisionId={lastDivisionId}
      />

      <div className="flex flex-col gap-6">
        {divisions.map((d) => {
          const inDivision = typedRegistrations.filter((r) => r.division_id === d.id);
          return (
            <div key={d.id}>
              <h2 className="mb-2 font-semibold uppercase tracking-wide text-muted-foreground">
                {d.name}
              </h2>
              <div className="flex flex-col gap-2">
                {inDivision.map((r) => {
                  const category = r.athletes
                    ? computeAgeCategory(
                        privateDetails.get(r.athlete_id ?? "")?.dateOfBirth,
                        r.athletes.gender,
                        categoryAsOf,
                      )
                    : null;
                  const name = r.athletes
                    ? `${r.athletes.first_name} ${r.athletes.last_name}`
                    : (r.teams?.name ?? "This entry");
                  return (
                    <div
                      key={r.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-4 py-2"
                    >
                      <span className="flex flex-wrap items-center gap-x-2">
                        {r.athletes ? (
                          <>
                            {name}
                            {r.athletes.affiliate ? (
                              <span className="text-muted-foreground">
                                — {r.athletes.affiliate}
                              </span>
                            ) : null}
                          </>
                        ) : (
                          <>
                            {r.teams?.name}
                            <Badge variant="secondary" className="uppercase">
                              {r.teams?.entry_format}
                            </Badge>
                            {r.teams?.affiliate ? (
                              <span className="text-muted-foreground">— {r.teams.affiliate}</span>
                            ) : null}
                          </>
                        )}
                        {r.bib_number ? (
                          <span className="text-xs text-muted-foreground">#{r.bib_number}</span>
                        ) : null}
                        {category ? (
                          <span className="text-xs font-semibold uppercase tracking-wide text-brand-text">
                            {AGE_CATEGORY_LABELS[category]}
                          </span>
                        ) : null}
                      </span>
                      <ConfirmAction
                        trigger="Remove"
                        title={`Remove ${name} from ${d.name}?`}
                        description="Their registration for this event and its payment record are deleted. They stay on your roster and can be registered again."
                        confirmLabel="Remove registration"
                        onConfirm={removeRegistration.bind(null, eventId, r.id)}
                      />
                    </div>
                  );
                })}
                {inDivision.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No registrations in this division yet.
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
