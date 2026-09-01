import { getSessionContext } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { createAthlete, deleteAthlete } from "@/lib/actions/athletes";

export default async function AthletesPage() {
  const ctx = await getSessionContext();
  const supabase = await createClient();
  const { data: athletes } = await supabase
    .from("athletes")
    .select("id, first_name, last_name, affiliate")
    .eq("organization_id", ctx?.organizationId ?? "")
    .order("last_name");

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold">Athlete Roster</h1>
      <p className="mb-6 text-sm text-black/50">
        Your organization&apos;s athlete pool — register them into a division per event from that event&apos;s
        Athletes page.
      </p>

      <form action={createAthlete} className="mb-8 flex flex-wrap items-end gap-3 rounded-lg border border-black/10 p-4">
        <label className="flex flex-col gap-1 text-sm">
          First name
          <input name="first_name" required className="rounded-md border border-black/20 px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Last name
          <input name="last_name" required className="rounded-md border border-black/20 px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Box / affiliate
          <input name="affiliate" className="rounded-md border border-black/20 px-3 py-2" />
        </label>
        <button className="control-btn control-btn-red px-6 py-3 text-base">Add Athlete</button>
      </form>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {(athletes ?? []).map((a) => (
          <div key={a.id} className="flex items-center justify-between rounded-lg border border-black/10 px-4 py-3">
            <span>
              <span className="font-semibold">
                {a.first_name} {a.last_name}
              </span>
              {a.affiliate ? <span className="ml-2 text-sm text-black/40">{a.affiliate}</span> : null}
            </span>
            <form action={deleteAthlete.bind(null, a.id)}>
              <button className="text-sm text-black/40 hover:text-repone-red">Remove</button>
            </form>
          </div>
        ))}
        {athletes?.length === 0 && <p className="text-black/50">No athletes yet.</p>}
      </div>
    </div>
  );
}
