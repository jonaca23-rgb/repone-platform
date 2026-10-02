import { describe, expect, it } from "vitest";
import { modulesFor, resolveHome, type ModuleFacts } from "./modules";

const none: ModuleFacts = {
  orgName: "RepOneLive",
  orgRoles: [],
  assignments: { scorekeeper: [], producer: [], commentator: [] },
  athleteName: null,
};
const kinds = (f: ModuleFacts) => modulesFor(f).map((m) => m.kind);

describe("modulesFor", () => {
  it("an owner or admin sees every staff module", () => {
    expect(kinds({ ...none, orgRoles: ["owner"] })).toEqual(["admin", "producer", "scorekeeper", "commentator"]);
    expect(kinds({ ...none, orgRoles: ["admin"] })).toEqual(["admin", "producer", "scorekeeper", "commentator"]);
  });
  it("an event director sees every staff module too", () => {
    expect(kinds({ ...none, orgRoles: ["event_director"] })).toEqual(["admin", "producer", "scorekeeper", "commentator"]);
  });
  it("an org-wide scoring operator sees only Scorekeeper", () => {
    expect(kinds({ ...none, orgRoles: ["scoring_operator"] })).toEqual(["scorekeeper"]);
  });
  it("event assignments open their module and name the events", () => {
    const m = modulesFor({ ...none, assignments: { scorekeeper: ["Sector 2026", "GBO"], producer: [], commentator: [] } });
    expect(m).toEqual([{ kind: "scorekeeper", href: "/scorekeeper", label: "Scorekeeper", detail: "Sector 2026, GBO" }]);
  });
  it("an org-wide production director opens Production, Scorekeeper and Commentator", () => {
    expect(kinds({ ...none, orgRoles: ["production_director"] })).toEqual(["producer", "scorekeeper", "commentator"]);
  });
  it("a producer assignment also opens Scorekeeper and Commentator, naming the producer's events", () => {
    const m = modulesFor({ ...none, assignments: { scorekeeper: [], producer: ["Sector 2026"], commentator: [] } });
    expect(m).toEqual([
      { kind: "producer", href: "/producer", label: "Production", detail: "Sector 2026" },
      { kind: "scorekeeper", href: "/scorekeeper", label: "Scorekeeper", detail: "Sector 2026" },
      { kind: "commentator", href: "/commentator", label: "Commentator", detail: "Sector 2026" },
    ]);
  });
  it("a producer who also scores another event lists each event once", () => {
    const m = modulesFor({ ...none, assignments: { scorekeeper: ["GBO", "Sector 2026"], producer: ["Sector 2026"], commentator: [] } });
    expect(m.find((x) => x.kind === "scorekeeper")?.detail).toBe("GBO, Sector 2026");
  });
  it("an athlete profile adds the Athlete module last", () => {
    expect(kinds({ ...none, orgRoles: ["commentator"], athleteName: "Maria Rivera" })).toEqual(["commentator", "athlete"]);
  });
  it("nobody gets nothing", () => {
    expect(modulesFor(none)).toEqual([]);
  });
});

describe("resolveHome", () => {
  const athlete = modulesFor({ ...none, athleteName: "Maria Rivera" });
  const staff = modulesFor({ ...none, orgRoles: ["scoring_operator"] });
  it("only an athlete goes straight to /athlete", () => {
    expect(resolveHome(athlete)).toEqual({ redirect: "/athlete" });
  });
  it("no modules shows the empty start page offering an athlete profile", () => {
    expect(resolveHome([])).toEqual({ start: { modules: [], offerAthleteProfile: true } });
  });
  it("staff with one module still see the start page, with the athlete offer", () => {
    expect(resolveHome(staff)).toEqual({ start: { modules: staff, offerAthleteProfile: true } });
  });
  it("staff who compete see every card and no offer", () => {
    const both = modulesFor({ ...none, orgRoles: ["scoring_operator"], athleteName: "Ana" });
    expect(resolveHome(both)).toEqual({ start: { modules: both, offerAthleteProfile: false } });
  });
});
