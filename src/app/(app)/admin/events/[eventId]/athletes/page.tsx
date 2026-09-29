import Link from "next/link";
import { cookies } from "next/headers";
import { getAthletePrivateDetails } from "@/lib/db/athletePrivate";
import { createClient } from "@/lib/db/server";
import { getSessionContext } from "@/lib/auth/session";
import { removeRegistration } from "@/lib/actions/registrations";
import { AGE_CATEGORY_LABELS, computeAgeCategory, type Gender } from "@/lib/scoring/ageCategory";
import { RegisterForms } from "./RegisterForms";

export default async function EventAthletesPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const ctx = await getSessionContext();
  const supabase = await createClient();
  const cookieStore = await cookies();
  const lastDivisionId = cookieStore.get(`repone_last_division_${eventId}`)?.value ?? "";

  const [
    { data: event },
    { data: divisions },
    { data: athletes },
    { data: teams },
    { data: registrations },
  ] = await Promise.all([
    supabase.from("events").select("name, starts_on").eq("id", eventId).maybeSingle(),
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
  const categoryAsOf = event?.starts_on ?? new Date();

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

  if (!divisions?.length) {
    return (
      <div>
        <p className="mb-4 text-sm">
          <Link href={`/admin/events/${eventId}`} className="text-repone-red underline">
            ← {event?.name ?? "Back to Event"}
          </Link>
        </p>
        <h1 className="mb-4 text-2xl font-bold">Athletes & Registrations</h1>
        <p className="text-black/50">
          Create at least one division first —{" "}
          <Link href={`/admin/events/${eventId}/divisions`} className="text-repone-red underline">
            go to Divisions
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-4 text-sm">
        <Link href={`/admin/events/${eventId}`} className="text-repone-red underline">
          ← {event?.name ?? "Back to Event"}
        </Link>
      </p>
      <h1 className="mb-2 text-2xl font-bold">Athletes & Registrations</h1>
      <p className="mb-6 text-sm text-black/50">
        Athletes are managed once at the org level (
        <Link href="/admin/athletes" className="text-repone-red underline">
          Athletes
        </Link>
        ) and registered per event into a division here. Pairs/teams/custom-format entries come from{" "}
        <Link href="/admin/teams" className="text-repone-red underline">
          Teams
        </Link>{" "}
        — a competitor entry can be an individual athlete or a team of any size. Set registration
        fees on the{" "}
        <Link href={`/admin/events/${eventId}/fees`} className="text-repone-red underline">
          Fees
        </Link>{" "}
        page and track who&apos;s paid on{" "}
        <Link href={`/admin/events/${eventId}/payments`} className="text-repone-red underline">
          Payments
        </Link>
        . Once everyone&apos;s registered, head to{" "}
        <Link href={`/admin/events/${eventId}/heats`} className="text-repone-red underline">
          Heats &amp; Lanes
        </Link>{" "}
        to build heats and assign lanes.
      </p>

      <RegisterForms
        eventId={eventId}
        athletes={athletes ?? []}
        teams={teams ?? []}
        divisions={divisions}
        lastDivisionId={lastDivisionId}
      />

      <div className="flex flex-col gap-6">
        {divisions.map((d) => (
          <div key={d.id}>
            <p className="mb-2 font-semibold uppercase tracking-wide text-black/60">{d.name}</p>
            <div className="flex flex-col gap-2">
              {typedRegistrations
                .filter((r) => r.division_id === d.id)
                .map((r) => {
                  const category = r.athletes
                    ? computeAgeCategory(
                        privateDetails.get(r.athlete_id ?? "")?.dateOfBirth,
                        r.athletes.gender,
                        categoryAsOf,
                      )
                    : null;
                  return (
                    <div
                      key={r.id}
                      className="flex items-center justify-between rounded-lg border border-black/10 px-4 py-2"
                    >
                      <span>
                        {r.athletes ? (
                          <>
                            {r.athletes.first_name} {r.athletes.last_name}{" "}
                            {r.athletes.affiliate ? (
                              <span className="text-black/40">— {r.athletes.affiliate}</span>
                            ) : null}
                          </>
                        ) : (
                          <>
                            {r.teams?.name}{" "}
                            <span className="ml-1 rounded-full bg-black/5 px-2 py-0.5 text-xs font-bold uppercase text-black/50">
                              {r.teams?.entry_format}
                            </span>
                            {r.teams?.affiliate ? (
                              <span className="text-black/40"> — {r.teams.affiliate}</span>
                            ) : null}
                          </>
                        )}
                        {r.bib_number ? (
                          <span className="ml-2 text-xs text-black/40">#{r.bib_number}</span>
                        ) : null}
                        {category ? (
                          <span className="ml-2 text-xs font-semibold uppercase tracking-wide text-repone-red">
                            {AGE_CATEGORY_LABELS[category]}
                          </span>
                        ) : null}
                      </span>
                      <form action={removeRegistration.bind(null, eventId, r.id)}>
                        <button className="text-sm text-black/40 hover:text-repone-red">
                          Remove
                        </button>
                      </form>
                    </div>
                  );
                })}
              {typedRegistrations.filter((r) => r.division_id === d.id).length === 0 && (
                <p className="text-sm text-black/40">No registrations in this division yet.</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
