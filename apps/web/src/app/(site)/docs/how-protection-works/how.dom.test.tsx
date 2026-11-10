import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, describe, expect, it, vi } from "vitest";
import { formatMoney } from "@vallo/i18n/core";
import { axe, closeAxe, hasBrowser } from "@/lib/a11y/axe";
import { PROTECTED_NOT_OPEN } from "@/lib/money/copy";
import { MONEY_IN_BAND_ONE_CAP_MINOR, MONEY_IN_FIXED_MINOR, protectedQuote } from "@/lib/money/protected-fees";
import { PROTECTED_FUNDS_WORDING_FULL, PROTECTED_PROVIDER_NAME } from "@/lib/money/protected-wording";
import { SCHEDULE_PROMISES, firstBannedPhrase } from "@/lib/copy/banned-phrases";

/**
 * "HOW PROTECTION WORKS" IS HONEST (BUILD 7.7). Pinned: it says first that
 * protected payment is not open and names no date; the custodian appears in
 * the provider's full words; Vallo is never said to hold money; the fees on
 * the page are the ones protected-fees.ts computes; and it has a section on
 * what protection does not cover and on the dispute process.
 */
vi.mock("next/navigation", () => ({ usePathname: () => "/docs/how-protection-works", useRouter: () => ({ push: () => undefined }) }));
afterAll(closeAxe);

const { default: Page } = await import("./page");
const out = renderToStaticMarkup(<Page />);
const text = out.replace(/<[^>]+>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ");
const naira = (minor: number) => formatMoney(minor, "en", "NGN");

describe("how protection works", () => {
  it("says plainly that protected payment is not open, and names no date", () => {
    expect(text).toContain(PROTECTED_NOT_OPEN);
    expect(firstBannedPhrase(text, SCHEDULE_PROMISES)).toBeNull();
    expect(text).not.toMatch(/\b(January|February|March|April|May|June|July|August|September|October|November|December) 20\d\d\b/);
  });

  it("names the custodian in the provider's full words and the partner by name, and never says Vallo holds money", () => {
    expect(text).toContain(PROTECTED_FUNDS_WORDING_FULL);
    expect(text).toContain(PROTECTED_PROVIDER_NAME);
    expect(text).toContain("Vallo never holds your money.");
    expect(text).not.toMatch(/Vallo (holds|keeps|guarantees) (your|the) (money|funds|payment)/i);
    expect(text).not.toMatch(/\b(safe|secure|guaranteed)\b/i);
  });

  it("draws the fees from the fee module, with the lister paying", () => {
    expect(text).toContain("1.5% plus");
    expect(text).toContain(naira(MONEY_IN_FIXED_MINOR));
    expect(text).toContain(`at most ${naira(MONEY_IN_BAND_ONE_CAP_MINOR)}`);
    const q = protectedQuote(1_800_000_00)!;
    expect(text).toContain(naira(q.moneyInFeeMinor));
    expect(text).toContain(naira(q.sellerReceivesMinor));
    expect(text).toContain("The lister pays it");
  });

  it("has the limits, the dispute process and the flow", () => {
    expect(text).toContain("What protection does not cover");
    expect(text).toContain("If something goes wrong");
    expect(text).toContain("How a protected payment moves");
    expect(out).toContain('id="who-holds-the-money"');
  });

  it.skipIf(!hasBrowser && !process.env.CI)("has no axe violations", async () => {
    expect(await axe(out)).toEqual([]);
  });
});
