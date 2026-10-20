import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db/server", () => ({ createClient: async () => ({ rpc }) }));
vi.mock("@/lib/auth/guards", async (orig) => ({
  ...(await orig<typeof import("@/lib/auth/guards")>()),
  requireSignedIn: async () => ({ userId: "u-1" }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { completeAthleteOnboarding } from "./onboarding";

const form = () => {
  const fd = new FormData();
  fd.set("first_name", "Maria");
  fd.set("last_name", "Rivera");
  fd.set("email", "maria@example.com");
  return fd;
};

beforeEach(() => vi.clearAllMocks());

describe("completeAthleteOnboarding", () => {
  it("says why the profile wasn't created", async () => {
    rpc.mockResolvedValue({ error: { message: "duplicate key value", code: "23505" } });
    const result = await completeAthleteOnboarding(form());
    expect(result.ok).toBe(false);
  });

  it("sends the athlete home once the profile exists", async () => {
    rpc.mockResolvedValue({ error: null });
    expect(await completeAthleteOnboarding(form())).toEqual({
      ok: true,
      data: { href: "/athlete" },
    });
  });
});
