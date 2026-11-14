import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "@/lib/testing/fake-supabase";

/**
 * ONE PROTECTED PAYMENT'S RECORD, the dispute desk (BUILD 7.11). Pinned: the
 * door is finance; the read selects and never writes; each side's statement
 * is shown in their own words; a decision is offered only while the money is
 * held or disputed, and a release only on a disputed payment.
 */
const state = vi.hoisted(() => ({ access: { state: "admin" } as unknown, service: null as unknown }));
vi.mock("@/lib/admin/guard", () => ({ requireAdmin: async () => state.access }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => state.service }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined }) }));
vi.mock("@/lib/admin/arrangement-actions", () => ({ decideArrangement: async () => ({ ok: true, data: { submitted: true } }) }));

const { readArrangementRecord, eventNotes } = await import("./read-one");
const { ArrangementRecord } = await import("./ArrangementRecord");
const { toOpsRow } = await import("./read");

const ID = "44444444-4444-4444-8444-444444444444";
const raw = { id: ID, agreement_id: "ag-1", reference: "vallo-pp-abc", provider: "escrowpay", status: "disputed", status_source: "vallo", amount_minor: 180_000_00, buyer_user_id: "payer", seller_user_id: "lister", provider_state: "funded", provider_arrangement_id: "TXN_1" };
const events = [
  { id: 1, from_status: null, to_status: "preparing", source: "vallo", refused: false, detail: {}, observed_at: "2026-11-14T09:00:00Z" },
  { id: 2, from_status: "awaiting_payment", to_status: "protected", source: "provider_webhook", provider_state: "transaction.funded", refused: false, detail: {}, observed_at: "2026-11-14T09:30:00Z" },
  { id: 3, from_status: "protected", to_status: "disputed", source: "vallo", refused: false, detail: { opened_by: "payer", statement: "The keys were never handed over." }, observed_at: "2026-11-14T10:00:00Z" },
];

function service() {
  const db = fakeSupabase({
    provider_arrangements: { select: { data: raw } },
    provider_arrangement_events: { select: { data: events } },
    profiles: { select: { data: [{ id: "payer", display_name: "Ada Obi" }, { id: "lister", display_name: "Chidi Okeke" }] } },
  });
  state.service = db.client;
  return db;
}

const words = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const draw = (status: string) =>
  renderToStaticMarkup(
    <ArrangementRecord
      locale="en"
      read={{ state: "ok", row: toOpsRow({ ...raw, status })!, agreementId: "ag-1", payerName: "Ada Obi", listerName: "Chidi Okeke", events: [{ id: "3", at: "2026-11-14T10:00:00Z", from: "protected", to: "disputed", source: "vallo", refused: false, providerState: null, notes: eventNotes(events[2]!.detail) }] }}
    />,
  );

describe("the read", () => {
  it("refuses anyone the finance door refuses, and reads nothing", async () => {
    const db = service();
    state.access = { state: "not-admin" };
    expect(await readArrangementRecord(ID)).toEqual({ state: "forbidden" });
    expect(db.calls).toHaveLength(0);
    state.access = { state: "admin" };
  });

  it("selects only: the row, both names and the trail oldest first", async () => {
    const db = service();
    const read = await readArrangementRecord(ID);
    expect(read.state).toBe("ok");
    expect(db.wrote()).toBe(false);
    if (read.state !== "ok") return;
    expect(read.payerName).toBe("Ada Obi");
    expect(read.listerName).toBe("Chidi Okeke");
    expect(read.events.map((e) => e.to)).toEqual(["preparing", "protected", "disputed"]);
    expect(read.events[2]!.notes).toEqual(["The payer said: The keys were never handed over."]);
  });

  it("says so when there is no such payment", async () => {
    state.service = fakeSupabase({ provider_arrangements: { select: { data: null } } }).client;
    expect(await readArrangementRecord(ID)).toEqual({ state: "not_found" });
  });
});

describe("the record", () => {
  it("shows both people, the amount, the partner's word, and the statement in the member's own words", () => {
    const text = words(draw("disputed"));
    expect(text).toContain("Ada Obi");
    expect(text).toContain("Chidi Okeke");
    expect(text).toContain("180,000");
    expect(text).toContain("TXN_1");
    expect(text).toContain("The payer said: The keys were never handed over.");
  });

  it("offers a refund and a release on a disputed payment, each behind a reason", () => {
    const out = draw("disputed");
    expect(out).toContain('data-testid="arrangement-decide-refund"');
    expect(out).toContain('data-testid="arrangement-decide-release"');
    /* Neither can be pressed before a reason is given. */
    expect(out).toMatch(/data-testid="arrangement-decide-refund"[^>]*disabled|disabled[^>]*data-testid="arrangement-decide-refund"/);
  });

  it("offers only a refund while the money is simply held: the release there is the payer's own", () => {
    const out = draw("protected");
    expect(out).toContain('data-testid="arrangement-decide-refund"');
    expect(out).not.toContain('data-testid="arrangement-decide-release"');
  });

  it.each(["awaiting_payment", "released", "refunded", "refund_requested", "cancelled"])("offers no decision on a payment that is %s", (status) => {
    const out = draw(status);
    expect(out).not.toContain('data-testid="arrangement-decision"');
    expect(words(out)).toContain("No decision to make");
  });

  it("draws nothing of the record for someone the door refused", () => {
    const out = renderToStaticMarkup(<ArrangementRecord locale="en" read={{ state: "forbidden" }} />);
    expect(words(out)).toContain("Finance only");
    expect(out).not.toContain('data-testid="arrangement-record"');
  });
});

describe("what an event carried", () => {
  it("is read as plain lines, and the machine's own keys are left out", () => {
    expect(eventNotes({ instructed_by: "staff-1", reason: "The handover never took place." })).toEqual(["Staff reason: The handover never took place."]);
    expect(eventNotes({ opened_by: "lister", statement: "The payer has the keys." })).toEqual(["The lister said: The payer has the keys."]);
    expect(eventNotes({ agreement_id: "x", accepted_version: 2 })).toEqual([]);
    expect(eventNotes(null)).toEqual([]);
  });
});
