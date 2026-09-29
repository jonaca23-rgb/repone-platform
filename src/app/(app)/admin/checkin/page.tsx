import Link from "next/link";
import { getSessionContext } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";

// Search-and-jump picker in front of /admin/checkin/[athleteId] — a
// volunteer without a QR code to scan (lost wristband, phone camera acting
// up) can find the athlete by name or box instead.
export default async function CheckInPickerPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const ctx = await getSessionContext();
  const supabase = await createClient();

  let athletesQuery = supabase
    .from("athletes")
    .select("id, first_name, last_name, affiliate, photo_url")
    .eq("organization_id", ctx?.organizationId ?? "")
    .order("last_name")
    .limit(50);

  if (query) {
    athletesQuery = athletesQuery.or(
      `first_name.ilike.%${query}%,last_name.ilike.%${query}%,affiliate.ilike.%${query}%`,
    );
  }

  const { data: athletes } = await athletesQuery;

  return (
    <div className="max-w-2xl">
      <h1 className="mb-2 text-2xl font-bold">Check-In</h1>
      <p className="mb-6 text-sm text-black/50">
        Scan an athlete&apos;s QR code from their profile, or find them here by name or box to see
        their green/red payment status at the registration desk.
      </p>

      <form className="mb-6 flex flex-wrap items-end gap-3">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          Search by name or box
          <input
            name="q"
            defaultValue={query}
            placeholder="e.g. Rivera or CrossFit San Juan"
            className="rounded-md border border-black/20 px-3 py-2"
          />
        </label>
        <button className="control-btn control-btn-red px-6 py-3 text-base">Search</button>
      </form>

      <div className="flex flex-col gap-2">
        {(athletes ?? []).map((a) => (
          <Link
            key={a.id}
            href={`/admin/checkin/${a.id}`}
            className="flex items-center gap-3 rounded-lg border border-black/10 px-4 py-3 hover:border-repone-red"
          >
            {a.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage URL, not a local/optimizable asset
              <img
                src={a.photo_url}
                alt=""
                className="h-9 w-9 shrink-0 rounded-full border border-black/10 object-cover object-top"
              />
            ) : (
              <div className="h-9 w-9 shrink-0 rounded-full border border-black/10 bg-black/5" />
            )}
            <span>
              <span className="font-semibold hover:text-repone-red">
                {a.first_name} {a.last_name}
              </span>
              {a.affiliate ? (
                <span className="ml-2 text-sm text-black/40">{a.affiliate}</span>
              ) : null}
            </span>
          </Link>
        ))}
        {athletes?.length === 0 && (
          <p className="text-black/50">
            {query ? `No athletes match "${query}".` : "No athletes yet."}
          </p>
        )}
      </div>
    </div>
  );
}
