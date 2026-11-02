import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { AUTO_REPORT_PREFIX, countsAsOwnReport, generateCode, otpMessage, phoneGateNeeded, isConfirmOutcome } from "./core";
import { runSendCode, type SendDeps } from "./send";
import { capturingTransport, otpTransport, unconfiguredTransport, type CapturedMessage } from "./transport";

/**
 * V-50 PROVEN END TO END WITH THE STUB. The database half (hashing, attempts,
 * one number per account, the badge) is proven by the rolled-back probe; this
 * proves the application half with the capturing transport and an in-memory
 * stand-in for `phone_otp_issue` and `confirm_phone` that hashes exactly as
 * the SQL does: sha256(user_id + ":" + code), hex.
 */

function fakeDatabase() {
  const otps = new Map<string, { phone: string; hash: string; attempts: number }>();
  const confirmed = new Map<string, string>();
  const hash = (user: string, code: string) => createHash("sha256").update(`${user}:${code}`).digest("hex");
  return {
    confirmed,
    issue: async (user: string, phone: string, code: string) => {
      for (const [other, p] of confirmed) if (p === phone && other !== user) return "taken";
      if (confirmed.get(user) === phone) return "already";
      otps.set(user, { phone, hash: hash(user, code), attempts: 0 });
      return "issued";
    },
    confirm: (user: string, code: string) => {
      const otp = otps.get(user);
      if (!otp) return "no_code";
      if (otp.attempts >= 5) return "locked";
      if (otp.hash !== hash(user, code)) {
        otp.attempts += 1;
        return "wrong";
      }
      otps.delete(user);
      for (const [other, p] of confirmed) if (p === otp.phone && other !== user) return "taken";
      confirmed.set(user, otp.phone);
      return "confirmed";
    },
  };
}

function sequence(values: number[]) {
  let i = 0;
  return () => values[i++ % values.length]!;
}

describe("the code and its message", () => {
  it("is six digits from the injected source", () => {
    expect(generateCode(sequence([1, 2, 3, 4, 5, 6]))).toBe("123456");
  });

  it("says nobody from Vallo will ask for it, and carries nothing but the code", () => {
    const text = otpMessage("123456");
    expect(text).toContain("123456");
    expect(text).toContain("Nobody from Vallo will ever ask you for it");
    expect(text).not.toMatch(/https?:|—/);
  });
});

describe("the three moments", () => {
  const base = { flagOn: true, confirmed: false, priorCount: 0 };
  it("asks at the first inspection, review and non-danger report only", () => {
    expect(phoneGateNeeded({ ...base, moment: "inspection" })).toBe(true);
    expect(phoneGateNeeded({ ...base, moment: "review" })).toBe(true);
    expect(phoneGateNeeded({ ...base, moment: "report", reportCategory: "scam" })).toBe(true);
    expect(phoneGateNeeded({ ...base, priorCount: 1, moment: "inspection" })).toBe(false);
  });

  it("never delays a report that somebody is unsafe", () => {
    expect(phoneGateNeeded({ ...base, moment: "report", reportCategory: "unsafe" })).toBe(false);
  });

  it("asks nothing with the flag off or a phone already confirmed", () => {
    expect(phoneGateNeeded({ ...base, flagOn: false, moment: "inspection" })).toBe(false);
    expect(phoneGateNeeded({ ...base, confirmed: true, moment: "inspection" })).toBe(false);
  });
});

