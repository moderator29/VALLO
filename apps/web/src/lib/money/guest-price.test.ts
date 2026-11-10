import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { guestCharge } from "./guest-price";
import * as copy from "./copy";

const base = {
  subtotalMinor: 90_000_00,
  subtotalLabel: "₦45,000 x 2 nights",
  cleaningMinor: 0,
  cleaningLabel: "Cleaning",
  serviceFeeMinor: 0,
  totalMinor: 90_000_00,
};

describe("the guest's charge (D51: the advertised price, nothing else)", () => {
  it("draws the lister's own lines only", () => {
    const charge = guestCharge({ ...base, cleaningMinor: 5_000_00, totalMinor: 95_000_00 });
    expect(charge).toEqual({
      state: "ok",
      lines: [
        { label: "₦45,000 x 2 nights", minor: 90_000_00 },
        { label: "Cleaning", minor: 5_000_00 },
      ],
      totalMinor: 95_000_00,
    });
  });

  it("leaves out a zero cleaning charge", () => {
    const charge = guestCharge(base);
    expect(charge.state === "ok" && charge.lines.length).toBe(1);
  });

  it("refuses a row that carries a guest-side fee rather than drawing or hiding it", () => {
    expect(guestCharge({ ...base, serviceFeeMinor: 1_800_00, totalMinor: 91_800_00 })).toEqual({
      state: "refused",
      reason: "guest-fee",
    });
  });
});

/* -------------------------------------------------------- the surface sweep */

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Every surface a renter or guest pays from or reads a price on. */
const RENTER_SURFACES = [
  "app/(app)/checkout/[bookingId]/CheckoutSummary.tsx",
  "app/(app)/checkout/[bookingId]/PayPanel.tsx",
  "app/(app)/rent/pay/[inspectionId]/PayPanel.tsx",
  "lib/bookings/checkout-view.ts",
  "components/money/TransactionCheckout.tsx",
];

/** A fee shown to the payer, in any of the shapes it has taken. */
const FEE_ON_PAYER = /platform share|platform fee|service fee|booking fee|\.takesNothing|guarantee/i;

/** Strip comments, so a comment explaining the rule does not trip it. */
function code(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("no renter or guest surface shows a Vallo fee", () => {
  it.each(RENTER_SURFACES)("%s", (file) => {
    let text: string;
    try {
      text = readFileSync(join(SRC, file), "utf8");
    } catch {
      return; // a surface not built yet has nothing to show
    }
    const hits = code(text)
      .split("\n")
      .flatMap((line, i) => (FEE_ON_PAYER.test(line) ? [`${i + 1}: ${line.trim()}`] : []));
    expect(hits).toEqual([]);
  });
});

describe("the Guarantee is retired from the money sentences (D51)", () => {
  const sentences = Object.entries(copy).filter(([, v]) => typeof v === "string") as [string, string][];
  const ALLOWED = new Set(["LEGACY_GUARANTEE_CLAIM"]);

  it("offers it nowhere but the one kept for old claims (GUARANTEE_SCOPE went with the Terms rewrite, 9 November 2026)", () => {
    const offering = sentences.filter(([name, text]) => /guarantee/i.test(text) && !ALLOWED.has(name)).map(([n]) => n);
    expect(offering).toEqual([]);
  });

  it("never says Vallo holds, keeps or guarantees money, or that it is 100 percent safe", () => {
    const bad = /\bVallo (?:holds|keeps|owns|guarantees)\b(?! none| nothing)|100 ?percent safe|100% safe|payment successful/i;
    expect(sentences.filter(([, text]) => bad.test(text)).map(([n]) => n)).toEqual([]);
  });

  /* The founder's sentence, with "and protect" dropped on 9 November 2026. */
  it("keeps the governing sentence verbatim", () => {
    expect(copy.GOVERNING_SENTENCE).toBe(
      "Vallo uses regulated financial infrastructure partners to process eligible transactions. Vallo does not hold customer funds.",
    );
  });
});
