import { getSessionContext } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { createSponsor, toggleSponsorActive } from "@/lib/actions/sponsors";
import type { SponsorTier } from "@/lib/db/database.types";

const TIER_LABELS: Record<SponsorTier, string> = {
  logo_sponsor: "Logo Sponsor — $50/event",
  brand_mention: "Brand Mention — $75/event",
  commercial_30: "Commercial 30 — $90 (3x :30)",
  commercial_30_plus: "Commercial 30 Plus — $150 (6x :30)",
  wod_sponsor: "WOD Sponsor — $200",
  presenting_sponsor: "Presenting Sponsor — $450",
};

export default async function SponsorsPage() {
  const ctx = await getSessionContext();
  const supabase = await createClient();
  const [{ data: sponsors }, { data: events }] = await Promise.all([
    supabase
      .from("sponsors")
      .select("id, business_name, tier, category, category_exclusive, active, event_id")
      .eq("organization_id", ctx?.organizationId ?? "")
      .order("created_at", { ascending: false }),
    supabase.from("events").select("id, name").eq("organization_id", ctx?.organizationId ?? ""),
  ]);

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold">Sponsors</h1>
      <p className="mb-6 text-sm text-black/50">
        Current RepOneLive inventory tiers are pre-loaded below. Category-exclusive sponsors (e.g.
        &quot;Official Physical Therapy Partner&quot;) are enforced at the database level per event.
      </p>

      <form action={createSponsor} className="mb-8 grid grid-cols-2 gap-3 rounded-lg border border-black/10 p-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">
          Business name
          <input name="business_name" required className="rounded-md border border-black/20 px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Tier
          <select name="tier" className="rounded-md border border-black/20 px-3 py-2">
            {Object.entries(TIER_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Event
          <select name="event_id" className="rounded-md border border-black/20 px-3 py-2">
            <option value="">— all events —</option>
            {(events ?? []).map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Category
          <input name="category" placeholder="Physical Therapy" className="rounded-md border border-black/20 px-3 py-2" />
        </label>
        <label className="flex items-center gap-2 self-end text-sm">
          <input name="category_exclusive" type="checkbox" />
          Category exclusive
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Website
          <input name="website" className="rounded-md border border-black/20 px-3 py-2" />
        </label>
        <button className="control-btn control-btn-red col-span-2 w-fit px-6 py-3 text-base sm:col-span-3">
          Add Sponsor
        </button>
      </form>

      <div className="flex flex-col gap-2">
        {(sponsors ?? []).map((s) => (
          <div key={s.id} className="flex items-center justify-between rounded-lg border border-black/10 px-4 py-3">
            <div>
              <p className="font-semibold">
                {s.business_name}
                {s.category_exclusive ? (
                  <span className="ml-2 rounded-full bg-repone-red/10 px-2 py-0.5 text-xs font-bold uppercase text-repone-red">
                    Exclusive · {s.category}
                  </span>
                ) : null}
              </p>
              <p className="text-xs uppercase tracking-wide text-black/50">{TIER_LABELS[s.tier as SponsorTier]}</p>
            </div>
            <form action={toggleSponsorActive.bind(null, s.id, !s.active)}>
              <button
                className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${
                  s.active ? "bg-black/5 text-black/60" : "bg-repone-red/10 text-repone-red"
                }`}
              >
                {s.active ? "Active" : "Inactive"}
              </button>
            </form>
          </div>
        ))}
        {sponsors?.length === 0 && <p className="text-black/50">No sponsors yet.</p>}
      </div>
    </div>
  );
}
