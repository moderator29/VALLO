import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { LOCALES, getDictionary } from "@vallo/i18n";
import { withoutComments } from "@/lib/copy/source-scan";
import * as copy from "./copy";
import { PAYSTACK_NAMED, type PaystackSurface } from "./copy";

/**
 * PAYSTACK IS NAMED IN FIVE PLACES ONLY (the founder, 9 November 2026), all
 * about a payment in front of the member: the receipt for a card payment; the
 * Terms, payments section; the Privacy Policy; the help centre page on how
 * paying works; and the payment step itself, one quiet line beside the pay
 * button. Everywhere else a member reads "card payment" or "our payment
 * processor". "Not spammed in our platform."
 *
 * Three checks: no constant in the money copy module names the processor
 * unless `PAYSTACK_NAMED` gives it a surface; such a constant is read only on
 * that surface; and no other member-facing source string, JSX text or
 * dictionary value says the name. Staff screens, the API, the payment
 * plumbing (`lib/payments`), dev previews and tests are not member copy.
 * Identifiers (`PaystackCheckout`, `paystack_reference`) are not words a
 * member reads and do not match.
 */

const SRC = join(__dirname, "..", "..");
const NAME = /\bPaystack\b/;

/** The files that ARE each surface. */
const SURFACE_FILES: Record<PaystackSurface, RegExp[]> = {
  receipt: [
    /^components\/app\/money\/(ReceiptSheet\.tsx|receipt-model\.ts)$/,
    /^components\/money\/(ReceiptVault|ReceiptActions)\.tsx$/,
    /^components\/money\/movement-receipt\.ts$/,
    /^lib\/email\/receipt(-order)?\.ts$/,
    /^lib\/money\/receipt-image\.ts$/,
    /^app\/\(app\)\/receipts\//,
    /^app\/\(site\)\/r\//,
  ],
  terms: [/^lib\/legal\/terms\.tsx$/],
  privacy: [/^lib\/legal\/privacy\.tsx$/],
  /* /docs/paying-on-vallo, "How paying works", is a chapter of this module. */
  "help-paying": [/^app\/\(site\)\/docs\/chapters\.tsx$/],
  "pay-step": [
    /^components\/money\/pay-choice\//,
    /^components\/money\/fund\//,
    /^components\/app\/payments\/PaystackCheckout\.tsx$/,
    /^app\/\(app\)\/checkout\/\[bookingId\]\/PayPanel\.tsx$/,
    /^app\/\(app\)\/rent\/pay\//,
    /^app\/\(app\)\/agreements\/\[id\]\/fund\//,
    /^lib\/money\/fund-(model|actions)\.ts$/,
  ],
  staff: [/^app\/admin\//, /^lib\/admin\//],
};

/** Not member copy: staff, the API, the payment plumbing, the operator's readiness desk, dev previews, tests. */
const EXEMPT = [
  /^app\/admin\//,
  /^lib\/admin\//,
  /^app\/api\//,
  /^lib\/payments\//,
  /^lib\/payouts\//,
  /^app\/\(dev\)\//,
  /^lib\/store\/readiness\.ts$/,
  /* The claims gate's own mechanism text, which no member reads. */
  /^lib\/trust\/claims\.ts$/,
  /\.test\.tsx?$/,
  /\.fixtures?\.ts$/,
];

/** The money copy module is checked constant by constant, below. */
const MODULE = "lib/money/copy.ts";

/**
 * Member copy outside this worker's files that still names the processor,
 * each with its owner. The list may only shrink: a line that is gone fails
 * the last test, so its entry goes in the same change.
 */
const NAMED_ELSEWHERE: { file: string; text: string; why: string }[] = [];

/** Dictionary subtrees only staff read. */
const STAFF_PATHS = [/^admin\./, /^afterTheGate\.admin\./, /^subscriptions\.admin\./, /^referralDesk\./, /^chargebacks\.desk\./];

/** Dictionary values that are the pay step's one line: the Pro plan's pay sheet, beside its pay button. */
const PAY_STEP_PATHS = ["subscriptions.review.card"];

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

const sources = files(SRC).map((file) => ({
  at: relative(SRC, file).split("\\").join("/"),
  code: withoutComments(readFileSync(file, "utf8")),
}));

const onSurface = (at: string, surface: PaystackSurface) => SURFACE_FILES[surface].some((rule) => rule.test(at));
const onAnySurface = (at: string) => (Object.keys(SURFACE_FILES) as PaystackSurface[]).some((s) => onSurface(at, s));

describe("the money copy module names the processor only in the constants that may", () => {
  it("lists every constant that says Paystack, with its surface", () => {
    const naming = Object.entries(copy)
      .filter(([name]) => name !== "PAYSTACK_NAMED")
      .filter(([, value]) => NAME.test(JSON.stringify(value) ?? ""))
      .map(([name]) => name)
      .sort();
    expect(naming).toEqual(Object.keys(PAYSTACK_NAMED).sort());
  });

  it("is read only on that surface", () => {
    const misplaced: string[] = [];
    for (const [name, surface] of Object.entries(PAYSTACK_NAMED)) {
      const word = new RegExp(`\\b${name}\\b`);
      for (const { at, code } of sources) {
        if (at === MODULE || /\.test\.tsx?$/.test(at) || !word.test(code)) continue;
        if (!onSurface(at, surface)) misplaced.push(`${at} reads ${name} (${surface} only)`);
      }
    }
    expect(misplaced).toEqual([]);
  });
});

describe("no other member copy names the processor", () => {
  it("finds it in no source string or JSX text outside the five surfaces", () => {
    const found: string[] = [];
    for (const { at, code } of sources) {
      if (at === MODULE || EXEMPT.some((rule) => rule.test(at)) || onAnySurface(at)) continue;
      code.split("\n").forEach((line, i) => {
        if (!NAME.test(line)) return;
        if (NAMED_ELSEWHERE.some((known) => known.file === at && line.includes(known.text))) return;
        found.push(`${at}:${i + 1}: ${line.trim().slice(0, 100)}`);
      });
    }
    expect(found).toEqual([]);
  });

  it.each(LOCALES)("%s: finds it in no dictionary value outside the staff desks and the pay step", (locale) => {
    const found = leaves(getDictionary(locale))
      .filter(({ text }) => NAME.test(text))
      .filter(({ path }) => !STAFF_PATHS.some((rule) => rule.test(path)) && !PAY_STEP_PATHS.includes(path))
      .map(({ path, text }) => `${path}: ${text.slice(0, 80)}`);
    expect(found).toEqual([]);
  });

  it("tells a word from an identifier, so the scan cannot quietly pass everything", () => {
    for (const word of ["Paid by card through Paystack.", "Paystack's own window", "With Paystack, not yet on the card"]) {
      expect(NAME.test(word), word).toBe(true);
    }
    for (const id of ["PaystackCheckout", "paystack_reference", "PAYSTACK_SECRET_KEY", "paystackInline"]) {
      expect(NAME.test(id), id).toBe(false);
    }
  });

  it("keeps the list of lines owned elsewhere honest: each is still there", () => {
    for (const known of NAMED_ELSEWHERE) {
      expect(readFileSync(join(SRC, known.file), "utf8"), `${known.file} (${known.why})`).toContain(known.text);
    }
  });
});
