import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * STORE-P2-04: the sign-in wall is ONE switch, VALLO_PUBLIC_CATALOGUE.
 *
 * Drives the real `proxy()` with no session. OFF (the default) is today's
 * closed product. ON opens the six read-only catalogue screens and nothing
 * else: `/u`, messages, wallet, bookings and every API route stay shut, and a
 * stranger's catalogue reads are counted per address.
 */
const seam = vi.hoisted(() => ({
  consume: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getClaims: async () => ({ data: null, error: null }) } }),
}));
vi.mock("@/lib/security/rate-limit", async () => {
  const actual = await vi.importActual<typeof import("./lib/security/rate-limit")>("./lib/security/rate-limit");
  return { ...actual, consume: seam.consume };
});

const CATALOGUE = ["/search", "/stays", "/stays/search", "/restaurants", "/listing/ed000000-0000-4000-8000-00000000003a", "/stay/abc", "/restaurant/abc"];
/* `/u/somebody` (the bare profile page) opened to signed-out readers on 9
   November 2026, so it is no longer always gated; its `/edit` sub-route stays
   shut and stands in here. */
const ALWAYS_GATED = ["/u/somebody/edit", "/messages", "/messages/new?listing=abc", "/wallet", "/bookings", "/saved", "/home", "/settings"];

async function visit(path: string, env: Record<string, string>, extraHeaders: Record<string, string> = {}) {
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  const { proxy } = await import("./proxy");
  return proxy(new NextRequest(new URL(path, "https://www.vallospaces.com"), { headers: { "x-forwarded-for": "203.0.113.9", ...extraHeaders } }));
}

function bounced(response: Response): boolean {
  return response.status === 307 && (response.headers.get("location") ?? "").includes("/sign-in");
}

beforeEach(() => {
  vi.unstubAllEnvs();
  seam.consume.mockReset();
  seam.consume.mockResolvedValue({ allowed: true, degraded: false });
});

describe("switch OFF (unset): the product stays closed", () => {
  it.each(CATALOGUE)("%s sends a stranger to sign in", async (path) => {
    expect(bounced(await visit(path, {}))).toBe(true);
    expect(seam.consume).not.toHaveBeenCalled();
  });

  it("a value nobody meant is not ON", async () => {
    expect(bounced(await visit("/search", { VALLO_PUBLIC_CATALOGUE: "yes please" }))).toBe(true);
  });
});

describe("switch ON: the catalogue reads, nothing else opens", () => {
  it.each(CATALOGUE)("%s answers a stranger", async (path) => {
    const response = await visit(path, { VALLO_PUBLIC_CATALOGUE: "on" });
    expect(bounced(response)).toBe(false);
    expect(response.status).toBe(200);
  });

  it.each(ALWAYS_GATED)("%s is still gated", async (path) => {
    expect(bounced(await visit(path, { VALLO_PUBLIC_CATALOGUE: "on" }))).toBe(true);
  });

  it("opens the map's pins, which the search page calls, and no other API route", async () => {
    expect((await visit("/api/map/listings", { VALLO_PUBLIC_CATALOGUE: "1" })).status).toBe(200);
    expect((await visit("/api/map/listings", {})).status).toBe(401);
    for (const path of ["/api/assistant", "/api/push/register", "/api/documents/abc", "/api/crypto/quote"]) {
      expect((await visit(path, { VALLO_PUBLIC_CATALOGUE: "1" })).status).toBe(401);
    }
  });

  it("counts a stranger's reads per address and refuses past the limit", async () => {
    await visit("/search", { VALLO_PUBLIC_CATALOGUE: "true" });
    expect(seam.consume).toHaveBeenCalledWith(
      expect.objectContaining({ bucket: "anon_catalogue", subject: "ip:203.0.113.9" }),
    );
    seam.consume.mockResolvedValue({ allowed: false, retryAfterSeconds: 120, retryIn: "in about 2 minutes" });
    const response = await visit("/listing/abc", { VALLO_PUBLIC_CATALOGUE: "true" });
    /* A page answers a page: sign in with the reason, the address kept. */
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/sign-in?next=%2Flisting%2Fabc&notice=catalogue-paced");
    expect(response.headers.get("retry-after")).toBe("120");
  });

  it("does not count RSC navigations or prefetches, so a refusal never breaks a client navigation", async () => {
    seam.consume.mockResolvedValue({ allowed: false, retryAfterSeconds: 120, retryIn: "in about 2 minutes" });
    for (const headers of <Record<string, string>[]>[
      { rsc: "1" },
      { "next-router-prefetch": "1", rsc: "1" },
      { purpose: "prefetch" },
      { "sec-purpose": "prefetch;prerender" },
      { "sec-fetch-dest": "empty" },
    ]) {
      seam.consume.mockClear();
      const response = await visit("/listing/abc", { VALLO_PUBLIC_CATALOGUE: "true" }, headers);
      expect(seam.consume).not.toHaveBeenCalled();
      expect(response.status).toBe(200);
    }
    seam.consume.mockClear();
    await visit("/listing/abc", { VALLO_PUBLIC_CATALOGUE: "true" }, { "sec-fetch-dest": "document" });
    expect(seam.consume).toHaveBeenCalledTimes(1);
  });
});
