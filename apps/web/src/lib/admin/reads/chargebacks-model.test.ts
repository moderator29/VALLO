import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getDictionary } from "@vallo/i18n";
import {
  CHARGEBACK_STATES,
  HELD_CLAIM_STATUSES,
  ageBucket,
  baseFromRpc,
  chargebacksHref,
  countChargebacks,
  deadlineOf,
  entryFromAudit,
  entryFromEvent,
  heldSubjectsFrom,
  isMissingFunction,
  moveArgs,
  movesFor,
  narrowChargebacks,
  noticesForMove,
  outstandingMinor,
  readChargebackQuery,
  type ChargebackRow,
  type ChargebackState,
} from "./chargebacks-model";
import { noticeRowsFor } from "./chargebacks-notices";
import { ROWS, NOW } from "@/app/(dev)/preview/chargebacks/fixtures";
import { holdFromPredicate, holdFromSummary } from "@/lib/money/chargeback-hold-model";

const MIGRATION = readFileSync(
  join(__dirname, "../../../../../../supabase/migrations/20261006093655_chargebacks_record_state_recovery_and_payout_hold.sql"),
  "utf8",
);

/** The desk grid as `public.chargeback_move` writes it, read from the migration itself. */
function sqlGrid(): Map<ChargebackState, Set<ChargebackState>> {
  const grid = new Map<ChargebackState, Set<ChargebackState>>();
  const re = /\(cb\.state = '(\w+)' and nxt (?:in \(([^)]*)\)|= '(\w+)')\)/g;
  for (const m of MIGRATION.matchAll(re)) {
    const from = m[1] as ChargebackState;
    const to = (m[2] ? m[2].split(",").map((s) => s.trim().replace(/'/g, "")) : [m[3]!]) as ChargebackState[];
    grid.set(from, new Set(to));
  }
  return grid;
}

const STATE_OF: Record<string, ChargebackState> = {
  request_evidence: "evidence_requested",
  submit_evidence: "evidence_submitted",
  won: "won",
  lost: "lost",
  reverse_to_won: "won",
  reopen_lost: "lost",
};

describe("the moves the desk offers", () => {
  const grid = sqlGrid();

  it("reads the grid from the migration (five states)", () => {
    expect([...grid.keys()].sort()).toEqual([...CHARGEBACK_STATES].sort());
  });

  for (const state of CHARGEBACK_STATES) {
    it(`offers only state changes the database allows from ${state}`, () => {
      const recovery = state === "lost" ? "owed" : "none";
      const offers = movesFor({ state, recoveryState: recovery, recoveredMinor: 0, amountMinor: 1000 });
      const targets = offers.map((o) => STATE_OF[o.key]).filter(Boolean);
      for (const target of targets) expect(grid.get(state)!.has(target!)).toBe(true);
      /* And every state the grid allows is on offer. */
      for (const allowed of grid.get(state)!) expect(targets).toContain(allowed);
    });
  }

  it("a lost case still owed offers recovery, write off and, while nothing came back, the reversal", () => {
    const keys = (recovered: number) => movesFor({ state: "lost", recoveryState: "owed", recoveredMinor: recovered, amountMinor: 1000 }).map((o) => o.key);
    expect(keys(0)).toEqual(["record_recovery", "mark_recovered", "write_off", "reverse_to_won"]);
    expect(keys(400)).toEqual(["record_recovery", "mark_recovered", "write_off"]);
  });

  it("written off reopens; recovered is closed", () => {
    expect(movesFor({ state: "lost", recoveryState: "written_off", recoveredMinor: 0, amountMinor: 1 }).map((o) => o.key)).toEqual(["reopen_recovery"]);
    expect(movesFor({ state: "lost", recoveryState: "recovered", recoveredMinor: 1, amountMinor: 1 })).toEqual([]);
  });

  it("sends what the function expects", () => {
    expect(moveArgs({ key: "request_evidence", evidenceDueAt: "2026-10-20T10:00:00.000Z" }, 1)).toEqual({ p_to_state: "evidence_requested", p_evidence_due_at: "2026-10-20T10:00:00.000Z" });
    expect(moveArgs({ key: "lost" }, 500)).toEqual({ p_to_state: "lost" });
    expect(moveArgs({ key: "lost", alreadyRecovered: true }, 500)).toEqual({ p_to_state: "lost", p_recovered_total_minor: 500 });
    expect(moveArgs({ key: "record_recovery", recoveredTotalMinor: 300 }, 500)).toEqual({ p_recovered_total_minor: 300 });
    expect(moveArgs({ key: "write_off" }, 500)).toEqual({ p_recovery: "written_off" });
    expect(moveArgs({ key: "reopen_recovery" }, 500)).toEqual({ p_recovery: "owed" });
    expect(moveArgs({ key: "reverse_to_won" }, 500)).toEqual({ p_to_state: "won" });
  });
});

describe("the read model", () => {
  it("reads an RPC row and drops one it cannot", () => {
    const row = baseFromRpc({ id: "a", state: "lost", recovery_state: "owed", amount_minor: 5000, recovered_minor: 1000, reference: "R", opened_at: "2026-10-01T00:00:00Z" });
    expect(row?.state).toBe("lost");
    expect(outstandingMinor(row!)).toBe(4000);
    expect(baseFromRpc({ id: "a", state: "pending" })).toBeNull();
    expect(baseFromRpc(null)).toBeNull();
  });

  it("counts per state, the owed hold and the undecided", () => {
    const c = countChargebacks(ROWS);
    expect(c.all).toBe(ROWS.length);
    expect(c.owed).toBe(1);
    expect(c.undecided).toBe(4);
    expect(c.lost).toBe(2);
  });

  it("narrows by state, owed, amount, age, booking and reference", () => {
    const by = (p: Record<string, string>) => narrowChargebacks(ROWS, readChargebackQuery(p), NOW).map((r: ChargebackRow) => r.id);
    expect(by({ state: "won" })).toHaveLength(1);
    expect(by({ state: "owed" })).toEqual([ROWS[3]!.id]);
    expect(by({ min: "200000" })).toEqual([ROWS[1]!.id, ROWS[3]!.id]);
    expect(by({ max: "70000" })).toEqual([ROWS[4]!.id]);
    expect(by({ age: "week" }).length).toBeGreaterThan(0);
    for (const id of by({ age: "older" })) expect(ageBucket(ROWS.find((r) => r.id === id)!.openedAt, NOW)).toBe("older");
    expect(by({ booking: ROWS[2]!.bookingId! })).toEqual([ROWS[2]!.id]);
    expect(by({ q: ROWS[0]!.providerDisputeId.toLowerCase() })).toEqual([ROWS[0]!.id]);
  });

  it("drops filters it cannot read, so a hand-edited address never errors", () => {
    expect(readChargebackQuery({ state: "maybe", min: "abc", age: "year", booking: "nope" })).toEqual({ state: null, min: null, max: null, age: null, booking: null, q: null });
    expect(chargebacksHref("/admin/chargebacks", readChargebackQuery({ state: "lost", min: "1000" }))).toBe("/admin/chargebacks?state=lost&min=1000");
  });

  it("reads the evidence deadline only while undecided", () => {
    expect(deadlineOf(ROWS[0]!, NOW)).toBe("overdue");
    expect(deadlineOf(ROWS[1]!, NOW)).toBe("due");
    expect(deadlineOf({ state: "won", evidenceDueAt: "2020-01-01T00:00:00Z" }, NOW)).toBe("none");
  });

  it("reads the timeline from the draft events and, until then, the audit log", () => {
    expect(entryFromEvent({ id: "e", kind: "note", from_state: "lost", to_state: "lost", note: "sent", has_raw: false, created_at: "x" })?.kind).toBe("note");
    const audit = entryFromAudit({ id: "a", action: "chargeback.moved", actor_id: null, created_at: "x", metadata: { from: "opened", to: "lost", recovery_to: "owed", recovered_from: 0, recovered_to: 0 } }, "lost");
    expect(audit).toMatchObject({ from: "opened", to: "lost", recovery: "owed", recoveredMinor: null });
    expect(entryFromAudit({ id: "b", action: "something.else" }, "lost")).toBeNull();
    expect(isMissingFunction({ code: "PGRST202" })).toBe(true);
    expect(isMissingFunction({ code: "42501" })).toBe(false);
  });
});

describe("who is told", () => {
  it("tells the lister of a request for evidence, both sides of the first decision, the lister alone of a reversal", () => {
    expect(noticesForMove({ state: "opened", recoveryState: "none" }, { state: "evidence_requested", recoveryState: "none" })).toEqual([{ to: "lister", key: "evidence" }]);
    expect(noticesForMove({ state: "evidence_submitted", recoveryState: "none" }, { state: "evidence_requested", recoveryState: "none" })).toEqual([{ to: "lister", key: "evidence" }]);
    expect(noticesForMove({ state: "opened", recoveryState: "none" }, { state: "evidence_submitted", recoveryState: "none" })).toEqual([]);
    expect(noticesForMove({ state: "evidence_submitted", recoveryState: "none" }, { state: "lost", recoveryState: "owed" })).toEqual([
      { to: "lister", key: "lost" },
      { to: "payer", key: "payerDecided" },
    ]);
    expect(noticesForMove({ state: "opened", recoveryState: "none" }, { state: "lost", recoveryState: "recovered" })[0]).toEqual({ to: "lister", key: "lostRecovered" });
    expect(noticesForMove({ state: "lost", recoveryState: "owed" }, { state: "won", recoveryState: "none" })).toEqual([{ to: "lister", key: "won" }]);
    expect(noticesForMove({ state: "lost", recoveryState: "owed" }, { state: "lost", recoveryState: "written_off" })).toEqual([{ to: "lister", key: "cleared" }]);
    expect(noticesForMove({ state: "lost", recoveryState: "written_off" }, { state: "lost", recoveryState: "owed" })).toEqual([{ to: "lister", key: "reowed" }]);
  });

  it("writes rows of kind booking that link to the screens, dropping anybody not on the charge", () => {
    const rows = noticeRowsFor(
      [{ to: "lister", key: "lost" }, { to: "payer", key: "payerDecided" }],
      { listerId: "L", payerId: null, bookingId: "B" },
      2_500_000,
      "NGN",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ user_id: "L", kind: "booking", href: "/payouts#chargeback" });
    expect(rows[0]!.body).toContain("25,000");
    const payer = noticeRowsFor([{ to: "payer", key: "payerDecided" }], { listerId: null, payerId: "P", bookingId: "B" }, 100, "NGN");
    expect(payer[0]!.href).toBe("/bookings/B");
  });
});

describe("the lister's hold", () => {
  it("is held only when the summary says so, with the owed total", () => {
    expect(holdFromSummary({ held: true, owed_minor: 2500, count: 1, currency: "NGN", open_count: 0 })).toMatchObject({ state: "held", owedMinor: 2500 });
    expect(holdFromSummary({ held: false, open_count: 2 })).toEqual({ state: "open", openCount: 2 });
    expect(holdFromSummary({ held: false, open_count: 0 })).toEqual({ state: "none" });
    expect(holdFromSummary("garbage")).toEqual({ state: "none" });
    expect(holdFromPredicate(true)).toMatchObject({ state: "held", owedMinor: null });
    expect(holdFromPredicate(false)).toEqual({ state: "none" });
  });
});

describe("what the payout rule holds (migration cbh01)", () => {
  it("shapes escrow payments and Rewards payouts, marks the overridden ones, and drops malformed rows", () => {
    const held = heldSubjectsFrom(
      [{ id: "a1", reference: "vallo-arr-1", amount_minor: "45000000", status: "protected" }, { id: 7 }],
      [
        { id: "p1", reference: "vallo-rw-1", amount_minor: 150000, status: "under_review" },
        { id: "p2", reference: "x", amount_minor: "n/a", status: "processing" },
      ],
      new Set(["p1"]),
    );
    expect(held).toEqual([
      { kind: "arrangement", id: "a1", reference: "vallo-arr-1", amountMinor: 45_000_000, status: "protected", overridden: false },
      { kind: "rewards_payout", id: "p1", reference: "vallo-rw-1", amountMinor: 150_000, status: "under_review", overridden: true },
    ]);
  });
});

describe("Guarantee claim payouts pause too (migration fm02)", () => {
  const FM02 = readFileSync(
    join(__dirname, "../../../../../../supabase/migrations/20261013205130_fm02_guarantee_claim_payouts_chargeback_hold.sql"),
    "utf8",
  );

  it("holds the lister's unpaid claims: the approved amount once there is one, what was asked until then", () => {
    const held = heldSubjectsFrom([], [], new Set(["c2"]), [
      { id: "c1", status: "submitted", requested_minor: 2_000_000, approved_minor: null },
      { id: "c2", status: "approved", requested_minor: 2_000_000, approved_minor: "1500000" },
      { id: "c3", status: "submitted", requested_minor: "n/a", approved_minor: null },
      null,
    ]);
    expect(held).toEqual([
      { kind: "guarantee_claim", id: "c1", reference: "c1", amountMinor: 2_000_000, status: "submitted", overridden: false },
      { kind: "guarantee_claim", id: "c2", reference: "c2", amountMinor: 1_500_000, status: "approved", overridden: true },
    ]);
    expect([...HELD_CLAIM_STATUSES]).toEqual(["submitted", "approved"]);
  });

  it("gates deciding to pay and marking paid in the database, behind a per-claim finance override", () => {
    const decide = FM02.slice(FM02.indexOf("function public.admin_decide_guarantee_claim"), FM02.indexOf("function public.admin_mark_guarantee_claim_paid"));
    const paid = FM02.slice(FM02.indexOf("function public.admin_mark_guarantee_claim_paid"), FM02.indexOf("function public.admin_chargeback_hold_override"));
    for (const body of [decide, paid]) {
      expect(body).toMatch(/private\.chargeback_hold_blocks\('guarantee_claim', c\.id, c\.claimant_id\)/);
      expect(body).toMatch(/private\.chargeback_hold_refused\('guarantee_claim'/);
      expect(body).toMatch(/'status', 'chargeback_hold'/);
    }
    // Rejecting pays nothing: the gate sits on the approve branch only.
    expect(decide.indexOf("chargeback_hold_blocks")).toBeGreaterThan(decide.indexOf("if p_decision = 'reject' then\n    update"));
    expect(FM02).toMatch(/p_kind not in \('arrangement', 'rewards_payout', 'guarantee_claim'\)/);
    expect(FM02).not.toMatch(/\bdrop\s+(table|function|constraint|trigger|index)\b/i);
    expect(FM02).not.toMatch(/\bdelete\s+from\b/i);
  });

  it("names the claim kind and its statuses on the desk, and tells the lister what pauses in four languages", () => {
    const en = getDictionary("en").chargebacks;
    expect(en.override.kinds.guarantee_claim).toBeTruthy();
    for (const status of HELD_CLAIM_STATUSES) expect((en.override.statuses as Record<string, string>)[status]).toBeTruthy();
    expect(en.override.claimHeld.approve).toMatch(/override this one claim/);
    expect(en.override.claimHeld.markPaid).toMatch(/override this one claim/);
    /* The Vallo Guarantee was retired on 9 November 2026 (FOUNDER_DECISIONS):
       the lister is told what pauses, and the sentence no longer names it.
       The desk above still names old claims, which are a historical record. */
    for (const locale of ["en", "yo", "ig", "ha"] as const) {
      const means = getDictionary(locale).chargebacks.hold.means;
      expect(means).toMatch(/pauses withdrawals/);
      expect(means).not.toMatch(/Guarantee/i);
    }
  });
});
