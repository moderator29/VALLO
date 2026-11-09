import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, describe, expect, it, vi } from "vitest";
import { getDictionary } from "@vallo/i18n";
import { axe, closeAxe, hasBrowser } from "@/lib/a11y/axe";
import {
  PAY_CHOICE_CARD_REASON,
  PAY_CHOICE_ESCROW_PAUSED,
  PAY_CHOICE_ESCROW_REASON,
  PAY_CHOICE_ROOM_ONLY,
  PAY_CHOICE_SALE_ONLY,
  PAY_ONLY_THROUGH_VALLO,
  RENT_NOT_OPEN_NEXT,
  RENT_NOT_OPEN_SHORT,
} from "@/lib/money/copy";
import type { PayChoice } from "@/lib/payments/rail-choice";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => undefined, refresh: () => undefined }) }));
vi.mock("@/lib/payments/rail-choice-actions", () => ({ choosePaymentRail: async () => ({ ok: false, error: "unavailable" }) }));

const { PayChoiceCard } = await import("./PayChoiceCard");

afterAll(closeAxe);

const copy = getDictionary("en").payChoice;
const agreement = { id: "ag-1", kind: "stay", bookingId: "bk-1", inspectionId: null };
const both: PayChoice = { options: ["escrow", "card"], defaultRail: "escrow", chosen: null, rail: "escrow", payer: true, locked: null };

const html = (choice: PayChoice | null, over: Record<string, unknown> = {}) =>
  renderToStaticMarkup(<PayChoiceCard copy={copy} choice={choice} agreement={agreement} here="/agreements/ag-1" {...over} />);
/** The radio for one rail, as rendered. */
const radio = (s: string, rail: string) => s.match(new RegExp(`<input[^>]*value="${rail}"[^>]*>`))?.[0] ?? "";
const words = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/\s+/g, " ");

describe("the payment step's choice (ruling 2)", () => {
  it("draws two options, Escrow first, preselected and marked recommended, each with its reason", () => {
    const out = html(both);
    const text = words(out);
    expect(out).toContain('data-mode="choose"');
    expect(text.indexOf("Escrow")).toBeLessThan(text.indexOf("Pay by card"));
    expect(text).toContain("Recommended");
    expect(text).toContain(PAY_CHOICE_ESCROW_REASON.replace(/'/g, "'"));
    expect(text).toContain(PAY_CHOICE_CARD_REASON);
    expect(out).toMatch(/data-testid="pay-choice-escrow"[^>]*data-selected="true"|data-selected="true"[^>]*data-testid="pay-choice-escrow"/);
    expect(radio(out, "escrow")).toContain("checked");
    expect(radio(out, "card")).not.toContain("checked");
    expect(text).toContain("Continue");
  });

  it("preselects card when the payer chose it", () => {
    const out = html({ ...both, chosen: "card", rail: "card" });
    expect(radio(out, "card")).toContain("checked");
    expect(radio(out, "escrow")).not.toContain("checked");
  });

  it("a sale shows escrow only, as a fact, with no radio and no recommended badge", () => {
    const out = html({ ...both, options: ["escrow"] });
    const text = words(out);
    expect(out).toContain('data-mode="escrow_only"');
    expect(out).not.toContain('type="radio"');
    expect(out).not.toContain("pay-choice-card");
    expect(text).toContain(PAY_CHOICE_SALE_ONLY);
    expect(text).not.toContain("Recommended");
  });

  it("a hotel room shows card only, as a fact", () => {
    const out = html({ ...both, options: ["card"], defaultRail: "card", rail: "card" }, { showContinue: false });
    expect(out).toContain('data-mode="card_only"');
    expect(out).not.toContain("pay-choice-escrow");
    expect(words(out)).toContain(PAY_CHOICE_ROOM_ONLY);
    expect(out).not.toContain("pay-choice-continue");
  });

  it("always says to pay only through Vallo", () => {
    expect(words(html(both))).toContain(PAY_ONLY_THROUGH_VALLO);
  });

  it("the lister sees no Continue, and the choice is not theirs", () => {
    const out = html({ ...both, payer: false });
    expect(out).not.toContain("pay-choice-continue");
    expect(words(out)).toContain(copy.notPayerNote);
  });

  it("with the protected rail off, a rent or shortlet payer is shown card and the one quiet line naming the processor", () => {
    const out = html({ ...both, options: ["card"], defaultRail: "card", escrowPaused: true });
    const text = words(out);
    expect(out).toContain('data-mode="card_escrow_paused"');
    expect(out).not.toContain("pay-choice-escrow\"");
    expect(text).toContain(PAY_CHOICE_ESCROW_PAUSED);
    expect(PAY_CHOICE_ESCROW_PAUSED).toBe("You pay by card through Paystack. Nothing has been charged yet.");
    expect(text).not.toMatch(/paused|coming back|temporarily/i);
    expect(text.match(/Paystack/g)?.length).toBe(1);
  });

  it("with the protected rail off, a purchase says Vallo takes no payment for it, and offers no Continue", () => {
    const out = html({ ...both, options: [], defaultRail: null, escrowPaused: true });
    const text = words(out);
    expect(out).toContain('data-mode="escrow_paused"');
    expect(text).toContain(copy.escrowOnlyTitle);
    expect(text).toContain("Vallo does not take payment for a property purchase at any stage.");
    expect(text).not.toMatch(/escrow|paused|Paystack/i);
    expect(out).not.toContain("pay-choice-continue");
  });

  it("draws nothing when no rail resolves", () => {
    expect(html(null)).toBe("");
    expect(html({ ...both, options: [] })).toBe("");
  });

});

describe("a rental while payment for rentals is not open (9 November 2026)", () => {
  const rent = { id: "ag-2", kind: "rent", bookingId: null, inspectionId: "in-1" };

  it("says so and offers no rail, no radio and no Continue, even with card stored", () => {
    for (const choice of [both, { ...both, options: ["card"] as PayChoice["options"], escrowPaused: true as const, chosen: "card" as const }]) {
      const out = html(choice, { agreement: rent });
      const text = words(out);
      expect(out).toContain('data-mode="rent_not_open"');
      expect(text).toContain(RENT_NOT_OPEN_SHORT);
      expect(text).toContain(RENT_NOT_OPEN_NEXT);
      expect(out).not.toContain('type="radio"');
      expect(out).not.toContain("pay-choice-card");
      expect(out).not.toContain("pay-choice-continue");
      expect(text).not.toContain("Paystack");
    }
  });
});

describe.skipIf(!hasBrowser && !process.env.CI)("the payment step's choice (axe)", () => {
  it("has no axe violations", async () => {
    expect(await axe(`<h1>Pay</h1>${html(both)}`)).toEqual([]);
    expect(
      await axe(`<h1>Pay</h1>${html(both, { agreement: { id: "ag-2", kind: "rent", bookingId: null, inspectionId: "in-1" } })}`),
    ).toEqual([]);
  });
});
