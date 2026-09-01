import Link from "next/link";
import { createClient } from "@/lib/db/server";
import { getSessionContext } from "@/lib/auth/session";
import { registerAthlete, removeRegistration } from "@/lib/actions/registrations";

export default async function EventAthletesPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const ctx = await getSessionContext();
  const supabase = await createClient();

  const [{ data: divisions }, { data: athletes }, { data: registrations }] = await Promise.all([
    supabase.from("divisions").select("id, name").eq("event_id", eventId).order("sort_order"),
    supabase
      .from("athletes")
      .select("id, first_name, last_name, affiliate")
      .eq("organization_id", ctx?.organizationId ?? "")
      .order("last_name"),
    supabase
      .from("registrations")
      .select("id, bib_number, division_id, athletes(first_name, last_name, affiliate)")
      .eq("event_id", eventId),
  ]);

  // See lib/db/queries.ts header comment: our untyped Supabase client can't
  // infer that a many-to-one embed comes back as one object, not an array.
  const typedRegistrations = (registrations ?? []) as unknown as Array<{
    id: string;
    bib_number: string | null;
    division_id: string;
    athletes: { first_name: string; last_name: string; affiliate: string | null } | null;
  }>;

  if (!divisions?.length) {
    return (
      <div>
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
      <h1 className="mb-2 text-2xl font-bold">Athletes & Registrations</h1>
      <p className="mb-6 text-sm text-black/50">
        Athletes are managed once at the org level (<Link href="/admin/athletes" className="text-repone-red underline">Athletes</Link>)
        and registered per event into a division here.
      </p>

      <form action={registerAthlete.bind(null, eventId)} className="mb-8 flex flex-wrap items-end gap-3 rounded-lg border border-black/10 p-4">
        <label className="flex flex-col gap-1 text-sm">
          Athlete
          <select name="athlete_id" required className="rounded-md border border-black/20 px-3 py-2">
            {(athletes ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.first_name} {a.last_name} {a.affiliate ? `(${a.affiliate})` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Division
          <select name="division_id" required className="rounded-md border border-black/20 px-3 py-2">
            {divisions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Bib #
          <input name="bib_number" className="w-24 rounded-md border border-black/20 px-3 py-2" />
        </label>
        <button className="control-btn control-btn-red px-6 py-3 text-base">Register</button>
      </form>

      <div className="flex flex-col gap-6">
        {divisions.map((d) => (
          <div key={d.id}>
            <p className="mb-2 font-semibold uppercase tracking-wide text-black/60">{d.name}</p>
            <div className="flex flex-col gap-2">
              {typedRegistrations
                .filter((r) => r.division_id === d.id)
                .map((r) => (
                  <div key={r.id} className="flex items-center justify-between rounded-lg border border-black/10 px-4 py-2">
                    <span>
                      {r.athletes?.first_name} {r.athletes?.last_name}{" "}
                      {r.athletes?.affiliate ? <span className="text-black/40">— {r.athletes.affiliate}</span> : null}
                      {r.bib_number ? <span className="ml-2 text-xs text-black/40">#{r.bib_number}</span> : null}
                    </span>
                    <form action={removeRegistration.bind(null, eventId, r.id)}>
                      <button className="text-sm text-black/40 hover:text-repone-red">Remove</button>
                    </form>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
