import { roleCan, type OrgRole, type Permissions } from "./permissions";

export type ModuleKind = "admin" | "producer" | "scorekeeper" | "commentator" | "athlete";
export interface Module { kind: ModuleKind; href: string; label: string; detail: string }
export interface ModuleFacts {
  orgName: string | null;
  orgRoles: OrgRole[];
  assignments: Record<"scorekeeper" | "producer" | "commentator", string[]>;
  athleteName: string | null;
}

/** Each staff module and the permission that opens it org-wide (spec §4). */
const STAFF: Array<{ kind: Exclude<ModuleKind, "athlete">; href: string; label: string; opens: Permissions; assignment?: keyof ModuleFacts["assignments"] }> = [
  { kind: "admin", href: "/admin", label: "Admin", opens: { event: ["update"] } },
  { kind: "producer", href: "/producer", label: "Production", opens: { broadcast: ["control"] }, assignment: "producer" },
  { kind: "scorekeeper", href: "/scorekeeper", label: "Scorekeeper", opens: { score: ["enter"] }, assignment: "scorekeeper" },
  { kind: "commentator", href: "/commentator", label: "Commentator", opens: { commentary: ["read"] }, assignment: "commentator" },
];

/** The modules a person can open, from plain facts (userModules gathers them). */
export function modulesFor(f: ModuleFacts): Module[] {
  const out: Module[] = [];
  for (const m of STAFF) {
    const events = m.assignment ? f.assignments[m.assignment] : [];
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
