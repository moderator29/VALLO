import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getDictionary } from "@vallo/i18n";

/**
 * THE FOUNDER'S THREE RULINGS OF 13 OCTOBER 2026, PROVEN.
 *
 *   NO ENUMERATION  a number on another account and a number that cannot be
 *                   used read the same, in the same shape, in every language.
 *   TESTERS EXEMPT  a QA account is never asked for a phone, at any moment,
 *                   even when a read fails.
 *   FULL GATE       the first message, visit, booking, payment and listing
 *                   ask, with the flag on, and nothing asks with it off.
 */

const flag = { on: true };
const qaIds = new Set<string>();
vi.mock("./flag", () => ({ phoneConfirmationOn: async () => flag.on, PHONE_FLAG_KEY: "phone_confirmation" }));
vi.mock("./qa", () => ({ isQaTester: async (id: string) => qaIds.has(id) }));
vi.mock("../locale", () => ({ getLocale: async () => "en" }));

const { decidePhoneGate, phoneGateFor } = await import("./gate");
const { runSendCode } = await import("./send");
const { PHONE_MOMENTS, failsClosed, memberConfirmRefusal, memberIssueRefusal } = await import("./core");
const { capturingTransport } = await import("./transport");

const MEMBER = "11111111-1111-4111-8111-111111111111";
const QA_MEMBER = "957b3bd2-cce3-425d-bba9-5cd876ca3d62";
const NEW_MOMENTS = ["message", "booking", "payment", "listing"] as const;
const LOCALES = ["en", "yo", "ig", "ha"] as const;
const en = getDictionary("en").trustVisible.phone;

/** A stand-in for the member's Supabase client: no phone, no earlier actions. */
function fakeDb(opts: { phone?: boolean; prior?: number; fail?: boolean } = {}) {
  const answer = () => {
    if (opts.fail) return { data: null, count: null, error: { message: "down" } };
    /* The report count reads rows (to leave out danger reports), the rest count. */
    const rows = Array.from({ length: opts.prior ?? 0 }, () => ({ category: "scam", reason: "they asked first" }));
    return { data: rows, count: opts.prior ?? 0, error: null };
  };
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "eq", "in", "not", "limit"]) chain[m] = () => chain;
  chain.maybeSingle = async () => {
    const a = answer();
    return { data: opts.fail ? null : opts.phone ? { user_id: MEMBER } : null, error: a.error };
  };
  chain.then = (resolve: (v: unknown) => unknown) => resolve(answer());
  /* The caller's paid deposits and plans, counted by one definer function. */
  const rpc = async () => {
    const a = answer();
    return { data: a.error ? null : 0, error: a.error };
  };
  return { from: () => chain, rpc };
}

beforeEach(() => {
  flag.on = true;
  qaIds.clear();
});

describe("no enumeration", () => {
  it.each(LOCALES)("%s: no phone sentence says a number is on another account", (locale) => {
    const phone = getDictionary(locale).trustVisible.phone as Record<string, string>;
    expect(phone.numberRefused).toBeTruthy();
    expect(phone).not.toHaveProperty("sendTaken");
    expect(phone).not.toHaveProperty("confirmTaken");
    expect(phone).not.toHaveProperty("sendInvalid");
    if (locale === "en") {
      for (const words of Object.values(phone)) expect(words).not.toMatch(/another (Vallo )?account/i);
    }
    /* A refused profile number reads the same as a refused code. */
    expect(phone.profileRefused).toBe(phone.numberRefused);
  });

  it("taken and invalid are one answer, in one shape, with the reason kept for staff only", async () => {
    const deps = (answer: string) => ({
      randomInt: () => 4,
      issue: async () => answer,
      transport: capturingTransport([]),
      allow: async () => true,
    });
    const taken = await runSendCode(deps("taken"), MEMBER, "+2348031234567");
    const invalid = await runSendCode(deps("invalid"), MEMBER, "+2348031234567");
    expect(taken).toEqual({ ok: false, reason: "refused", staffReason: "taken" });
    expect(invalid).toEqual({ ok: false, reason: "refused", staffReason: "invalid" });
    expect(Object.keys(taken).sort()).toEqual(Object.keys(invalid).sort());
    expect(memberIssueRefusal("taken")).toBe(memberIssueRefusal("invalid"));
    expect(memberIssueRefusal("already")).toBe("already");
    expect(memberConfirmRefusal("taken")).toBe("refused");
  });

  it("the send and confirm actions show the same words for taken and invalid, on the number field too", () => {
    const src = readFileSync(join(__dirname, "actions.ts"), "utf8");
    expect(src).toContain("refused: copy.numberRefused");
    expect(src).toContain("fail(copy.numberRefused, { phone: copy.numberRefused })");
    expect(src).not.toMatch(/sendTaken|confirmTaken|sendInvalid/);
    /* The real reason goes to staff after the reply, so the timing does not tell. */
    expect(src).toContain("after(() => recordNumberRefused(userId, reason))");
    expect(src).toContain('after(() => recordNumberRefused(userId, "taken_on_confirm"))');
  });

  it("the staff trail keeps the reason and no digits of the number", () => {
    const src = readFileSync(join(__dirname, "staff-trail.ts"), "utf8");
    expect(src).toContain('action: NUMBER_REFUSED_ACTION');
    expect(src).toContain("metadata: { reason }");
    expect(src).not.toMatch(/phone:|last4|e164/);
    const person = readFileSync(join(__dirname, "../admin/member-queries.ts"), "utf8");
    expect(person).toContain('.eq("action", "phone.number_refused")');
  });
});

