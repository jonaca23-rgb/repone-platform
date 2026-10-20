import { requireModule } from "@/lib/auth/userModules";

// Outer gate for the Score Keeper tree. The per-event assignment checks live
// on the event and floor pages.
//
// The OperatorShell is rendered one level down (the picker, the event's floor
// picker and the scoring screen), because only those pages know the event
// name the top bar shows.
export default async function ScoreKeeperLayout({ children }: { children: React.ReactNode }) {
  await requireModule("scorekeeper");
  return children;
}
