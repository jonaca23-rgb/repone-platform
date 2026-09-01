import Link from "next/link";
import { getSessionContext } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { bootstrapOrganization } from "@/lib/actions/org";
import { createEvent } from "@/lib/actions/events";

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
  const { data: events } = await supabase
    .from("events")
    .select("id, name, status, starts_on, ends_on")
    .eq("organization_id", ctx.organizationId)
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Events</h1>
      </div>

      <form action={createEvent} className="mb-8 flex flex-wrap items-end gap-3 rounded-lg border border-black/10 p-4">
        <label className="flex flex-col gap-1 text-sm">
          Event name
          <input name="name" required className="rounded-md border border-black/20 px-3 py-2" placeholder="Aprieta Entry Level" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Starts
          <input name="starts_on" type="date" className="rounded-md border border-black/20 px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Ends
          <input name="ends_on" type="date" className="rounded-md border border-black/20 px-3 py-2" />
        </label>
        <button className="control-btn control-btn-red px-6 py-3 text-base">New Event</button>
      </form>

      <div className="flex flex-col gap-2">
        {(events ?? []).map((e) => (
          <Link
            key={e.id}
            href={`/admin/events/${e.id}`}
            className="flex items-center justify-between rounded-lg border border-black/10 px-4 py-3 hover:border-repone-red"
          >
            <span className="font-semibold">{e.name}</span>
            <span className="text-xs uppercase tracking-wide text-black/50">{e.status}</span>
          </Link>
        ))}
        {events?.length === 0 && <p className="text-black/50">No events yet — create one above.</p>}
      </div>
    </div>
  );
}