describe("the full gate, each moment", () => {
  it.each(PHONE_MOMENTS)("%s asks the first time with the flag on, and never with it off", async (moment) => {
    const required = await phoneGateFor(fakeDb(), MEMBER, moment);
    expect(required).toEqual({ ok: false, error: en.required, gate: "phone" });
    flag.on = false;
    expect(await phoneGateFor(fakeDb(), MEMBER, moment)).toBeNull();
  });

  it.each(PHONE_MOMENTS)("%s never asks a member with a confirmed phone, or one past their first", async (moment) => {
    expect(await phoneGateFor(fakeDb({ phone: true }), MEMBER, moment)).toBeNull();
    expect(await phoneGateFor(fakeDb({ prior: 2 }), MEMBER, moment)).toBeNull();
  });

  it("a danger report is never held", async () => {
    expect(await phoneGateFor(fakeDb(), MEMBER, "report", "unsafe")).toBeNull();
  });

  it.each(NEW_MOMENTS)("%s on a failed read: payment and listing fail closed with a try-again, the rest stay open", async (moment) => {
    const answer = await phoneGateFor(fakeDb({ fail: true }), MEMBER, moment);
    if (failsClosed(moment)) {
      expect(answer).toEqual({ ok: false, error: en.readFailed });
      expect(answer).not.toHaveProperty("gate");
    } else {
      expect(answer).toBeNull();
    }
  });
});

describe("testers are exempt at every gate", () => {
  it.each(PHONE_MOMENTS)("%s never asks a QA account", async (moment) => {
    qaIds.add(QA_MEMBER);
    expect(await phoneGateFor(fakeDb(), QA_MEMBER, moment)).toBeNull();
  });

  it.each(PHONE_MOMENTS)("%s never stops a QA account even when the reads fail", async (moment) => {
    qaIds.add(QA_MEMBER);
    expect(await phoneGateFor(fakeDb({ fail: true }), QA_MEMBER, moment)).toBeNull();
  });

  it("the decision asks the QA question before the first-of-its-kind count", async () => {
    const prior = vi.fn(async () => 0);
    const verdict = await decidePhoneGate(
      { flagOn: async () => true, confirmed: async () => false, qa: async () => true, prior },
      QA_MEMBER,
      "payment",
    );
    expect(verdict).toEqual({ kind: "open" });
    expect(prior).not.toHaveBeenCalled();
  });

  it("the QA check is read on the server from the session's user id, with the two ids as the floor", () => {
    const src = readFileSync(join(__dirname, "qa.ts"), "utf8");
    expect(src).toContain('import "server-only"');
    expect(src).toContain('.from("qa_accounts")');
    expect(src).toContain("QA_ACCOUNT_IDS");
    const gate = readFileSync(join(__dirname, "gate.ts"), "utf8");
    expect(gate).toContain("qa: isQaTester");
  });

  it("the phone page and the settings door leave a tester alone", () => {
    const root = join(__dirname, "..", "..");
    const page = readFileSync(join(root, "app/(app)/settings/phone/page.tsx"), "utf8");
    expect(page).toContain("isQaTester(session.user.id)");
    expect(page).toContain("copy.qaBody");
    const hub = readFileSync(join(root, "app/(app)/settings/page.tsx"), "utf8");
    expect(hub).toContain("!(await isQaTester(profile?.userId))");
  });

  it("video calls carry no phone gate: an email-only tester can start and join", () => {
    const root = join(__dirname, "..", "..");
    const calls = readFileSync(join(root, "lib/calls/actions.ts"), "utf8");
    expect(calls).not.toMatch(/phoneGateFor|confirmed_phones/);
  });
});

