import { APIError } from "better-auth/api";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "./testing/fakeSupabase";

vi.mock("server-only", () => ({}));
const db = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/lib/db/server", () => ({ createClient: async () => db.current }));
vi.mock("@/lib/auth/guards", async (orig) => ({
  ...(await orig<typeof import("@/lib/auth/guards")>()),
  requireOrgManager: async () => ({ ctx: {}, organizationId: "org-1" }),
}));
vi.mock("@/lib/auth/session", () => ({ orgCan: () => true }));
const authApi = vi.hoisted(() => ({ updateMemberRole: vi.fn(), removeMember: vi.fn() }));
vi.mock("@/lib/auth/server", () => ({ auth: { api: authApi } }));
const invite = vi.hoisted(() => ({
  inviteToOrg: vi.fn(),
  pendingEmail: vi.fn(),
  resendInvitation: vi.fn(),
}));
vi.mock("@/lib/auth/invite", async (orig) => ({
  ...(await orig<typeof import("@/lib/auth/invite")>()),
  ...invite,
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { inviteTeamMember, removeTeamRole, resendTeamInvite } from "./team";

const MEMBER = "00000000-0000-4000-8000-000000000101";
const USER = "00000000-0000-4000-8000-000000000201";

function form(values: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

beforeEach(() => vi.clearAllMocks());

describe("inviteTeamMember", () => {
  it("says what happened in the inviter's words", async () => {
    db.current = fakeSupabase({ organizations: [{ data: { name: "RepOne" } }] }).client;
    invite.inviteToOrg.mockResolvedValue({ created: true, emailSent: true });
    expect(await inviteTeamMember(form({ email: "new@example.com", role: "admin" }))).toEqual({
      ok: true,
      message: "Invitation sent.",
    });
  });

  it("puts a bad email on its field", async () => {
    db.current = fakeSupabase({}).client;
    const result = await inviteTeamMember(form({ email: "nope", role: "admin" }));
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.fieldErrors?.email).toBeTruthy();
  });
});

describe("resendTeamInvite", () => {
  it("refuses someone who isn't on the team", async () => {
    db.current = fakeSupabase({ member: [{ data: null }] }).client;
    expect(await resendTeamInvite(USER)).toEqual({
      ok: false,
      message: "That person isn't on this team.",
    });
  });
});

describe("removeTeamRole", () => {
  it("keeps the organization's last owner", async () => {
    db.current = fakeSupabase({ member: [{ data: { role: "owner" } }] }).client;
    authApi.removeMember.mockRejectedValue(
      new APIError("BAD_REQUEST", {
        code: "YOU_CANNOT_LEAVE_THE_ORGANIZATION_AS_THE_ONLY_OWNER",
        message: "x",
      }),
    );
    expect(await removeTeamRole(MEMBER, "owner")).toEqual({
      ok: false,
      message: "The organization must keep an owner.",
    });
  });

  it("removes one role of several", async () => {
    db.current = fakeSupabase({ member: [{ data: { role: "admin,commentator" } }] }).client;
    authApi.updateMemberRole.mockResolvedValue({});
    expect(await removeTeamRole(MEMBER, "commentator")).toEqual({
      ok: true,
      message: "Role removed.",
    });
  });
});
