import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * `/open` is the native cold-start path. A session check that never answers
 * must not leave the web view's first navigation hanging: the route answers
 * within OPEN_TIMEOUT_MS from the auth cookie alone. And a request with no
 * auth cookie has nothing to confirm, so it goes to the signed-out start at
 * once. Since 13 October 2026 the check is the locally verified token
 * (`resolveSessionClaims`), not a GoTrue round trip; only that resolver is
 * mocked here, so a return to `resolveSession` fails every test below.
 */
const AUTH = "sb-abc-auth-token";
const resolveSessionClaims = vi.fn();
let cookieNames: string[] = [];

vi.mock("@/lib/actions/session", () => ({ resolveSessionClaims: () => resolveSessionClaims() }));
let signedOutTarget = "/welcome";
let firstRunValue = "";
vi.mock("@/lib/catalogue/public-access", () => ({ signedOutStart: () => signedOutTarget }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    getAll: () => [
      ...cookieNames.map((name) => ({ name, value: "x" })),
      ...(firstRunValue ? [{ name: "vallo_first_run", value: firstRunValue }] : []),
    ],
  }),
}));

/* Mirrors the private constant in route.ts; Next allows no extra route exports. */
const OPEN_TIMEOUT_MS = 800;
const { GET } = await import("./route");

const request = () => new Request("https://vallo.test/open");
const location = (res: Response) => new URL(res.headers.get("location")!).pathname;

describe("/open", () => {
  beforeEach(() => {
    resolveSessionClaims.mockReset();
    cookieNames = [];
    signedOutTarget = "/welcome";
    firstRunValue = "";
  });

  it("opens a first open on the onboarding even when the catalogue is open, then the signed-out start once seen", async () => {
    signedOutTarget = "/search";
    expect(location(await GET(request()))).toBe("/welcome");
    firstRunValue = "seen";
    expect(location(await GET(request()))).toBe("/search");
  });
  afterEach(() => vi.useRealTimers());

  it("sends a resolved session to /home, uncached", async () => {
    cookieNames = [AUTH];
    resolveSessionClaims.mockResolvedValue({ state: "signed-in" });
    const res = await GET(request());
    expect(res.status).toBe(307);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(location(res)).toBe("/home");
  });

  it("sends a resolved signed-out caller to the signed-out start", async () => {
    /* A cookie GoTrue no longer honours: the round trip decides. */
    cookieNames = [AUTH];
    resolveSessionClaims.mockResolvedValue({ state: "signed-out" });
    expect(location(await GET(request()))).toBe("/welcome");
  });

  it("answers at the deadline from the auth cookie when GoTrue never replies", async () => {
    vi.useFakeTimers();
    resolveSessionClaims.mockReturnValue(new Promise(() => {}));
    cookieNames = [AUTH];
    const pending = GET(request());
    await vi.advanceTimersByTimeAsync(OPEN_TIMEOUT_MS);
    expect(location(await pending)).toBe("/home");
  });

  it("sends a request with no auth cookie to the signed-out start at once, without asking GoTrue", async () => {
    vi.useFakeTimers();
    resolveSessionClaims.mockReturnValue(new Promise(() => {}));
    cookieNames = ["vallo-first-run"];
    let settled = false;
    const pending = GET(request()).then((res) => ((settled = true), res));
    /* No timer is advanced: the answer does not wait on the deadline. */
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(true);
    expect(location(await pending)).toBe("/welcome");
    expect(resolveSessionClaims).not.toHaveBeenCalled();
  });

  it("also reads a chunked auth cookie as a session to confirm", async () => {
    cookieNames = [`${AUTH}.0`, `${AUTH}.1`];
    resolveSessionClaims.mockResolvedValue({ state: "signed-in" });
    expect(location(await GET(request()))).toBe("/home");
    expect(resolveSessionClaims).toHaveBeenCalledTimes(1);
  });

  it("with an auth cookie, does not answer before the deadline", async () => {
    vi.useFakeTimers();
    cookieNames = [AUTH];
    resolveSessionClaims.mockReturnValue(new Promise(() => {}));
    let settled = false;
    void GET(request()).then(() => (settled = true));
    await vi.advanceTimersByTimeAsync(OPEN_TIMEOUT_MS - 1);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(settled).toBe(true);
  });
});
