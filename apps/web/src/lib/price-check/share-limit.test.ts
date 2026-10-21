import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Minting a price share card writes a public row through the service role and
 * is open to a signed-out reader, so it is rate limited: per person, or per
 * address when there is no account.
 */

const state = vi.hoisted(() => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key-for-share-seals";
  return {
    allowed: true,
    signedIn: false,
    minted: 0,
    subjects: [] as string[],
    args: [] as Record<string, unknown>[],
  };
});

vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "197.210.0.1" }) }));
vi.mock("../supabase/env", () => ({ isSupabaseConfigured: () => true }));
vi.mock("../supabase/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("../actions/session", () => ({
  NOT_CONFIGURED_MESSAGE: "unconfigured",
  resolveSession: async () =>
    state.signedIn ? { state: "signed-in", user: { id: "user-1" }, supabase: {} } : { state: "signed-out" },
}));
vi.mock("./rpc", () => ({
  insertPriceCheckWatch: vi.fn(),
  priceCheckRpc: vi.fn(async (_db: unknown, _fn: string, args: Record<string, unknown>) => {
    state.minted += 1;
    state.args.push(args);
    return { data: "share-1", error: null };
  }),
}));
vi.mock("../security/rate-limit", () => ({
  consume: vi.fn(async (request: { subject: string }) => {
    state.subjects.push(request.subject);
    return state.allowed
      ? { allowed: true, degraded: false }
      : { allowed: false, retryAfterSeconds: 60, retryIn: "in about a minute" };
  }),
  ipFromHeaders: (h: Headers) => h.get("x-forwarded-for") ?? "unknown",
  subjectForIp: (ip: string) => `ip:${ip}`,
  subjectForUser: (id: string) => `user:${id}`,
}));

const { recordPriceCheckStage, shareAreaPrices } = await import("./actions");
const { sealWithServerKey } = await import("./share-seal");

const CARD = {
  seal: sealWithServerKey({
    scope: "area",
    stateCode: "LA",
    listingIntent: "rent",
    lowMinor: 100_000_000,
    midMinor: 150_000_000,
    highMinor: 200_000_000,
    listingCount: 5,
  }),
};

beforeEach(() => {
  state.allowed = true;
  state.signedIn = false;
  state.minted = 0;
  state.subjects = [];
  state.args = [];
});

describe("shareAreaPrices is rate limited", () => {
  it("mints within the limit, counted by address when signed out", async () => {
    const result = await shareAreaPrices(CARD);
    expect(result).toEqual({ ok: true, data: { id: "share-1" } });
    expect(state.subjects).toEqual(["ip:197.210.0.1"]);
  });

  it("counts a signed-in reader by account", async () => {
    state.signedIn = true;
    await shareAreaPrices(CARD);
    expect(state.subjects).toEqual(["user:user-1"]);
  });

  it("mints nothing over the limit and says when to try again", async () => {
    state.allowed = false;
    const result = await shareAreaPrices(CARD);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("in about a minute");
    expect(state.minted).toBe(0);
  });
});

describe("shareAreaPrices mints only the server's figures", () => {
  it("mints exactly what the seal says", async () => {
    const result = await shareAreaPrices(CARD);
    expect(result.ok).toBe(true);
    expect(state.args[0]).toMatchObject({
      p_scope: "area",
      p_state_code: "LA",
      p_low_minor: 100_000_000,
      p_mid_minor: 150_000_000,
      p_high_minor: 200_000_000,
      p_listing_count: 5,
    });
  });

  it("refuses figures the caller wrote, with no seal", async () => {
    const result = await shareAreaPrices({
      scope: "area",
      stateCode: "LA",
      listingIntent: "rent",
      lowMinor: 1,
      midMinor: 1,
      highMinor: 1,
      listingCount: 5,
    });
    expect(result.ok).toBe(false);
    expect(state.minted).toBe(0);
  });

  it("refuses a seal whose card was rewritten", async () => {
    const [version, payload, signature] = String(CARD.seal).split(".");
    const forged = JSON.parse(Buffer.from(String(payload), "base64url").toString("utf8"));
    forged.card.midMinor = 1;
    const tampered = `${version}.${Buffer.from(JSON.stringify(forged)).toString("base64url")}.${signature}`;
    const result = await shareAreaPrices({ seal: tampered });
    expect(result.ok).toBe(false);
    expect(state.minted).toBe(0);
  });
});

describe("recordPriceCheckStage is rate limited", () => {
  const STAGE = { checkId: "11111111-1111-4111-8111-111111111111", stage: "reach" };

  it("writes the funnel row within the limit, counted by address when signed out", async () => {
    const result = await recordPriceCheckStage(STAGE);
    expect(result).toEqual({ ok: true, data: null });
    expect(state.minted).toBe(1);
    expect(state.subjects).toEqual(["ip:197.210.0.1"]);
  });

  it("writes nothing over the limit and still answers ok", async () => {
    state.allowed = false;
    const result = await recordPriceCheckStage(STAGE);
    expect(result).toEqual({ ok: true, data: null });
    expect(state.minted).toBe(0);
  });
});
