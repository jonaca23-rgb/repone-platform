import Link from "next/link";
import { getSessionContext } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { createAthlete, deleteAthlete } from "@/lib/actions/athletes";
import { AGE_CATEGORY_LABELS, computeAgeCategory } from "@/lib/scoring/ageCategory";
import type { Gender } from "@/lib/scoring/ageCategory";

export default async function AthletesPage() {
  const ctx = await getSessionContext();
  const supabase = await createClient();
  const { data: athletes } = await supabase
    .from("athletes")
    .select("id, first_name, last_name, affiliate, date_of_birth, gender, photo_url")
    .eq("organization_id", ctx?.organizationId ?? "")
    .order("last_name");

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold">Athlete Roster</h1>
      <p className="mb-6 text-sm text-black/50">
        Your organization&apos;s athlete pool — register them into a division per event from that event&apos;s
        Athletes page. Open an athlete to add their lifts and benchmark times.
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
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input type="email" name="email" required className="rounded-md border border-black/20 px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Phone
          <input type="tel" name="phone" placeholder="Optional" className="rounded-md border border-black/20 px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Date of birth
          <input type="date" name="date_of_birth" className="rounded-md border border-black/20 px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Gender
          <select name="gender" defaultValue="" className="rounded-md border border-black/20 px-3 py-2">
            <option value="">—</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </label>
        <button className="control-btn control-btn-red px-6 py-3 text-base">Add Athlete</button>
      </form>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {(athletes ?? []).map((a) => {
          const category = computeAgeCategory(a.date_of_birth, a.gender as Gender | null, new Date());
          return (
            <div key={a.id} className="flex items-center justify-between rounded-lg border border-black/10 px-4 py-3">
              <Link href={`/admin/athletes/${a.id}`} className="flex flex-1 items-center gap-3">
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
                  {a.affiliate ? <span className="ml-2 text-sm text-black/40">{a.affiliate}</span> : null}
                  {category ? (
                    <span className="ml-2 text-xs font-semibold uppercase tracking-wide text-repone-red">
                      {AGE_CATEGORY_LABELS[category]}
                    </span>
                  ) : null}
                </span>
              </Link>
              <form action={deleteAthlete.bind(null, a.id)}>
                <button className="text-sm text-black/40 hover:text-repone-red">Remove</button>
              </form>
            </div>
          );
        })}
        {athletes?.length === 0 && <p className="text-black/50">No athletes yet.</p>}
      </div>
    </div>
  );
}
