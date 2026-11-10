import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { LEDGER_EVENTS, LEDGER_POTS, ledgerEntryProblem, type LedgerEntryInput } from "./events";

/*
 * The applied ledger migration, by its exact filename. readFileSync throws
 * when it is missing, so a renamed or moved file fails the suite.
 */
const MIGRATION = join(__dirname, "../../../../../supabase/migrations/20261006105326_b2_ledger.sql");

const ok: LedgerEntryInput = {
  pot: "vallo_revenue",
  key: "settle:tx-1:commission",
  event: "FEE_CHARGED",
  direction: "in",
  amountMinor: 200,
  currency: "NGN",
  provider: "paystack",
};

describe("the ledger vocabulary matches the database", () => {
  it("names exactly the fourteen event types the migration allows", () => {
    expect(LEDGER_EVENTS).toHaveLength(14);
    const sql = readFileSync(MIGRATION, "utf8");
    const body = /function private\.is_ledger_event[\s\S]*?select p in \(([\s\S]*?)\)\s*\n\$function\$/.exec(sql)?.[1] ?? "";
    const inDb = [...body.matchAll(/'([A-Z_]+)'/g)].map((m) => m[1]);
    expect([...inDb].sort()).toEqual([...LEDGER_EVENTS].sort());
  });

  it("keeps the three pots as three tables", () => {
    const sql = readFileSync(MIGRATION, "utf8");
    for (const pot of LEDGER_POTS) expect(sql).toContain(`create table if not exists public.ledger_${pot} (`);
    expect(sql).not.toMatch(/drop trigger|delete from/i);
  });
});

describe("ledgerEntryProblem", () => {
  it("accepts a well-formed entry", () => {
    expect(ledgerEntryProblem(ok)).toBeNull();
  });

  it("refuses what each pot may never carry", () => {
    expect(ledgerEntryProblem({ ...ok, event: "ESCROW_FUNDED" })).toMatch(/never carries ESCROW_FUNDED/);
    expect(ledgerEntryProblem({ ...ok, pot: "customer_funds", provider: "vallo" })).toMatch(/never carries a vallo/);
    expect(ledgerEntryProblem({ ...ok, pot: "marketing_float", event: "DISPUTE_OPENED" })).not.toBeNull();
  });

  it("refuses an unknown event, a bad amount, currency or key", () => {
    expect(ledgerEntryProblem({ ...ok, event: "BALANCE_ADJUSTED" as never })).toBe("unknown event type");
    expect(ledgerEntryProblem({ ...ok, amountMinor: 0 })).not.toBeNull();
    expect(ledgerEntryProblem({ ...ok, amountMinor: 1.5 })).not.toBeNull();
    expect(ledgerEntryProblem({ ...ok, currency: "naira" })).not.toBeNull();
    expect(ledgerEntryProblem({ ...ok, currency: "USD" })).toBeNull();
    expect(ledgerEntryProblem({ ...ok, key: "short" })).not.toBeNull();
  });
});