describe("send then confirm, end to end with the capturing stub", () => {
  const USER = "11111111-1111-4111-8111-111111111111";
  const OTHER = "22222222-2222-4222-8222-222222222222";
  const PHONE = "+2348031234567";

  function deps(db: ReturnType<typeof fakeDatabase>, outbox: CapturedMessage[], allow = true): SendDeps {
    return {
      randomInt: sequence([4, 8, 1, 5, 9, 2]),
      issue: db.issue,
      transport: capturingTransport(outbox),
      allow: async () => allow,
    };
  }

  it("delivers the code, and the code it delivered confirms the number", async () => {
    const db = fakeDatabase();
    const outbox: CapturedMessage[] = [];
    expect(await runSendCode(deps(db, outbox), USER, PHONE)).toEqual({ ok: true });
    expect(outbox).toHaveLength(1);
    expect(outbox[0]!.to).toBe(PHONE);
    const code = /\b(\d{6})\b/.exec(outbox[0]!.message)![1]!;
    expect(db.confirm(USER, "000000")).toBe("wrong");
    expect(db.confirm(USER, code)).toBe("confirmed");
    expect(db.confirmed.get(USER)).toBe(PHONE);
  });

  it("refuses a number another account has confirmed, and sends nothing", async () => {
    const db = fakeDatabase();
    db.confirmed.set(OTHER, PHONE);
    const outbox: CapturedMessage[] = [];
    /* Refused in the member's words (no enumeration); the real reason is kept for staff. */
    expect(await runSendCode(deps(db, outbox), USER, PHONE)).toEqual({ ok: false, reason: "refused", staffReason: "taken" });
    expect(outbox).toEqual([]);
  });

  it("sends nothing when the allowance is spent", async () => {
    const outbox: CapturedMessage[] = [];
    expect(await runSendCode(deps(fakeDatabase(), outbox, false), USER, PHONE)).toEqual({
      ok: false,
      reason: "limited",
    });
    expect(outbox).toEqual([]);
  });

  it("says so, rather than pretending, when no transport is wired", async () => {
    const db = fakeDatabase();
    const result = await runSendCode({ ...deps(db, []), transport: unconfiguredTransport }, USER, PHONE);
    expect(result).toEqual({ ok: false, reason: "unconfigured" });
    expect(otpTransport().name).toBe("unconfigured");
  });

  it("recognises every answer the confirm function can give", () => {
    for (const outcome of ["confirmed", "wrong", "expired", "locked", "no_code", "taken", "signed_out"]) {
      expect(isConfirmOutcome(outcome)).toBe(true);
    }
    expect(isConfirmOutcome("maybe")).toBe(false);
  });
});

describe("which earlier reports use up the first-report moment", () => {
  it("counts a report the member chose to write", () => {
    expect(countsAsOwnReport({ category: "scam", reason: "They asked me to pay first" })).toBe(true);
    expect(countsAsOwnReport({ category: null, reason: null })).toBe(true);
  });

  it("never counts a danger report or one V-05 filed from a renter's answers", () => {
    expect(countsAsOwnReport({ category: "unsafe", reason: "I was threatened" })).toBe(false);
    expect(
      countsAsOwnReport({ category: "off_platform_payment", reason: `${AUTO_REPORT_PREFIX} abc: the renter was asked for money outside Vallo.` }),
    ).toBe(false);
  });

  it("matches the words the database writes on the automatic report", () => {
    const sql = readFileSync(
      join(__dirname, "../../../../../supabase/migrations/20260928224105_v50_the_phone_is_the_scarcity_anchor.sql"),
      "utf8",
    );
    expect(sql).toContain(`'${AUTO_REPORT_PREFIX} '`);
  });
});

describe("the wiring", () => {
  const root = join(__dirname, "..", "..");
  it("gates the three actions, each after sign-in and before the write", () => {
    const cases: [string, string, string][] = [
      ["lib/inspections/actions.ts", "export async function requestInspection", '"inspection"'],
      ["lib/reviews/actions.ts", "export async function submitReview", '"review"'],
      ["lib/reports/actions.ts", "export async function reportSomething", '"report", category'],
    ];
    for (const [file, fn, moment] of cases) {
      const src = readFileSync(join(root, file), "utf8");
      const body = src.slice(src.indexOf(fn));
      const gate = body.indexOf(`phoneGateFor(session.supabase, session.user.id, ${moment}`);
      expect(gate).toBeGreaterThan(0);
      expect(gate).toBeLessThan(body.indexOf(".insert("));
    }
  });

  it("counts a tenancy review as a review, and reads only the member's own non-danger reports", () => {
    const gate = readFileSync(join(root, "lib/phone-otp/gate.ts"), "utf8");
    expect(gate).toContain('from("tenancy_reviews")');
    expect(gate).toContain("rows.filter(countsAsOwnReport)");
    const tenancy = readFileSync(join(root, "lib/tenancy/review-actions.ts"), "utf8");
    expect(tenancy).toContain('phoneGateFor(session.supabase, session.user.id, "review")');
  });

  it("limits codes per number per account, so a stranger cannot spend the owner's hour", () => {
    const src = readFileSync(join(root, "lib/phone-otp/actions.ts"), "utf8");
    expect(src).toContain("`phone:${phone}:${subjectForUser(userId)}`");
    expect(src).not.toContain('allowed("phone_otp_number", `phone:${phone}`, 3)');
  });

  it("the code is never returned by the send action", () => {
    const src = readFileSync(join(root, "lib/phone-otp/actions.ts"), "utf8");
    expect(src).toContain("return ok({ sentTo: e164 });");
    expect(src).not.toMatch(/ok\(\{[^}]*code/);
  });
});