describe("the wiring: every new moment is gated on the server, before the write", () => {
  const root = join(__dirname, "..", "..");
  const cases: [string, string, string][] = [
    ["lib/messages/actions.ts", "async function findOrStartConversation", '"message"'],
    ["lib/messages/actions.ts", "async function sendMessageWork", '"message", {'],
    ["lib/messages/direct-actions.ts", "export async function sendDirectMessage", '"message"'],
    ["lib/venue-messages/actions.ts", "export async function messageVenue", '"message"'],
    ["lib/bookings/actions.ts", "export async function reserve", '"booking"'],
    ["lib/stays/room-booking-actions.ts", "export async function requestRoomStay", '"booking"'],
    ["lib/reservations/actions.ts", "export async function reserveTable", '"booking"'],
    ["lib/bookings/checkout.ts", "async function guardPayable", '"payment"'],
    ["lib/rent/actions.ts", "export async function startRentPayment", '"payment"'],
    ["lib/crypto/actions.ts", "export async function startCryptoPayment", '"payment"'],
    ["lib/money/fund-actions.ts", "export async function fundEscrowPayment", '"payment"'],
    ["lib/tenancy/share-checkout.ts", "export async function startShareCheckout", '"payment"'],
    ["lib/subscriptions/actions.ts", "export async function startSubscriptionCheckout", '"payment"'],
    ["lib/reservations/deposit-actions.ts", "export async function payReservationDeposit", '"payment"'],
    ["lib/reservations/seating-actions.ts", "export async function payTableBill", '"payment"'],
    ["lib/agent/listings-actions.ts", "export async function submitListing", '"listing"'],
    ["lib/host/actions.ts", "export async function submitHostApplication", '"listing"'],
  ];
  it.each(cases)("%s %s", (file, fn, moment) => {
    const src = readFileSync(join(root, file), "utf8");
    const body = src.slice(src.indexOf(fn));
    expect(src.indexOf(fn)).toBeGreaterThanOrEqual(0);
    const gate = body.indexOf(`, ${moment}`);
    expect(gate).toBeGreaterThan(0);
    expect(body.slice(0, gate)).toContain("phoneGateFor(");
    for (const write of [".insert(", ".update(", 'rpc("', "openCheckout(", "startPayment(", "stage("]) {
      const at = body.indexOf(write);
      if (at > 0 && at < 4000) expect(gate).toBeLessThan(at);
    }
  });

  it("a refusal keeps its button when it passes through another action", () => {
    for (const file of ["lib/messages/actions.ts", "lib/messages/direct-actions.ts", "lib/venue-messages/actions.ts"]) {
      const src = readFileSync(join(root, file), "utf8");
      expect(src).toContain("if (!sent.ok) return sent;");
      expect(src).not.toContain("if (!sent.ok) return fail(sent.error, sent.fieldErrors);");
    }
  });

  it("the button returns the member to where they were", () => {
    const link = readFileSync(join(root, "components/app/PhoneGateLink.tsx"), "utf8");
    expect(link).toContain('withNext("/settings/phone", here)');
    const form = readFileSync(join(root, "app/(app)/settings/phone/PhoneConfirmForm.tsx"), "utf8");
    expect(form).toContain("router.push(returnTo)");
    const page = readFileSync(join(root, "app/(app)/settings/phone/page.tsx"), "utf8");
    expect(page).toContain("<PhoneConfirmForm copy={copy} next={next} />");
  });
});
