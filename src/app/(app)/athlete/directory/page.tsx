import Link from "next/link";
import { redirect } from "next/navigation";
import { getAthleteSessionContext } from "@/lib/auth/session";
import { getAthleteDirectory } from "@/lib/db/messages";
import { AthleteDirectoryList } from "@/components/AthleteDirectoryList";

/**
 * Athletes section — three entry points Jonathan asked for: add a new
 * athlete to the roster, search/browse everyone else (their lift info and
 * WOD position history live one click away, on each profile), and jump to
 * messages. Basic roster info (name, affiliate, photo) is shown right here;
 * personal details like date of birth are never shown.
 */
export default async function AthleteDirectoryPage() {
  const ctx = await getAthleteSessionContext();
  if (!ctx) redirect("/athlete/login");
  if (!ctx.athleteId) redirect("/athlete/onboarding");

  const athletes = await getAthleteDirectory(ctx.organizationId ?? "", ctx.athleteId);

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-white">Athletes</h1>
      <p className="mb-6 max-w-xl text-sm text-white/60">Everyone else competing with RepOne Platform.</p>

      <div className="mb-6 flex flex-wrap gap-3">
        <Link href="/athlete/directory/new" className="control-btn control-btn-red px-5 py-2.5 text-sm">
          + Add New Athlete
        </Link>
        <Link href="/athlete/messages" className="control-btn px-5 py-2.5 text-sm">
          Messages
        </Link>
      </div>

      <AthleteDirectoryList athletes={athletes} />
    </div>
  );
}
