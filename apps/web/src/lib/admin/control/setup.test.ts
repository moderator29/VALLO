import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SETUP_ITEMS, SWITCH_NOTES, orderSetup, readConnections, readSwitches, setupFileHref, setupStateFrom } from "./setup";

const MIGRATIONS = join(__dirname, "..", "..", "..", "..", "..", "..", "supabase", "migrations");

describe("the control room's database register", () => {
  it("names a real file for every part, and each key once", () => {
    for (const item of SETUP_ITEMS) expect(existsSync(join(MIGRATIONS, item.file)), item.file).toBe(true);
    expect(new Set(SETUP_ITEMS.map((i) => i.key)).size).toBe(SETUP_ITEMS.length);
  });

  it("links a file on the main branch, never a local path", () => {
    expect(setupFileHref("pending/x.sql")).toBe("https://github.com/moderator29/VALLO/blob/main/supabase/migrations/pending/x.sql");
  });

  it("reads a missing table or column as waiting, no error as ready, and anything else as unknown", () => {
    expect(setupStateFrom(null)).toBe("ready");
    for (const code of ["42P01", "42703", "PGRST205", "PGRST204"]) expect(setupStateFrom({ code })).toBe("waiting");
    expect(setupStateFrom({ code: "57014" })).toBe("unknown");
    expect(setupStateFrom({ message: "fetch failed" })).toBe("unknown");
  });

  it("puts what is waiting first, then what could not be read, then what is ready", () => {
    const [a, b, c] = SETUP_ITEMS;
    const ordered = orderSetup([
      { item: a!, state: "ready" },
      { item: b!, state: "unknown" },
      { item: c!, state: "waiting" },
    ]);
    expect(ordered.map((r) => r.state)).toEqual(["waiting", "unknown", "ready"]);
  });
});

describe("the control room's switches", () => {
  it("says on, off, or not set for each switch it explains", () => {
    const readings = readSwitches([
      { key: "phone_confirmation", enabled: true },
      { key: "wallet", enabled: false },
    ]);
    const state = (key: string) => readings.find((r) => r.note.key === key)!.state;
    expect(state("phone_confirmation")).toBe("on");
    expect(state("wallet")).toBe("off");
    expect(state("payments_escrowpay_on")).toBe("missing");
    expect(readings).toHaveLength(SWITCH_NOTES.length);
  });

  it("says in the phone switch's own words that only a payment and a listing ask", () => {
    const note = SWITCH_NOTES.find((n) => n.key === "phone_confirmation")!;
    expect(note.on).toContain("first payment");
    expect(note.on).toContain("first listing");
  });
});

describe("the control room's services", () => {
  const all = { codesNigeria: true, codesAbroad: true, paymentPartner: true, paymentPartnerWebhook: true, cardPayments: true, email: true, copilot: true, onCallPage: true };

  it("says members abroad are not asked for a phone while no code can be sent abroad", () => {
    const abroad = readConnections({ ...all, codesAbroad: false }).find((c) => c.key === "codes_abroad")!;
    expect(abroad.ready).toBe(false);
    expect(abroad.meaning).toContain("members abroad are not asked for a phone");
  });

  it("calls the payment partner ready only with both its key and its webhook secret", () => {
    const partner = (input: Partial<typeof all>) => readConnections({ ...all, ...input }).find((c) => c.key === "partner")!;
    expect(partner({}).ready).toBe(true);
    expect(partner({ paymentPartnerWebhook: false }).ready).toBe(false);
    expect(partner({ paymentPartnerWebhook: false }).meaning).toContain("webhook secret is missing");
    expect(partner({ paymentPartner: false }).ready).toBe(false);
  });

  it("never prints a key, a name or a value", () => {
    const text = JSON.stringify(readConnections(all));
    expect(text).not.toMatch(/sk_|whsec_|AC[0-9a-f]{8}|@/);
  });
});
