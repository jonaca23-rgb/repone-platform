import { requireModule } from "@/lib/auth/userModules";

// Same "any signed-in staff account" gate as Score Keeper/Production
// Dashboard (see lib/auth/session.ts) — this outer layer just confirms
// someone is signed in as staff at all. The real "which events can this
// commentator actually see" check lives one level down, in
// commentator/events/[eventId]/layout.tsx, via the event-scoped assignment
// tables (0024_event_role_assignments.sql) — an admin can reach every event,
// everyone else only the ones they're assigned to.
//
// The OperatorShell is rendered one level down (the picker page, the event
// layout and the floor page), because only those know the event name and
// tabs the top bar shows.
export default async function CommentatorLayout({ children }: { children: React.ReactNode }) {
  await requireModule("commentator");
  return children;
}
