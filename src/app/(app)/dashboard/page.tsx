import Link from "next/link";
import { getSessionContext } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";

export default async function DashboardPickerPage() {
  const ctx = await getSessionContext();
  const supabase = await createClient();

  const { data: events } = await supabase
    .from("events")
    .select("id, name, status, venues(id, name, floors(id, name))")
    .eq("organization_id", ctx?.organizationId ?? "")
    .in("status", ["scheduled", "live"])
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-xl px-6 py-16">
      <h1 className="mb-6 font-[family-name:var(--font-display)] text-3xl font-bold uppercase tracking-wide">
        Select a Floor
      </h1>
      <div className="flex flex-col gap-4">
        {(events ?? []).flatMap((e) =>
          (e.venues ?? []).flatMap((v) =>
            (v.floors ?? []).map((f) => (
              <Link
                key={f.id}
                href={`/dashboard/${f.id}`}
                className="control-btn control-btn-red flex-col !items-start gap-1 py-6"
              >
                <span className="text-2xl">{e.name}</span>
                <span className="text-sm font-normal normal-case tracking-normal opacity-80">
                  {v.name} — {f.name}
                </span>
              </Link>
            ))
          )
        )}
        {(!events || events.length === 0) && (
          <p className="text-white/50">No scheduled or live events yet — set one up in Admin.</p>
        )}
      </div>
    </div>
  );
}
