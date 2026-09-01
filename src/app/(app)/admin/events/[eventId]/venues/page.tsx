import { createClient } from "@/lib/db/server";
import { addFloor } from "@/lib/actions/venues";

export default async function VenuesPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const supabase = await createClient();
  const { data: venues } = await supabase
    .from("venues")
    .select("id, name, floors(id, name, sort_order)")
    .eq("event_id", eventId);

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold">Venues & Floors</h1>
      <p className="mb-6 text-sm text-black/50">
        Every event gets a default venue and Floor A automatically. Add more floors here to run
        simultaneous competition floors/platforms.
      </p>

      <div className="flex flex-col gap-6">
        {(venues ?? []).map((v) => (
          <div key={v.id} className="rounded-lg border border-black/10 p-4">
            <p className="mb-3 font-semibold">{v.name}</p>
            <div className="mb-4 flex flex-wrap gap-2">
              {(v.floors ?? [])
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((f) => (
                  <span key={f.id} className="rounded-full bg-repone-black px-4 py-1.5 text-sm font-semibold text-white">
                    {f.name}
                  </span>
                ))}
            </div>
            <form action={addFloor.bind(null, eventId, v.id)} className="flex items-end gap-3">
              <label className="flex flex-col gap-1 text-sm">
                New floor name
                <input name="name" required placeholder="Floor B" className="rounded-md border border-black/20 px-3 py-2" />
              </label>
              <button className="control-btn control-btn-outline px-5 py-2.5 text-sm">Add Floor</button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}
