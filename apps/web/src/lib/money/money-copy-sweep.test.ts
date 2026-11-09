import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { LOCALES, getDictionary } from "@vallo/i18n";
import { withoutComments } from "@/lib/copy/source-scan";
import { SCHEDULE_PROMISES, firstBannedPhrase } from "@/lib/copy/banned-phrases";
import * as copy from "./copy";

/**
 * THE MONEY COPY SWEEP OF 9 NOVEMBER 2026, HELD (docs/handoff/MONEY_COPY_SWEEP.md
 * and the founder's rows of that date in docs/handoff/FOUNDER_DECISIONS.md).
 *
 * Vallo never holds money. Stays, hotel rooms and restaurants are paid by card
 * and split at the moment of payment; payment for rentals is not open, Vallo
 * takes no payment for a purchase at any stage, the protected rail is switched
 * off and the Vallo Guarantee is retired. The sentences that say so live in
 * `copy.ts` and nowhere else (rule (d)). This file fails when:
 *
 *   1. a dictionary key that carries one of them drifts from its constant;
 *   2. one of them is typed again anywhere else, in a source string, JSX text
 *      or a dictionary, whole or a sentence of it (the near miss: a screen that
 *      retypes the words instead of importing them will drift the day the
 *      module changes);
 *   3. a retired phrase comes back: escrow "paused", "paid into escrow", "a
 *      licensed partner holds", "held until the deal is confirmed", "not
 *      covered" and "not protected by us", or the Vallo Guarantee as a live
 *      promise.
 *
 * The model is `protected-wording.test.ts`. Comments are not read: a comment
 * that records the words it replaced is not a screen.
 */

const SRC = join(__dirname, "..", "..");
const REPO = join(SRC, "..", "..", "..");
const SELF = "apps/web/src/lib/money/copy.ts";

