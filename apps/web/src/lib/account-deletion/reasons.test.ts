import { beforeEach, describe, expect, it, vi } from "vitest";

const fault = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("../observability/read-error", () => ({ reportReadFault: fault }));
const { markReasonRestored, recordDeletionReason } = await import("./reasons");
const { tenureBucket } = await import("./reason-model");

const NOW = Date.parse("2026-11-10T00:00:00Z");

function fake(error: { code?: string } | null = null) {
  const calls: { op: string; row?: Record<string, unknown>; filters: unknown[][] }[] = [];
  const client = {
    from: (table: string) => ({
      insert: async (row: Record<string, unknown>) => {
        calls.push({ op: `insert ${table}`, row, filters: [] });
        return { error };
      },
      update: (row: Record<string, unknown>) => {
        const call = { op: `update ${table}`, row, filters: [] as unknown[][] };
        calls.push(call);
        return {
          eq: (c: string, v: string) => {
            call.filters.push(["eq", c, v]);
            return { is: async (c2: string, v2: null) => (call.filters.push(["is", c2, v2]), { error }) };
          },
        };
      },
    }),
  } as never;
  return { client, calls };
}

beforeEach(() => fault.mockClear());

describe("recording why somebody left", () => {
  it("writes the reason, the capped note and the tenure bucket", async () => {
    const { client, calls } = fake();
    const ok = await recordDeletionReason(client, { userId: "u1", reason: "privacy", note: `  ${"x".repeat(600)}  `, accountCreatedAt: "2026-10-20T00:00:00Z", now: NOW });
    expect(ok).toBe(true);
    expect(calls[0]!.op).toBe("insert account_deletion_reasons");
    expect(calls[0]!.row).toMatchObject({ user_id: "u1", reason: "privacy", tenure_bucket: "under_30_days" });
    expect((calls[0]!.row!.note as string).length).toBe(500);
  });

  it("records 'not_given' and no note when the member chose nothing", async () => {
    const { client, calls } = fake();
    await recordDeletionReason(client, { userId: "u1", reason: undefined, note: "   ", accountCreatedAt: undefined, now: NOW });
    expect(calls[0]!.row).toMatchObject({ reason: "not_given", note: null, tenure_bucket: null });
  });

  it("does not throw or report when the table is not there yet", async () => {
    const { client } = fake({ code: "42P01" });
    expect(await recordDeletionReason(client, { userId: "u1", reason: "other", note: undefined, accountCreatedAt: null })).toBe(false);
    expect(fault).not.toHaveBeenCalled();
  });

  it("reports a real fault and still returns", async () => {
    const { client } = fake({ code: "42501" });
    expect(await recordDeletionReason(client, { userId: "u1", reason: "other", note: undefined, accountCreatedAt: null })).toBe(false);
    expect(fault).toHaveBeenCalledTimes(1);
  });

  it("buckets tenure", () => {
    expect(tenureBucket("2026-10-20T00:00:00Z", NOW)).toBe("under_30_days");
    expect(tenureBucket("2026-06-01T00:00:00Z", NOW)).toBe("1_to_6_months");
    expect(tenureBucket("2025-01-01T00:00:00Z", NOW)).toBe("over_6_months");
    expect(tenureBucket("nonsense", NOW)).toBeNull();
  });
});

describe("restoring flips the flag", () => {
  it("sets restored_at on that member's open rows only", async () => {
    const { client, calls } = fake();
    expect(await markReasonRestored(client, "u1", new Date("2026-11-11T00:00:00Z"))).toBe(true);
    expect(calls[0]!.row).toEqual({ restored_at: "2026-11-11T00:00:00.000Z" });
    expect(calls[0]!.filters).toEqual([["eq", "user_id", "u1"], ["is", "restored_at", null]]);
  });
});
