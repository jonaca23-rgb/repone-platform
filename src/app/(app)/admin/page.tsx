import Link from "next/link";
import { getSessionContext } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { bootstrapOrganization } from "@/lib/actions/org";
import { createEvent, uploadEventCoverPhoto, removeEventCoverPhoto } from "@/lib/actions/events";
import { DeleteEventButton } from "@/app/(app)/admin/DeleteEventButton";

function formatDateRange(startsOn: string | null, endsOn: string | null) {
  if (!startsOn) return "Date TBD";
  const fmt = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  if (!endsOn || endsOn === startsOn) return fmt(startsOn);
  return `${fmt(startsOn)} — ${fmt(endsOn)}`;
}

export default async function AdminHomePage() {
  const ctx = await getSessionContext();

  if (!ctx?.organizationId) {
    return (
      <div className="mx-auto max-w-md">
        <h1 className="mb-2 text-2xl font-bold">Set up your organization</h1>
        <p className="mb-6 text-sm text-black/60">
          This is a one-time step for a brand new RepOne Platform account.
        </p>
        <form action={bootstrapOrganization} className="flex flex-col gap-3">
          <input
            name="name"
            required
            placeholder="Organization name (e.g. RepOneLive)"
            className="rounded-md border border-black/20 px-3 py-2"
          />
          <button className="control-btn control-btn-red w-fit px-6 py-3 text-base">
            Create Organization
          </button>
        </form>
      </div>
    );
  }

  const supabase = await createClient();
  const [{ data: events }, { data: circuits }] = await Promise.all([
    supabase
      .from("events")
      .select("id, name, status, starts_on, ends_on, circuit_id, cover_image_url")
      .eq("organization_id", ctx.organizationId)
      .order("created_at", { ascending: false }),
    supabase
      .from("circuits")
      .select("id, name")
      .eq("organization_id", ctx.organizationId)
      .order("name"),
  ]);

  const circuitById = new Map((circuits ?? []).map((c) => [c.id, c.name]));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Events</h1>
      </div>

      <form
        action={createEvent}
        className="mb-8 flex flex-wrap items-end gap-3 rounded-lg border border-black/10 p-4"
      >
        <label className="flex flex-col gap-1 text-sm">
          Event name
          <input
            name="name"
            required
            className="rounded-md border border-black/20 px-3 py-2"
            placeholder="Aprieta Entry Level"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Starts
          <input
            name="starts_on"
            type="date"
            className="rounded-md border border-black/20 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Ends
          <input
            name="ends_on"
            type="date"
            className="rounded-md border border-black/20 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Single Event or Circuit?
          <select
            name="circuit_choice"
            defaultValue=""
            className="rounded-md border border-black/20 px-3 py-2"
          >
            <option value="">Single Event (standalone)</option>
            <option value="new">Start a new circuit…</option>
            {(circuits ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                Add to circuit: {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          New circuit name
          <input
            name="new_circuit_name"
            placeholder="only if 'Start a new circuit' above"
            className="rounded-md border border-black/20 px-3 py-2"
          />
        </label>
        <button className="control-btn control-btn-red px-6 py-3 text-base">New Event</button>
      </form>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {(events ?? []).map((e) => (
          <div
            key={e.id}
            className="overflow-hidden rounded-lg border border-black/10 hover:border-repone-red"
          >
            <Link href={`/admin/events/${e.id}`} className="block">
              <div className="relative aspect-video w-full bg-repone-black">
                {e.cover_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage URL, not a local/optimizable asset
                  <img
                    src={e.cover_image_url}
                    alt={e.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <span className="px-4 text-center text-sm font-semibold uppercase tracking-wide text-white/30">
                      No Cover Photo
                    </span>
                  </div>
                )}
                <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                  {e.status}
                </span>
                {e.circuit_id && circuitById.has(e.circuit_id) && (
                  <span className="absolute right-2 top-2 rounded-full bg-repone-red px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                    {circuitById.get(e.circuit_id)}
                  </span>
                )}
              </div>
              <div className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-black/50">
                  {formatDateRange(e.starts_on, e.ends_on)}
                </p>
                <p className="mt-0.5 text-lg font-bold">{e.name}</p>
              </div>
            </Link>

            <div className="flex items-center justify-between gap-2 border-t border-black/5 px-4 py-2.5">
              <details className="text-sm">
                <summary className="cursor-pointer font-semibold text-repone-red">
                  {e.cover_image_url ? "Change Photo" : "Upload Photo"}
                </summary>
                <form
                  action={uploadEventCoverPhoto.bind(null, e.id)}
                  className="mt-2 flex flex-wrap items-center gap-2"
                >
                  <input
                    type="file"
                    name="cover_photo"
                    accept="image/*"
                    required
                    className="max-w-[180px] text-xs"
                  />
                  <button className="control-btn control-btn-red px-3 py-1.5 text-xs">Save</button>
                </form>
                {e.cover_image_url && (
                  <form action={removeEventCoverPhoto.bind(null, e.id)} className="mt-2">
                    <button className="text-xs text-black/40 hover:text-repone-red">
                      Remove photo
                    </button>
                  </form>
                )}
              </details>
              <DeleteEventButton eventId={e.id} eventName={e.name} />
            </div>
          </div>
        ))}
        {events?.length === 0 && <p className="text-black/50">No events yet — create one above.</p>}
      </div>

      <p className="mt-8 text-sm text-black/50">
        Running a season across multiple events?{" "}
        <Link href="/admin/circuits" className="text-repone-red hover:underline">
          Manage circuits and cross-event standings →
        </Link>
      </p>
    </div>
  );
}
