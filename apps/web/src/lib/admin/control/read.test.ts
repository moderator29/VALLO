import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../guard", () => ({ requireAdmin: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

const { readSetup, readWaiting, readControlRoom } = await import("./read");
const { SETUP_ITEMS } = await import("./setup");
const { requireAdmin } = await import("../guard");

type Answer = { count: number | null; error: unknown };

/** A stand-in client: each table answers a head count, by table name. */
function fakeDb(counts: Record<string, Answer | ((filters: string[]) => Answer)>) {
  return {
    from(table: string) {
      const filters: string[] = [];
      const chain: Record<string, unknown> = {};
      for (const m of ["select", "eq", "in", "or", "limit"]) {
        chain[m] = (...args: unknown[]) => {
          filters.push(`${m}:${args.map(String).join(",")}`);
          return chain;
        };
      }
      chain.then = (resolve: (v: Answer) => unknown) => {
        const a = counts[table];
        return resolve(typeof a === "function" ? a(filters) : (a ?? { count: null, error: { code: "42P01" } }));
      };
      return chain;
    },
  } as never;
}

describe("database setup, read from the live database", () => {
  it("marks each part by what its probe answered, waiting first", async () => {
    const [a, b, c] = SETUP_ITEMS;
    const readings = await readSetup(
      async (item) => (item.key === a!.key ? null : item.key === b!.key ? { code: "42P01" } : { code: "57014" }),
      [a!, b!, c!],
    );
    expect(readings.map((r) => [r.item.key, r.state])).toEqual([
      [b!.key, "waiting"],
      [c!.key, "unknown"],
      [a!.key, "ready"],
    ]);
  });

  it("never fails the page when a probe throws", async () => {
    const readings = await readSetup(async () => {
      throw new Error("down");
    }, [SETUP_ITEMS[0]!]);
    expect(readings[0]!.state).toBe("unknown");
  });
});

describe("what is waiting on the super admin", () => {
  it("writes one plain line for each thing that has something waiting, and none for what has nothing", async () => {
    const lines = await readWaiting(
      fakeDb({
        risk_alerts: (filters) => ({ count: filters.some((f) => f.includes("severity,critical")) ? 1 : 3, error: null }),
        staff_access_recommendations: { count: 0, error: null },
        staff_escalations: { count: 2, error: null },
      }),
      "11111111-1111-4111-8111-111111111111",
    );
    expect(lines.map((l) => l.words)).toEqual([
      "2 escalations are waiting on you.",
      "1 critical alert is open.",
      "2 other alerts are open.",
    ]);
    expect(lines[0]!.href).toBe("/admin/escalations");
  });

  it("leaves out a table that is not there yet, instead of failing", async () => {
    const lines = await readWaiting(fakeDb({ risk_alerts: { count: 0, error: null }, staff_access_recommendations: { count: 0, error: null } }), "u");
    expect(lines).toEqual([]);
  });
});

describe("the door", () => {
  it("opens only for a super admin", async () => {
    vi.mocked(requireAdmin).mockResolvedValueOnce({ state: "not-admin" } as never);
    expect((await readControlRoom({})).state).toBe("forbidden");
    vi.mocked(requireAdmin).mockResolvedValueOnce({ state: "admin", isSuperAdmin: false, user: { id: "u" } } as never);
    expect((await readControlRoom({})).state).toBe("forbidden");
  });
});