/** Staff screens, dev previews and tests: not member copy. */
const NOT_MEMBER_COPY = [/\/app\/admin\//, /\/lib\/admin\//, /\/app\/\(dev\)\//, /\.test\.tsx?$/, /\.fixtures?\.ts$/];

/** Dictionary subtrees only staff read (the finance, refund and referral desks). */
const STAFF_PATHS = [/^admin\./, /^afterTheGate\.admin\./, /^subscriptions\.admin\./, /^referralDesk\./, /^chargebacks\.(desk|override)\./, /^experienceAdmin\./, /^compliance/];

/**
 * RULE (d): the dictionary keys that carry a money sentence, and the constant
 * each must equal in English. The other locales carry the same English until a
 * native reader translates it, so a mapped path is exempt from the near-miss
 * scan in every locale.
 */
const DICTIONARY_CONSTANTS: Record<string, keyof typeof copy> = {
  "payChoice.escrowOnlyTitle": "PAY_CHOICE_SALE_TITLE",
  "payChoice.refused.sale_escrow_only": "PAY_REFUSED_SALE",
  "payChoice.refused.escrow_only": "PAY_REFUSED_NOT_OPEN",
  "payChoice.refused.card_needs_review": "PAY_REFUSED_CARD_REVIEW",
  "platform.devices.notMeConfirm": "NOT_ME_CONFIRM",
  "platform.devices.notMeWorking": "NOT_ME_WORKING",
  "platform.inflight.pendingVerdict": "INFLIGHT_PENDING_VERDICT",
  "chargebacks.hold.means": "CHARGEBACK_HOLD_MEANS",
  "chargebacks.notices.lost.body": "CHARGEBACK_LOST_BODY",
  "chargebacks.notices.reowed.body": "CHARGEBACK_REOWED_BODY",
  "experienceInbox.thread.view.safetyRule": "KEEP_IT_INSIDE_VALLO",
  "memberFlows.rental.keepInside": "KEEP_IT_INSIDE_VALLO",
  "safety.education": "KEEP_IT_INSIDE_VALLO",
  "afterTheGate.tenancy.cautionStates.escalated": "CAUTION_ESCALATED",
  "afterTheGate.tenancy.escalateHelp": "CAUTION_ESCALATE_HELP",
  "afterTheGate.tenancy.escalateSubmit": "CAUTION_ESCALATE_SUBMIT",
  "afterTheGate.tenancy.escalateOpen": "CAUTION_ESCALATE_OPEN",
  "afterTheGate.refund.landed": "REFUND_LANDED",
  "afterTheGate.refund.initiated": "REFUND_INITIATED",
  "afterTheGate.refund.initiatedLate": "REFUND_INITIATED_LATE",
  "afterTheGate.refund.sending": "REFUND_SENDING",
  "catalogue.bookings.step2Body": "BOOKING_STEP_PAY",
  "subscriptions.terms.price": "PLAN_PRICE_LINE",
  "subscriptions.confirm.body": "PLAN_CONFIRM_BODY",
  "subscriptions.confirm.failedBody": "PLAN_CONFIRM_FAILED_BODY",
  "subscriptions.confirm.declinedBody": "PLAN_CONFIRM_DECLINED_BODY",
  "subscriptions.confirm.slowBody": "PLAN_CONFIRM_SLOW_BODY",
  "subscriptions.errors.cancel_failed": "PLAN_CANCEL_FAILED",
};

/** The replacement sentences of 9 November 2026: none may be typed outside the module. */
const REPLACEMENTS: (keyof typeof copy)[] = [
  "GOVERNING_SENTENCE",
  "CARD_RAIL_MOVES",
  "PAYOUT_ANSWER",
  "HOST_PAYOUT_STEP",
  "RENT_PAYMENT_NOT_OPEN",
  "SALE_NEVER_PAID_ON_VALLO",
  "SALE_PAYMENT_NOT_OPEN",
  "SALE_TITLE_CHECK",
  "AGREEMENT_PAYMENT_OPENS",
  "CARD_REVIEW_SOMETIMES",
  "OWNER_PAID_WHEN",
  "EARNINGS_SETTLEMENT",
  "EARNINGS_EMPTY_BODY",
  "HOST_EARNINGS_EMPTY_BODY",
  "SAFETY_PAY_THROUGH_VALLO",
  "PAY_ONLY_THROUGH_VALLO",
  "KEEP_IT_INSIDE_VALLO",
  "PAY_CHOICE_SALE_ONLY",
  "PAY_CHOICE_ESCROW_PAUSED",
  "PAY_CHOICE_CARD_REVIEW",
  "PAY_REFUSED_CARD_REVIEW",
  "SWITCH_TO_CARD_LEAD",
  "VALLO_NEVER_HOLDS",
  "STAYS_PAID_BY_CARD",
  "CARD_MEANS",
  "LISTER_AGREE_TERMS",
  "HOW_PAYING_PROCESSOR_NAMED",
  "REFUND_TO_CARD_BY_DAY_FIVE",
  "CARD_SHARE_WHEN_CLEARS",
  "PAYMENT_METHODS_ANSWER",
  "NEWSLETTER_SALE_LINE",
  "PROMPT_NO_ESCROW",
  "CHARGEBACK_HOLD_MEANS",
  "CHARGEBACK_LOST_BODY",
  "CHARGEBACK_REOWED_BODY",
  "CAUTION_ESCALATE_HELP",
  "CAUTION_ESCALATE_OPEN",
  "REFUND_LANDED",
  "REFUND_INITIATED",
  "REFUND_SENDING",
  "PLAN_CONFIRM_BODY",
  "PLAN_CONFIRM_FAILED_BODY",
  "PLAN_CONFIRM_DECLINED_BODY",
  "PLAN_CONFIRM_SLOW_BODY",
  "PLAN_CANCEL_FAILED",
];

/** A phrase a member must never be shown again, with why. */
const RETIRED: { label: string; pattern: RegExp }[] = [
  { label: "escrow is paused (rule (b): it never ran)", pattern: /\bescrow (is|was) paused\b|\bescrow paused\b|\bwhile escrow is paused\b/i },
  { label: "paid into escrow", pattern: /\bpaid into escrow\b/i },
  { label: "a licensed partner holds", pattern: /\ba licensed (payment )?partner holds\b/i },
  { label: "held until the deal is confirmed", pattern: /\bheld until the deal is confirmed\b/i },
  { label: "not covered (rule (a))", pattern: /\b(is|are) not covered\b/i },
  { label: "not protected by us (rule (a))", pattern: /\bnot protected by us\b/i },
  {
    label: "the Vallo Guarantee as a live promise",
    pattern:
      /\b(Vallo )?Guarantee (covers|protects|pays out|will pay|is limited)\b|\b(covered|protected) by the (Vallo )?Guarantee\b|\bclaim it from the (Vallo )?Guarantee\b|\bwith the Vallo Guarantee\b|\band Guarantee claims\b|, the Vallo Guarantee and\b/i,
  },
];

/**
 * Lines outside this worker's files that still say a retired phrase, each with
 * its owner. The list may only shrink: a line that is gone fails the last test
 * below, so the entry is removed in the same change.
 */
const RETIRED_ELSEWHERE: { file: string; text: string; why: string }[] = [

  {
    file: "apps/web/src/lib/bookings/actions.ts",
    text: "This stay is paid into escrow, so it cannot be cancelled here.",
    why: "class B (sweep), behind an open Payluk arrangement that cannot exist while the rail is off; owned by the bookings track",
  },
];

/**
 * Trees left out of the near-miss scan only: the payment plumbing's own refusal
 * sentences (`lib/payments/split-attempt.ts` says "Payment opens as soon as both
 * of you confirm the agreement" for a stay's card charge) predate the module
 * and belong to the payments track. The retired-phrase scan still reads them.
 */
const NEAR_MISS_ELSEWHERE = [/^apps\/web\/src\/lib\/payments\//];

/** Dictionary leaves whose "not covered" is not about money (the price check's own refusals). */
const NOT_ABOUT_MONEY = [/^[a-zA-Z]+\.[a-zA-Z.]*unsupported_(type|period)$/];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === "node_modules" ? [] : files(full);
    return /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

function leaves(value: unknown, path: string[] = [], out: { path: string; text: string }[] = []) {
  if (typeof value === "string") out.push({ path: path.join("."), text: value });
  else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) leaves(child, [...path, key], out);
  }
  return out;
}

