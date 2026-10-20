import { requireModule } from "@/lib/auth/userModules";

// Outer gate for the Producer tree — same "any signed-in staff account"
// gate as Score Keeper/Commentator/Production Dashboard. The real "which
// events can this producer actually touch" check lives one level down, in
// producer/events/[eventId]/layout.tsx, via event_producer_assignments
// (0024_event_role_assignments.sql) — an admin can reach every event,
// everyone else only the ones they're assigned to produce.
//
// The OperatorShell is rendered one level down (the picker page and the
// event layout), because only the event layout knows the event name and
// tabs the top bar shows.
export default async function ProducerLayout({ children }: { children: React.ReactNode }) {
  await requireModule("producer");
  return children;
}
