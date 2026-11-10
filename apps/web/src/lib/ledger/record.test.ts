import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { recordLedgerEntry } = await import("./record");

function admin(answer: { data: unknown; error: unknown } | Error) {
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  return {
    calls,
    rpc: async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      if (answer instanceof Error) throw answer;
      return answer;
    },
  };
}

const entry = {
  pot: "vallo_revenue",
  key: "settle:tx-1:commission",
  event: "FEE_CHARGED",
  direction: "in",
  amountMinor: 200,
  currency: "NGN",
  provider: "paystack",
} as const;

describe("recordLedgerEntry", () => {
  it("writes through the one database door and returns the entry id", async () => {
    const db = admin({ data: "entry-1", error: null });
    expect(await recordLedgerEntry(db as never, entry)).toEqual({ ok: true, id: "entry-1" });
    expect(db.calls[0]?.fn).toBe("ledger_record");
    expect(db.calls[0]?.args).toMatchObject({ p_pot: "vallo_revenue", p_event: "FEE_CHARGED", p_amount: 200, p_status: "confirmed" });
  });

  it("refuses a malformed entry before reaching the database", async () => {
    const db = admin({ data: "x", error: null });
    expect(await recordLedgerEntry(db as never, { ...entry, event: "ESCROW_FUNDED" })).toMatchObject({ ok: false });
    expect(db.calls).toHaveLength(0);
  });

  it("reports a database refusal or a thrown call, never a success", async () => {
    expect(await recordLedgerEntry(admin({ data: null, error: { message: "no" } }) as never, entry)).toEqual({ ok: false, reason: "no" });
    expect(await recordLedgerEntry(admin(new Error("down")) as never, entry)).toEqual({ ok: false, reason: "down" });
  });
});
