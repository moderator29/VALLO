import { beforeEach, describe, expect, it, vi } from "vitest";

const fault = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("@/lib/observability/read-error", () => ({ reportReadFault: fault }));
const { readDeletionReasons } = await import("./read");

function client(result: { data?: unknown; error?: { code?: string } | null }, spy?: (columns: string) => void) {
  return {
    from: () => ({
      select: (columns: string) => {
        spy?.(columns);
        return { order: () => ({ limit: async () => ({ data: result.data ?? null, error: result.error ?? null }) }) };
      },
    }),
  } as never;
}

beforeEach(() => fault.mockClear());

describe("reading the deletion reasons", () => {
  it("says not switched on when the table is missing, without reporting a fault", async () => {
    expect(await readDeletionReasons(client({ error: { code: "42P01" } }), false)).toEqual({ state: "not-switched-on" });
    expect(await readDeletionReasons(client({ error: { code: "PGRST205" } }), false)).toEqual({ state: "not-switched-on" });
    expect(fault).not.toHaveBeenCalled();
  });

  it("reports any other returned error before answering unavailable", async () => {
    expect(await readDeletionReasons(client({ error: { code: "42501" } }), false)).toEqual({ state: "unavailable" });
    expect(fault).toHaveBeenCalledTimes(1);
  });

  it("never selects the user id, and selects the note for a super admin only", async () => {
    const seen: string[] = [];
    await readDeletionReasons(client({ data: [] }, (c) => seen.push(c)), false);
    await readDeletionReasons(client({ data: [] }, (c) => seen.push(c)), true);
    expect(seen[0]).not.toContain("note");
    expect(seen[1]).toContain("note");
    expect(seen.join()).not.toContain("user_id");
  });

  it("maps rows to the model's shape and drops a note for a non super admin", async () => {
    const data = [{ reason: "privacy", requested_at: "2026-11-01T00:00:00Z", restored_at: null, note: "secret" }];
    expect(await readDeletionReasons(client({ data }), false)).toEqual({
      state: "ok",
      rows: [{ reason: "privacy", requestedAt: "2026-11-01T00:00:00Z", restoredAt: null, note: null }],
    });
  });
});
