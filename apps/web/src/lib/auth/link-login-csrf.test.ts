import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * LOGIN CSRF THROUGH A `token_hash` LINK. Anybody can request a magic link
 * for their own account and forward the callback address. A member who is
 * already signed in and opens it must not be switched silently into the
 * stranger's account: the session the link made is ended and the link is
 * refused. The same member opening their own link carries on.
 */
const seam = vi.hoisted(() => ({
  current: null as { id: string } | null,
  linked: { id: "stranger" } as { id: string } | null,
  verifyOtp: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "user-agent": "Mozilla/5.0", "x-forwarded-for": "203.0.113.7" }),
  cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }),
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      verifyOtp: seam.verifyOtp,
      signOut: seam.signOut,
      getSession: async () => ({ data: { session: { access_token: "" } } }),
      getUser: async () => ({
        data: { user: seam.current ? { ...seam.current, identities: [{ provider: "email" }] } : null },
      }),
    },
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: vi.fn() }) }));
vi.mock("@/lib/security/agent-client", async () => ({
  createClientWithAgent: async () => (await import("@/lib/supabase/server")).createClient(),
}));
vi.mock("@/lib/site", () => ({ authOrigin: async () => "https://example.invalid" }));
vi.mock("@/lib/notify/welcome", () => ({ welcomeOnce: vi.fn() }));
vi.mock("@/lib/auth/finish-setup-server", () => ({ setupStillOwed: async () => false }));
vi.mock("@/lib/supabase/env", () => ({
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_ANON_KEY: "anon-key",
  isSupabaseConfigured: () => true,
}));

beforeEach(() => {
  seam.current = null;
  seam.linked = { id: "stranger" };
  seam.verifyOtp.mockReset();
  seam.verifyOtp.mockImplementation(async () => {
    const user = seam.linked;
    seam.current = user;
    return { data: { user, session: {} }, error: null };
  });
  seam.signOut.mockReset();
  seam.signOut.mockResolvedValue({ error: null });
  vi.stubGlobal("fetch", async () => ({ ok: true, json: async () => ({ external: { email: true } }) }));
});

describe("a token_hash link opened by somebody already signed in", () => {
  it("refuses a link to another account and ends the session it made", async () => {
    seam.current = { id: "member" };
    const { completeEmailVerification } = await import("./actions");
    const outcome = await completeEmailVerification({ tokenHash: "h", type: "magiclink", next: "/wallet" });
    expect(outcome).toEqual({ ok: false, reason: "invalid" });
    expect(seam.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("carries on for the member's own link", async () => {
    seam.current = { id: "member" };
    seam.linked = { id: "member" };
    const { completeEmailVerification } = await import("./actions");
    const outcome = await completeEmailVerification({ tokenHash: "h", type: "recovery", next: "/home" });
    expect(outcome.ok).toBe(true);
    expect(seam.signOut).not.toHaveBeenCalled();
  });

  it("carries on for a signed-out reader confirming a sign-up", async () => {
    seam.linked = { id: "newcomer" };
    const { completeEmailVerification } = await import("./actions");
    const outcome = await completeEmailVerification({ tokenHash: "h", type: "signup" });
    expect(outcome.ok).toBe(true);
    expect(seam.signOut).not.toHaveBeenCalled();
  });
});
