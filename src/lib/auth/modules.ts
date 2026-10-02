import {
  assignmentsOpening,
  roleCan,
  STAFF_PERMISSION,
  type EventStaffKind,
  type OrgRole,
  type Permissions,
} from "./permissions";

export type ModuleKind = "admin" | "producer" | "scorekeeper" | "commentator" | "athlete";
export interface Module { kind: ModuleKind; href: string; label: string; detail: string }
export interface ModuleFacts {
  orgName: string | null;
  orgRoles: OrgRole[];
  assignments: Record<EventStaffKind, string[]>;
  athleteName: string | null;
}

/**
 * Each staff module and the permission that opens it (spec §4): org-wide
 * through an org role, or per event through any assignment whose event role
 * holds that permission (a producer assignment opens Scorekeeper and
 * Commentator as well as Production).
 */
const STAFF: Array<{ kind: Exclude<ModuleKind, "athlete">; href: string; label: string; opens: Permissions; staff?: EventStaffKind }> = [
  { kind: "admin", href: "/admin", label: "Admin", opens: { event: ["update"] } },
  { kind: "producer", href: "/producer", label: "Production", opens: STAFF_PERMISSION.producer, staff: "producer" },
  { kind: "scorekeeper", href: "/scorekeeper", label: "Scorekeeper", opens: STAFF_PERMISSION.scorekeeper, staff: "scorekeeper" },
  { kind: "commentator", href: "/commentator", label: "Commentator", opens: STAFF_PERMISSION.commentator, staff: "commentator" },
];

/** The modules a person can open, from plain facts (userModules gathers them). */
export function modulesFor(f: ModuleFacts): Module[] {
  const out: Module[] = [];
  for (const m of STAFF) {
    const events = m.staff
      ? [...new Set(assignmentsOpening(m.staff).flatMap((k) => f.assignments[k]))]
      : [];
    if (roleCan(f.orgRoles, m.opens)) {
      out.push({ kind: m.kind, href: m.href, label: m.label, detail: f.orgName ?? "" });
    } else if (events.length) {
      out.push({ kind: m.kind, href: m.href, label: m.label, detail: events.join(", ") });
    }
  }
  if (f.athleteName) out.push({ kind: "athlete", href: "/athlete", label: "Athlete", detail: f.athleteName });
  return out;
}

export type Home = { redirect: string } | { start: { modules: Module[]; offerAthleteProfile: boolean } };

/** Where `/` sends a signed-in person (spec §4, resolveHome table). */
export function resolveHome(modules: Module[]): Home {
  if (modules.length === 1 && modules[0].kind === "athlete") return { redirect: "/athlete" };
  return { start: { modules, offerAthleteProfile: !modules.some((m) => m.kind === "athlete") } };
}
