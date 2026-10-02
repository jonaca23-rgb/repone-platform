import Link from "next/link";
import { redirect } from "next/navigation";
import { getAthleteSessionContext } from "@/lib/auth/session";
import { createAthleteFromPortal } from "@/lib/actions/social";

/**
 * Self-service "Add New Athlete" — adds a bare roster row (name + affiliate)
 * to the current athlete's own organization. Insert-only: this can never
 * edit or delete an existing athlete (see "athlete add org roster athlete",
 * 0017_athlete_likes_and_roster_add.sql). Doesn't link to that person's own
 * future signup — flagged to Jonathan as a possible follow-up.
 */
export default async function AddAthletePage() {
  const ctx = await getAthleteSessionContext();
  if (!ctx) redirect("/login");
  if (!ctx.athleteId) redirect("/");

  return (
    <div className="mx-auto max-w-md">
      <p className="mb-4 text-sm">
        <Link href="/athlete/directory" className="text-repone-red underline">
          ← Athletes
        </Link>
      </p>

      <h1 className="mb-1 text-2xl font-bold text-white">Add New Athlete</h1>
      <p className="mb-6 text-sm text-white/60">
        Add someone to the roster. They can create their own RepOne account later — using this same
        email — to log in and manage their own profile. An email is required for every athlete, and
        the same email or phone can&apos;t be added twice.
      </p>

      <form
        action={createAthleteFromPortal}
        className="flex flex-col gap-4 rounded-lg border border-white/10 bg-repone-gray p-5"
      >
        <label className="flex flex-col gap-1 text-sm text-white/70">
          First name
          <input
            name="first_name"
            required
            className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-white focus:border-repone-red/50 focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-white/70">
          Last name
          <input
            name="last_name"
            required
            className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-white focus:border-repone-red/50 focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-white/70">
          Affiliate / gym (optional)
          <input
            name="affiliate"
            className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-white focus:border-repone-red/50 focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-white/70">
          Email
          <input
            type="email"
            name="email"
            required
            className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-white focus:border-repone-red/50 focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-white/70">
          Phone (optional)
          <input
            type="tel"
            name="phone"
            className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-white focus:border-repone-red/50 focus:outline-none"
          />
        </label>
        <button type="submit" className="control-btn control-btn-red mt-2 py-2.5 text-sm">
          Add Athlete
        </button>
      </form>
    </div>
  );
}
