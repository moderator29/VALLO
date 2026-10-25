import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * THE DEADLINE ON THE SHELL'S COLD START, which is the one of the 3 October
 * splash fixes that no client timer can cover.
 *
 * `proxy.ts` sends every shell request for `/` straight to this route, so this
 * handler's response IS the native web view's main-frame navigation. While it
 * is unresolved no document exists, so none of the splash's own failsafes has
 * been parsed, let alone armed: the phone sits on the branded image for as long
 * as the request takes, which on 2 October was more than fifteen minutes.
 * `resolveSession()` calls GoTrue over the network with no deadline of its own,
 * so "as long as the request takes" is unbounded.
 *
 * What is gated here is that the handler ALWAYS ANSWERS: inside the deadline
 * with the real session, and on timeout with the cheap cookie guess, which is
 * safe because `proxy.ts`'s own already time-bounded gate decides on the very
 * next request who may stay. A test that only checked the happy path would pass
 * against the hanging version, so the hanging session is the main case below.
 */

const resolveSession = vi.fn();
let jar: Array<{ name: string; value: string }> = [];

vi.mock("@/lib/actions/session", () => ({ resolveSession }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => jar.find((cookie) => cookie.name === name),
    getAll: () => jar,
  }),
}));

/** The session that never answers: a slow or unreachable GoTrue. */
const hangs = () => new Promise<never>(() => {});

async function landing(request = new Request("http://localhost:3000/home-or-landing")) {
  const { GET } = await import("./route");
  const response = await GET(request);
  return new URL(response.headers.get("location") ?? "").pathname;
}

afterEach(() => {
  vi.useRealTimers();
  resolveSession.mockReset();
  jar = [];
});

describe("home or landing, never hanging", () => {
  it("answers from the real session when it arrives in time", async () => {
    resolveSession.mockResolvedValue({ state: "signed-in" });
    expect(await landing()).toBe("/home");
    resolveSession.mockResolvedValue({ state: "signed-out" });
    expect(await landing()).toBe("/");
  });

  it("falls back to the cookie guess 3 seconds after a session that never answers", async () => {
    vi.useFakeTimers();
    resolveSession.mockImplementation(hangs);
    jar = [{ name: "sb-uccixoonmbhrnyczyigt-auth-token", value: "x" }];
    const pending = landing();
    await vi.advanceTimersByTimeAsync(3_000);
    expect(await pending).toBe("/home");
  });

  it("is still waiting at 799 ms, so the deadline is the one in the file", async () => {
    vi.useFakeTimers();
    resolveSession.mockImplementation(hangs);
    jar = [{ name: "sb-uccixoonmbhrnyczyigt-auth-token", value: "x" }];
    let settled = false;
    const pending = landing().then((path) => {
      settled = true;
      return path;
    });
    await vi.advanceTimersByTimeAsync(799);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toBe("/home");
  });

  it("guesses signed out when no Supabase auth cookie is present", async () => {
    vi.useFakeTimers();
    resolveSession.mockImplementation(hangs);
    jar = [{ name: "vallo_first_run", value: "seen" }, { name: "sb-x-something-else", value: "y" }];
    const pending = landing();
    await vi.advanceTimersByTimeAsync(3_000);
    expect(await pending).toBe("/");
  });

  it("never sends the store shell to the landing page, even on a timeout (V-11)", async () => {
    vi.useFakeTimers();
    resolveSession.mockImplementation(hangs);
    const pending = landing(new Request("http://localhost:3000/home-or-landing?app=1"));
    await vi.advanceTimersByTimeAsync(3_000);
    const path = await pending;
    expect(path).not.toBe("/");
    expect(["/welcome", "/sign-in", "/home"]).toContain(path);
  });
});
