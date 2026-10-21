import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Every register call can add a row the drain then sends to, so an account
 * is counted. Over the allowance the route answers 429 and writes nothing;
 * the count is per account, never per device.
 */
const seam = vi.hoisted(() => ({ allowed: true, upserts: 0, subjects: [] as string[] }));

vi.mock("@/lib/supabase/env", () => ({ isSupabaseConfigured: () => true }));
vi.mock("next/headers", () => ({ headers: async () => new Headers(), cookies: async () => ({}) }));
vi.mock("@/lib/actions/session", () => ({ accountSetupOwed: async () => false }));
vi.mock("@/lib/security/rate-limit", () => ({
  subjectForUser: (id: string) => `user:${id}`,
  consume: async ({ subject }: { subject: string }) => {
    seam.subjects.push(subject);
    return seam.allowed ? { allowed: true } : { allowed: false, retryAfterSeconds: 60, retryIn: "in about a minute" };
  },
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: "u-1" } } }) } }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
      upsert: () => {
        seam.upserts += 1;
        return { select: () => ({ maybeSingle: async () => ({ data: { device_ref: "ref-1" }, error: null }) }) };
      },
    }),
  }),
}));

const post = () =>
  new Request("https://example.invalid/api/push/register", {
    method: "POST",
    body: JSON.stringify({ platform: "android", token: "a-native-registration-token" }),
  });

describe("POST /api/push/register: the per-account allowance", () => {
  beforeEach(() => {
    seam.allowed = true;
    seam.upserts = 0;
    seam.subjects = [];
  });

  it("records the device within the allowance, counted against the account", async () => {
    const { POST } = await import("./route");
    expect((await POST(post())).status).toBe(200);
    expect(seam.subjects).toEqual(["user:u-1"]);
    expect(seam.upserts).toBe(1);
  });

  it("answers 429 over the allowance and writes nothing", async () => {
    seam.allowed = false;
    const { POST } = await import("./route");
    const res = await POST(post());
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ ok: false, reason: "rate_limited" });
    expect(seam.upserts).toBe(0);
  });
});
