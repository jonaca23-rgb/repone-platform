import { createAccessControl } from "better-auth/plugins/access";
import {
  adminAc,
  defaultStatements,
  memberAc,
  ownerAc,
} from "better-auth/plugins/organization/access";

/**
 * Who may do what in the organization. Defined in code, as in school-schedule,
 * so a permission change is a reviewable diff. These govern the application;
 * RLS remains the security boundary, and has_role() reads the same member row
 * these roles are stored in (0029_organization_plugin.sql).
 */
export const statement = {
  ...defaultStatements,
  /** Events, venues, floors, divisions, WODs. */
  event: ["create", "update", "delete"],
  /** Roster, registrations, teams, lifts. */
  athlete: ["manage"],
  /** Heats and lanes. */
  heat: ["manage"],
  /** Results and standings. */
  score: ["enter"],
  /** broadcast_state: current heat, graphics, timer. */
  broadcast: ["control"],
  /** Commentator screens and notes. */
  commentary: ["read"],
  sponsor: ["manage"],
  /** Fees, payments, expenses. */
  finance: ["manage"],
  /** Per-event staff assignments. */
  staff: ["invite"],
} as const;

export const ac = createAccessControl(statement);

const runsEvents = {
  event: ["create", "update", "delete"],
  athlete: ["manage"],
  heat: ["manage"],
  score: ["enter"],
  broadcast: ["control"],
  commentary: ["read"],
  sponsor: ["manage"],
  finance: ["manage"],
  staff: ["invite"],
} as const;

/** Answers for the organization. One per organization (member_one_owner_idx). */
const owner = ac.newRole({ ...ownerAc.statements, ...runsEvents });
/** Everything the owner can do except delete the organization. */
const admin = ac.newRole({ ...adminAc.statements, ...runsEvents });
/** Runs events and their staff; cannot add or change org members. */
const event_director = ac.newRole({ ...memberAc.statements, ...runsEvents });
const production_director = ac.newRole({
  ...memberAc.statements,
  heat: ["manage"],
  broadcast: ["control"],
  commentary: ["read"],
});
const scoring_operator = ac.newRole({ ...memberAc.statements, heat: ["manage"], score: ["enter"] });
const commentator = ac.newRole({ ...memberAc.statements, commentary: ["read"] });

export const roles = {
  owner,
  admin,
  event_director,
  production_director,
  scoring_operator,
  commentator,
};

export type OrgRole = keyof typeof roles;
export const ORG_ROLES = Object.keys(roles) as OrgRole[];
export type Permissions = Parameters<(typeof roles)["owner"]["authorize"]>[0];

export function isOrgRole(role: string): role is OrgRole {
  return Object.hasOwn(roles, role);
}

/** member.role is comma-joined (BetterAuth stores several roles that way). */
export function splitRoles(field: string | null | undefined): OrgRole[] {
  return (field ?? "")
    .split(",")
    .map((r) => r.trim())
    .filter(isOrgRole);
}

/** True if any of the roles authorizes every listed action, as BetterAuth's hasPermission decides. */
export function roleCan(
  rolesField: string | readonly string[] | null | undefined,
  permissions: Permissions,
): boolean {
  const list = typeof rolesField === "string" || rolesField == null
    ? splitRoles(rolesField)
    : rolesField.flatMap((r) => splitRoles(r));
  return list.some((r) => roles[r].authorize(permissions).success);
}

/** The role an event assignment grants for that one event. */
export const EVENT_STAFF_ROLE = {
  scorekeeper: "scoring_operator",
  producer: "production_director",
  commentator: "commentator",
} as const satisfies Record<"scorekeeper" | "producer" | "commentator", OrgRole>;