/** What a reader sees, normalised: entities, JSX spacers and runs of white space. */
function readable(text: string): string {
  return text
    .replace(/&rsquo;|&#39;|&apos;|’/g, "'")
    .replace(/\{"\s*"\}/g, " ")
    .replace(/\s+/g, " ");
}

/** The sentences of a constant long enough to be its own words (six words or more). */
function sentencesOf(text: string): string[] {
  return (text.match(/[^.!?]+[.!?]/g) ?? [text]).map((s) => s.trim()).filter((s) => s.split(/\s+/).length >= 6);
}

const memberSources = files(SRC)
  .map((file) => ({ file, at: relative(REPO, file).split("\\").join("/") }))
  .filter(({ file }) => !NOT_MEMBER_COPY.some((rule) => rule.test(file.split("\\").join("/"))));

const dictionaryLeaves = LOCALES.flatMap((locale) =>
  leaves(getDictionary(locale)).map((leaf) => ({ locale, ...leaf })),
).filter(({ path }) => !STAFF_PATHS.some((rule) => rule.test(path)));

describe("rule (d): a money sentence kept as a dictionary key equals its constant", () => {
  const en = getDictionary("en") as unknown as Record<string, unknown>;
  const at = (path: string) => path.split(".").reduce<unknown>((node, key) => (node as Record<string, unknown> | undefined)?.[key], en);

  it.each(Object.entries(DICTIONARY_CONSTANTS))("%s is %s, word for word", (path, name) => {
    expect(at(path)).toBe(copy[name]);
  });

  /* The other locales: each reworded key's old translation was taken out, so
     the screen falls back to this English until a native reader translates it
     (never invented here, and never pasted in as English, which the
     completeness gate refuses). The one exception is the card review refusal,
     whose translations lost only their escrow sentence. */
  const KEPT_TRANSLATED = new Set(["payChoice.refused.card_needs_review"]);
  it.each(LOCALES.filter((l) => l !== "en"))("%s serves the English for every reworded key, until a native reader translates it", (locale) => {
    const dict = getDictionary(locale) as unknown as Record<string, unknown>;
    for (const [path, name] of Object.entries(DICTIONARY_CONSTANTS)) {
      if (KEPT_TRANSLATED.has(path)) continue;
      const value = path.split(".").reduce<unknown>((node, key) => (node as Record<string, unknown> | undefined)?.[key], dict);
      expect(value, `${locale} ${path}`).toBe(copy[name]);
    }
  });
});

describe("rule (d): no money sentence is typed outside the module", () => {
  const needles = REPLACEMENTS.flatMap((name) => {
    const value = copy[name];
    expect(typeof value, name).toBe("string");
    return sentencesOf(value as string).map((sentence) => ({ name, sentence }));
  });

  it("has the replacement sentences to look for", () => {
    expect(needles.length).toBeGreaterThan(40);
  });

  it("finds none of them retyped in a source string or JSX text", () => {
    const found: string[] = [];
    for (const { file, at } of memberSources) {
      if (at === SELF || NEAR_MISS_ELSEWHERE.some((rule) => rule.test(at))) continue;
      const text = readable(withoutComments(readFileSync(file, "utf8")));
      for (const { name, sentence } of needles) {
        if (text.includes(sentence)) found.push(`${at}: ${name}: "${sentence.slice(0, 80)}"`);
      }
    }
    expect(found).toEqual([]);
  }, 60_000);

  it("finds none of them retyped in a dictionary, outside the keys mapped to their constants", () => {
    const found: string[] = [];
    for (const { locale, path, text } of dictionaryLeaves) {
      if (path in DICTIONARY_CONSTANTS) continue;
      for (const { name, sentence } of needles) {
        if (readable(text).includes(sentence)) found.push(`${locale} ${path}: ${name}`);
      }
    }
    expect(found).toEqual([]);
  });

  it("would catch a retyped sentence (the near miss is not a blind spot)", () => {
    const retyped = readable(`<p>Pay through Vallo. A payment made outside the platform leaves no record, so we cannot help you if something goes wrong.</p>`);
    expect(needles.some(({ sentence }) => retyped.includes(sentence))).toBe(true);
  });
});

describe("the retired phrases stay retired", () => {
  it("finds none in a source string or JSX text a member can read", () => {
    const found: string[] = [];
    for (const { file, at } of memberSources) {
      const text = readable(withoutComments(readFileSync(file, "utf8")));
      for (const { label, pattern } of RETIRED) {
        const match = text.match(pattern);
        if (!match) continue;
        if (RETIRED_ELSEWHERE.some((known) => known.file === at && text.includes(known.text))) continue;
        found.push(`${at}: ${label}: "${match[0]}"`);
      }
    }
    expect(found).toEqual([]);
  }, 60_000);

  it("finds none in any locale's dictionary", () => {
    const found: string[] = [];
    for (const { locale, path, text } of dictionaryLeaves) {
      for (const { label, pattern } of RETIRED) {
        if (!pattern.test(text)) continue;
        if (NOT_ABOUT_MONEY.some((rule) => rule.test(path))) continue;
        found.push(`${locale} ${path}: ${label}`);
      }
    }
    expect(found).toEqual([]);
  });

  it("catches each retired shape, so a pattern cannot quietly stop working", () => {
    const shipped = [
      "Escrow is paused right now. Nothing has been taken.",
      "A purchase is always paid into escrow.",
      "If you choose to have a licensed partner hold it, a licensed partner holds it until the deal is confirmed.",
      "It is held until the deal is confirmed.",
      "Pay only through Vallo. Payments made outside Vallo are not covered.",
      "Deals made outside the platform are not protected by us.",
      "Your agreements, payments and Guarantee claims",
    ];
    for (const line of shipped) expect(RETIRED.some(({ pattern }) => pattern.test(line)), line).toBe(true);
    for (const kept of [copy.LEGACY_GUARANTEE_CLAIM, copy.PAY_ONLY_THROUGH_VALLO, copy.PAY_CHOICE_ESCROW_PAUSED]) {
      expect(RETIRED.some(({ pattern }) => pattern.test(kept)), kept).toBe(false);
    }
  });

  it("keeps the list of lines owned elsewhere honest: each is still there", () => {
    for (const known of RETIRED_ELSEWHERE) {
      expect(readFileSync(join(REPO, known.file), "utf8"), `${known.file} (${known.why})`).toContain(known.text);
    }
  });
});

describe("the founder's exact words (9 November 2026)", () => {
  it("rule (a): the outside-payment line", () => {
    expect(copy.PAY_ONLY_THROUGH_VALLO).toBe(
      "Pay through Vallo. A payment made outside the platform leaves no record, so we cannot help you if something goes wrong.",
    );
    expect(copy.PAY_ONLY_THROUGH_VALLO).not.toMatch(/cover|protect|guarantee/i);
  });

  it("rule (b): the line where escrow was paused", () => {
    expect(copy.PAY_CHOICE_ESCROW_PAUSED).toBe("You pay by card through Paystack. Nothing has been charged yet.");
    expect(copy.FUND_CLOSED.not_live).toBe(copy.PAY_CHOICE_ESCROW_PAUSED);
    expect(copy.FUND_REFUSED.switched_off).toBe(copy.PAY_CHOICE_ESCROW_PAUSED);
  });

  it("rule (c): every sale line says Vallo takes no payment for a purchase", () => {
    for (const line of [copy.PAY_CHOICE_SALE_ONLY, copy.PAY_REFUSED_SALE, copy.SALE_NOT_PAID, copy.NEWSLETTER_SALE_LINE, copy.PAYMENT_GATE_SENTENCE]) {
      expect(line).toContain("Vallo does not take payment for a property purchase at any stage.");
    }
  });

  /* Rule (i)'s words carried "protected", which the claims gate refuses as an
     unbacked claim; the lead's rewording (9 November 2026) says the same. */
  it("rule (i): the prompts' line", () => {
    expect(copy.PROMPT_NO_ESCROW).toBe("Vallo does not offer escrow or payment held by a bank. Never offer them.");
  });

  it("rule (j): the governing sentence protects nothing and names no processor", () => {
    expect(copy.GOVERNING_SENTENCE).not.toMatch(/protect|Paystack/i);
  });

  it("no replacement sentence promises a schedule", () => {
    for (const name of REPLACEMENTS) {
      expect(firstBannedPhrase(copy[name] as string, SCHEDULE_PROMISES), name).toBeNull();
      expect(copy[name] as string, name).not.toMatch(/coming back|temporarily|paused|opens soon/i);
    }
  });
});
