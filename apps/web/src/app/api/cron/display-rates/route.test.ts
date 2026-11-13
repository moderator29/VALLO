import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * THE DISPLAY-RATES ROUTE IS THROUGH THE PROXY WALL, SO IT GUARDS ITSELF.
 *
 * `/api/cron/display-rates` is in `PUBLIC_API_PATHS` so the scheduler can
 * reach it with no session. These pin that the route itself refuses a caller
 * without the cron secret (no bearer, a wrong bearer), and that a refusal
 * calls no job, fetches no rate source and writes no row.
 */

const job = vi.fn(async () => ({ outcome: "ok" as const, counts: {}, detail: {}, alert: null }));
const report = vi.fn(async () => undefined);
const writes: unknown[] = [];
const fakeAdmin = {
  from: vi.fn(() => ({
    upsert: (rows: unknown) => {
      writes.push(rows);
      return Promise.resolve({ error: null });
    },
    insert: (rows: unknown) => {
      writes.push(rows);
      return Promise.resolve({ error: null });
    },
  })),
};

vi.mock("@/lib/currency/rates-job", () => ({ displayRates: job }));
vi.mock("@/lib/cron/report", () => ({ reportCronRun: report }));
vi.mock("@/lib/alerts", () => ({ recordAlert: vi.fn(async () => undefined) }));
vi.mock("@/lib/security/money-limits", () => ({
  ROUTE_FAILURE_LIMITS: { cronBadSecret: {} },
  countRouteFailure: vi.fn(async () => ({ allowed: true, retryAfterSeconds: 0 })),
}));
vi.mock("@/lib/supabase/env", () => ({ isSupabaseConfigured: () => true }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => fakeAdmin }));

const fetchSpy = vi.fn(async () => new Response("{}"));

beforeEach(() => {
  vi.stubEnv("RECONCILE_CRON_SECRET", "the-right-secret");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key");
  vi.stubGlobal("fetch", fetchSpy);
  job.mockClear();
  report.mockClear();
  fetchSpy.mockClear();
  fakeAdmin.from.mockClear();
  writes.length = 0;
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const URL_ = "https://www.vallospaces.com/api/cron/display-rates";

describe("/api/cron/display-rates", () => {
  for (const method of ["GET", "POST"] as const) {
    it(`${method} with no bearer is refused and fetches and writes nothing`, async () => {
      const route = await import("./route");
      const response = await route[method](new Request(URL_, { method }));
      expect(response.status).toBe(401);
      expect(job).not.toHaveBeenCalled();
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(fakeAdmin.from).not.toHaveBeenCalled();
      expect(writes).toEqual([]);
    });

    it(`${method} with a wrong bearer is refused and fetches and writes nothing`, async () => {
      const route = await import("./route");
      const response = await route[method](
        new Request(URL_, { method, headers: { authorization: "Bearer not-the-secret" } }),
      );
      expect(response.status).toBe(401);
      expect(job).not.toHaveBeenCalled();
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(fakeAdmin.from).not.toHaveBeenCalled();
      expect(writes).toEqual([]);
    });
  }

  it("with the right bearer runs the job once, through the shared wrapper", async () => {
    const route = await import("./route");
    const response = await route.GET(new Request(URL_, { headers: { authorization: "Bearer the-right-secret" } }));
    expect(response.status).toBe(200);
    expect(job).toHaveBeenCalledTimes(1);
    const body = (await response.json()) as { ok: boolean; job: string };
    expect(body).toMatchObject({ ok: true, job: "display-rates" });
    expect(report).toHaveBeenCalledTimes(1);
  });
});
