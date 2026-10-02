import { describe, expect, it } from "vitest";
import { ORG_ROLES, roleCan, splitRoles } from "./permissions";

const APP = {
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

describe("roles", () => {
  it("owner and admin hold every app permission and manage members", () => {
    for (const role of ["owner", "admin"]) {
      for (const [resource, actions] of Object.entries(APP)) {
        expect(roleCan(role, { [resource]: [...actions] }), `${role} ${resource}`).toBe(true);
      }
      expect(roleCan(role, { member: ["create", "update", "delete"] })).toBe(true);
      expect(roleCan(role, { invitation: ["create"] })).toBe(true);
    }
  });

  it("only the owner may delete the organization", () => {
    expect(roleCan("owner", { organization: ["delete"] })).toBe(true);
    expect(roleCan("admin", { organization: ["delete"] })).toBe(false);
  });

  it("event_director runs events but cannot grant org roles", () => {
    for (const [resource, actions] of Object.entries(APP)) {
      expect(roleCan("event_director", { [resource]: [...actions] }), resource).toBe(true);
    }
    expect(roleCan("event_director", { member: ["create"] })).toBe(false);
    expect(roleCan("event_director", { invitation: ["create"] })).toBe(false);
  });

  it("the working roles get only their job", () => {
    expect(roleCan("scoring_operator", { score: ["enter"] })).toBe(true);
    expect(roleCan("scoring_operator", { broadcast: ["control"] })).toBe(false);
    expect(roleCan("production_director", { broadcast: ["control"] })).toBe(true);
    expect(roleCan("production_director", { score: ["enter"] })).toBe(false);
    expect(roleCan("commentator", { commentary: ["read"] })).toBe(true);
    expect(roleCan("commentator", { heat: ["manage"] })).toBe(false);
    for (const role of ["production_director", "scoring_operator", "commentator"]) {
      expect(roleCan(role, { event: ["update"] }), role).toBe(false);
    }
  });

  it("comma-joined roles grant the union", () => {
    expect(roleCan("scoring_operator,commentator", { commentary: ["read"] })).toBe(true);
    expect(roleCan("scoring_operator, commentator", { score: ["enter"] })).toBe(true);
    expect(roleCan(["commentator", "scoring_operator"], { score: ["enter"] })).toBe(true);
  });

  it("unknown or empty roles grant nothing", () => {
    expect(roleCan("member", { commentary: ["read"] })).toBe(false);
    expect(roleCan("", { commentary: ["read"] })).toBe(false);
    expect(roleCan(null, { commentary: ["read"] })).toBe(false);
    expect(splitRoles("owner,nope, admin")).toEqual(["owner", "admin"]);
  });

  it("lists the six roles", () => {
    expect(ORG_ROLES).toEqual([
      "owner",
      "admin",
      "event_director",
      "production_director",
      "scoring_operator",
      "commentator",
    ]);
  });
});
