import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A SIGN-IN THAT LOOKS LIKE IT WORKED AT ONCE (13 November 2026, the founder:
 * "it sits on /sign-in"). Measured on production: after the password was
 * accepted the screen did not change for 8 seconds and more, because the
 * action's `redirect()` makes Next fetch and begin streaming `/home` inside the
 * same request before it answers. And the two rate-limit counts, each a
 * database write, were made one after the other in front of every sign-in.
 *
 * These hold the three changes: the counts are made in order (a connection refusal never
 * spends the address count), a count that does not answer in time lets the
 * person through (as a failed count always has) and says so in the log, and a script-driven submit is answered with where to go instead of the
 * server-side redirect. A submit made before the page's script ran keeps the
 * redirect.
 */
const seam = vi.hoisted(() => ({
  consume: vi.fn(),
  alert: vi.fn(),
  signIn: vi.fn(),
  headers: new Headers(),
  remember: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: async () => seam.headers,
  cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }),
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));
vi.mock("@/lib/security/rate-limit", async () => {
  const actual = await vi.importActual<typeof import("../security/rate-limit")>("../security/rate-limit");
  return { ...actual, consume: seam.consume };
});
vi.mock("@/lib/alerts", () => ({ recordAlert: seam.alert }));
vi.mock("@/lib/ui/success-cookie", () => ({ rememberSuccess: seam.remember }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { signInWithPassword: seam.signIn } }) }));
vi.mock("@/lib/security/agent-client", () => ({ createClientWithAgent: async () => ({ auth: { signInWithPassword: seam.signIn } }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: vi.fn() }) }));
vi.mock("@/lib/site", () => ({ authOrigin: async () => "https://example.invalid" }));
vi.mock("./providers", () => ({ getProviderStates: () => [{ id: "email", configured: true }] }));

function form(next?: string): FormData {
  const data = new FormData();
  data.set("email", "ada@example.invalid");
  data.set("password", "a-password");
  if (next) data.set("next", next);
  return data;
}

const ALLOWED = { allowed: true, degraded: false } as const;
const DENIED = { allowed: false, retryAfterSeconds: 40, retryIn: "in under a minute" } as const;

beforeEach(() => {
  seam.consume.mockReset();
  seam.alert.mockReset();
  seam.signIn.mockReset();
  seam.remember.mockReset();
  seam.signIn.mockResolvedValue({ error: null });
  seam.headers = new Headers({ "x-forwarded-for": "203.0.113.7" });
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
});
afterEach(() => {
  vi.useRealTimers();
});

describe("the two counts in front of a sign-in", () => {
  it("are asked in order: a refusal by the connection count never spends the address's count", async () => {
    seam.consume.mockImplementation(async (request: { bucket: string }) => (request.bucket === "sign_in" ? DENIED : ALLOWED));
    const { signInWithEmail } = await import("./actions");
    seam.headers.set("next-action", "abc");
    const result = await signInWithEmail({ ok: false }, form());
    expect(result.ok).toBe(false);
    const buckets = seam.consume.mock.calls.map(([request]) => (request as { bucket: string }).bucket);
    expect(buckets).toEqual(["sign_in"]);
  });

  it("the address count starts only after the connection count has answered", async () => {
    const started: string[] = [];
    const release: (() => void)[] = [];
    seam.consume.mockImplementation((request: { bucket: string }) => {
      started.push(request.bucket);
      return new Promise((resolve) => release.push(() => resolve(ALLOWED)));
    });
    const { signInWithEmail } = await import("./actions");
    seam.headers.set("next-action", "abc");
    const pending = signInWithEmail({ ok: false }, form());
    await vi.waitFor(() => expect(started).toEqual(["sign_in"]));
    release.shift()!();
    await vi.waitFor(() => expect(started).toEqual(["sign_in", "sign_in_address"]));
    release.shift()!();
    expect((await pending).ok).toBe(true);
  });

  it("lets the person through when a count does not answer in time, as a failed count always has", async () => {
    vi.useFakeTimers();
    seam.consume.mockImplementation((request: { bucket: string }) =>
      request.bucket === "sign_in_address" ? new Promise(() => {}) : Promise.resolve(ALLOWED),
    );
    const { signInWithEmail } = await import("./actions");
    seam.headers.set("next-action", "abc");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const pending = signInWithEmail({ ok: false }, form());
    await vi.advanceTimersByTimeAsync(2_600);
    const result = await pending;
    expect(result).toEqual({ ok: true, next: "/home" });
    expect(seam.signIn).toHaveBeenCalledTimes(1);
    /* One line, the bucket and the cause, nothing that names the person. */
    expect(warn).toHaveBeenCalledTimes(1);
    const line = String(warn.mock.calls[0]![0]);
    expect(JSON.parse(line)).toEqual({ event: "auth.sign_in.count_degraded", bucket: "sign_in_address", cause: "timeout" });
    expect(line).not.toContain("ada");
    expect(line).not.toContain("203.0.113");
    warn.mockRestore();
  });

  it("still refuses on the connection count first, without asking the provider", async () => {
    seam.consume.mockImplementation(async (request: { bucket: string }) => (request.bucket === "sign_in" ? DENIED : ALLOWED));
    const { signInWithEmail } = await import("./actions");
    const result = await signInWithEmail({ ok: false }, form());
    expect(result.ok).toBe(false);
    expect(result.message).toContain("Too many attempts");
    expect(seam.signIn).not.toHaveBeenCalled();
    expect(seam.alert).not.toHaveBeenCalled();
  });
});

describe("what a signed-in submit gets back", () => {
  it("a script-driven submit is answered at once with where to go, and no server redirect is built", async () => {
    seam.consume.mockResolvedValue(ALLOWED);
    seam.headers.set("next-action", "abc");
    const { signInWithEmail } = await import("./actions");
    expect(await signInWithEmail({ ok: false }, form("/listing/abc"))).toEqual({ ok: true, next: "/listing/abc" });
    expect(seam.remember).not.toHaveBeenCalled();
  });

  it("a hostile next is still refused: the answer is a path on this site", async () => {
    seam.consume.mockResolvedValue(ALLOWED);
    seam.headers.set("next-action", "abc");
    const { signInWithEmail } = await import("./actions");
    expect(await signInWithEmail({ ok: false }, form("//evil.example/x"))).toEqual({ ok: true, next: "/home" });
  });

  it("a submit made before the page's script ran keeps the server redirect and the arrival banner", async () => {
    seam.consume.mockResolvedValue(ALLOWED);
    const { signInWithEmail } = await import("./actions");
    await expect(signInWithEmail({ ok: false }, form())).rejects.toThrow("REDIRECT:/home");
    expect(seam.remember).toHaveBeenCalledWith("signed-in");
  });

  it("a wrong password is answered as before, with nothing to go to", async () => {
    seam.consume.mockResolvedValue(ALLOWED);
    seam.signIn.mockResolvedValue({ error: { message: "Invalid login credentials" } });
    seam.headers.set("next-action", "abc");
    const { signInWithEmail } = await import("./actions");
    const result = await signInWithEmail({ ok: false }, form());
    expect(result.ok).toBe(false);
    expect(result.next).toBeUndefined();
  });
});
