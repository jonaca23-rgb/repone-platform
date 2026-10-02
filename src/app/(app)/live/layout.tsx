import { PublicShell } from "@/components/shells/PublicShell";

// Deliberately NO auth check here (unlike admin/dashboard/scorekeeper's
// layouts) — this is the public, unauthenticated leaderboard area: athletes
// and spectators reach it with no account, same as the OBS overlay routes.
// Every table it reads already has a "public read" RLS policy (see
// getEventLiveContext's header comment), so no schema change was needed.
export default function LiveLayout({ children }: { children: React.ReactNode }) {
  return <PublicShell>{children}</PublicShell>;
}
