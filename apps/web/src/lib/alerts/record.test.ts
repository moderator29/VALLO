import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The alert writer is the one thing every failing job calls, so it is the one
 * thing that must not itself fail loudly, and must not carry a person into a
 * table every admin reads.
 */

const inserted: unknown[] = [];
let insertError: { code: string; message: string } | null = null;
let existing: { id: string } | null = null;
let throwOnClient = false;

vi.mock("../supabase/env", () => ({
  isSupabaseConfigured: () => true,
}));

vi.mock("../supabase/admin", () => ({
  createAdminClient: () => {
    if (throwOnClient) throw new Error("no client");
    const lookup = {
      select: () => lookup,
      eq: () => lookup,
      is: () => lookup,
      gte: () => lookup,
      order: () => lookup,
      limit: () => lookup,
      maybeSingle: async () => ({ data: existing, error: null }),
      /* The fold touches the open alert's `last_seen_at` (R-04 dedup). */
      update: () => ({ eq: async () => ({ error: null }) }),
      insert: (row: unknown) => {
        inserted.push(row);
        return {
          select: () => ({
            single: async () =>
              insertError ? { data: null, error: insertError } : { data: { id: "alert-1" }, error: null },
          }),
        };
      },
    };
    return { from: () => lookup };
  },
}));

import { alertDescription, alertTitle, recordAlert, scrubDetail } from "./record";

describe("scrubDetail", () => {
  it("drops keys that name a person or a credential", () => {
    const out = scrubDetail({
      reference: "rm-fund-1",
      customerEmail: "ada@example.com",
      account_number: "0123456789",
      signature: "abc",
      authorization_code: "AUTH_x",
      display_name: "Ada",
      amount_minor: 150000,
    });
    expect(out).toEqual({ reference: "rm-fund-1", amount_minor: 150000 });
  });

  it("cuts long strings and flattens nested values", () => {
    const out = scrubDetail({ long: "x".repeat(500), nested: { a: 1 }, list: [1, 2] });
    expect((out.long as string).length).toBe(203);
    expect(out.nested).toBe('{"a":1}');
    expect(out.list).toBe("[1,2]");
  });
});

describe("alertTitle and alertDescription", () => {
  it("turns the token into words and keeps the token on the first line", () => {
    expect(alertTitle("webhook.signature_invalid")).toBe("Webhook: signature invalid");
    expect(alertTitle("cron.hold_sweep.failed")).toBe("Cron: hold sweep, failed");
    const description = alertDescription("cron.hold_sweep", { released: 3 });
    expect(description.split("\n")[0]).toBe("cron.hold_sweep");
    expect(description).toContain('"released":3');
  });
});

describe("recordAlert", () => {
  beforeEach(() => {
    inserted.length = 0;
    insertError = null;
    existing = null;
    throwOnClient = false;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("writes one row with the mapped severity and the subject", async () => {
    const out = await recordAlert({
      kind: "webhook.settlement_failed",
      severity: "critical",
      detail: { reference: "rm-bk-1", customerEmail: "ada@example.com" },
      subjectId: "rm-bk-1",
    });
    expect(out).toEqual({ ok: true, id: "alert-1", deduplicated: false });
    expect(inserted).toHaveLength(1);
    const row = inserted[0] as Record<string, unknown>;
    expect(row.severity).toBe("high");
    expect(row.status).toBe("open");
    expect(row.entity_type).toBe("webhook");
    expect(row.entity_id).toBe("rm-bk-1");
    expect(String(row.description)).not.toContain("ada@example.com");
  });

  it("folds a repeat into the open alert it repeats", async () => {
    existing = { id: "alert-open" };
    const out = await recordAlert({ kind: "cron.no_show", severity: "warning", detail: {} });
    expect(out).toEqual({ ok: true, id: "alert-open", deduplicated: true });
    expect(inserted).toHaveLength(0);
  });

  it("never throws: an insert error is returned", async () => {
    insertError = { code: "42501", message: "denied" };
    const out = await recordAlert({ kind: "cron.drift", severity: "info", detail: {} });
    expect(out.ok).toBe(false);
  });

  it("never throws: a client that cannot be built is returned", async () => {
    throwOnClient = true;
    const out = await recordAlert({ kind: "cron.drift", severity: "info", detail: {} });
    expect(out).toEqual({ ok: false, reason: "no client" });
  });

  it("says so without the service key rather than pretending", async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "";
    const out = await recordAlert({ kind: "cron.drift", severity: "info", detail: {} });
    expect(out).toEqual({ ok: false, reason: "service_role_not_configured" });
    expect(inserted).toHaveLength(0);
  });

  it("refuses an empty kind", async () => {
    expect(await recordAlert({ kind: "  ", severity: "info", detail: {} })).toEqual({
      ok: false,
      reason: "kind_missing",
    });
  });
});
