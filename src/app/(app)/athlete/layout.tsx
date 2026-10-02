import { getAthleteSessionContext } from "@/lib/auth/session";
import { getUnreadCount } from "@/lib/db/messages";
import { AthleteShell } from "@/components/shells/AthleteShell";

/**
 * Shell for the athlete self-service portal — a separate identity space from
 * /admin (see 0010_athlete_open_log.sql). Deliberately does NOT redirect
 * unauthenticated visitors here: each page below does its own redirect check
 * (to /login) instead of a blanket one at the layout level.
 */
export default async function AthleteLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAthleteSessionContext();
  const unreadCount = ctx?.athleteId ? await getUnreadCount(ctx.userId) : 0;

  return (
    <AthleteShell signedIn={Boolean(ctx?.athleteId)} unreadCount={unreadCount} userId={ctx?.userId}>
      {children}
    </AthleteShell>
  );
}
