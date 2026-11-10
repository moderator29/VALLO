import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, describe, expect, it } from "vitest";
import { axe, closeAxe, hasBrowser } from "@/lib/a11y/axe";
import { acceptanceOf, listerFeeFigures, type ListerFeePolicy } from "@/lib/money/lister-fee";
import { ListerFeeGate } from "./ListerFeeGate";

afterAll(closeAxe);

/* Policy rows as test values: D61's worked example (Vallo 2 percent, escrow
   protection 2 percent). `policy` bears no processor fee, which is the shape
   D61's table draws; `bearer` is the split as built today, the lister bearing
   the processor's fee up to the 2,000 naira cap VALLO_PRICING.md names. */
/* `escrowShown` is the server's protectedRailLive() answer: D61's range is
   drawn only while the protected rail is live (sweep items 7 to 9). */
const policy: ListerFeePolicy = { rateVersion: "v-test", valloBps: 200, escrowProtectionBps: 200, directProcessorFeeCapMinor: 0, capMinor: null, escrowShown: true };
const bearer: ListerFeePolicy = { ...policy, directProcessorFeeCapMinor: 2_000_00 };
/* The same rows as the server reads them today, with the protected rail off. */
const off: ListerFeePolicy = { ...policy, escrowShown: false };
const offBearer: ListerFeePolicy = { ...bearer, escrowShown: false };
const noop = () => undefined;

function gate(over: Partial<Parameters<typeof ListerFeeGate>[0]> = {}): string {
  return renderToStaticMarkup(
    <ListerFeeGate kind="rent" priceMinor={1_800_000_00} policy={policy} locale="en" blocking={false} accepted={null} onAcceptedChange={noop} {...over} />,
  );
}

/** The visible words, tags stripped. */
const words = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/\s+/g, " ");

describe("the lister's fee screen while the protected rail is off (sweep items 7 to 9)", () => {
  it("draws no escrow row and no range: Vallo's fee, and one figure the lister receives on a card payment", () => {
    for (const p of [off, { ...policy, escrowShown: undefined }]) {
      const html = gate({ policy: p });
      const text = words(html);
      expect(html).not.toContain("fee-gate-escrow");
      expect(text).not.toMatch(/escrow/i);
      expect(text).toContain("Platform fee ₦36,000");
      expect(text).not.toContain("₦36,000 to ₦72,000");
      expect(html).toMatch(/class="nf-feegate__headline">₦1,764,000</);
      expect(html).not.toContain("nf-feegate__upper");
      expect(html).not.toContain("fee-gate-range-note");
    }
  });

  it("takes the processor's fee, at its cap, off the one figure, and says who bears it", () => {
    const text = words(gate({ policy: offBearer }));
    expect(text).toContain("Payment processing on a card payment up to ₦2,000");
    expect(text).toContain("You receive ₦1,762,000");
    expect(text).toContain("You pay payment processing when a renter or guest pays by card. They never pay it.");
    expect(text).not.toContain("Paystack");
  });

  it("still records every rate in force, so lister_fee_accept re-derives the same figures, and never records more than is shown", () => {
    const figures = listerFeeFigures(1_800_000_00, offBearer)!;
    const accepted = acceptanceOf(figures, offBearer);
    expect(accepted.escrowProtectionBps).toBe(200);
    expect(accepted.escrowProtectionMinor).toBe(36_000_00);
    expect(accepted.receiveLowMinor).toBeLessThanOrEqual(1_762_000_00);
    expect(gate({ policy: offBearer, blocking: true, accepted })).toContain('data-state="accepted"');
    expect(gate({ policy: offBearer, blocking: true, accepted, priceMinor: 1_900_000_00 })).toContain('data-state="open"');
  });
});

describe("the lister's fee screen (D61, protected rail live)", () => {
  it("draws D61's range for 1,800,000, in naira, with the worst case as the headline", () => {
    const html = gate();
    const text = words(html);
    expect(text).toContain("Rent you set ₦1,800,000");
    expect(text).toContain("Platform fee ₦36,000 to ₦72,000");
    expect(text).toContain("Vallo, 2% ₦36,000");
    expect(text).toContain("Payment partner, 2% on a rent payment ₦36,000");
    expect(text).toContain("You receive ₦1,728,000 to ₦1,764,000");
    expect(html).toMatch(/class="nf-feegate__headline">₦1,728,000</);
    expect(html).toMatch(/class="nf-feegate__upper"> to ₦1,764,000</);
  });

  it("draws the processor's fee as its own line and takes it off the top when the lister bears it", () => {
    const text = words(gate({ policy: bearer }));
    expect(text).toContain("Payment processing on a card payment up to ₦2,000");
    expect(text).not.toContain("Paystack");
    expect(text).toContain("You receive ₦1,728,000 to ₦1,762,000");
    expect(text).toContain("Count on the lower figure");
  });

  it("says plainly that the lister pays the second fee on both rails, never the buyer", () => {
    /* VALLO_PRICING, corrected on 6 October: whoPays is seller, always. */
    expect(words(gate())).toContain("You pay the payment partner's fee on a rent payment. The renter never pays it.");
    expect(words(gate({ policy: bearer }))).toContain(
      "You pay the payment partner's fee on a rent payment, and payment processing on a card payment. The renter or guest pays neither.",
    );
    const none = gate({ policy: { ...policy, escrowProtectionBps: 0 } });
    expect(none).not.toContain("fee-gate-bearer");
  });

  it("says no 'you keep N percent', makes no comparison and calls no second fee Vallo's", () => {
    const html = gate({ policy: bearer });
    const text = words(html);
    expect(text).not.toMatch(/96 percent|\d+ percent/);
    expect(text).not.toMatch(/you keep/i);
    expect(text).not.toMatch(/instead of|agent|than /i);
    /* No one text node names the escrow fee and Vallo together. */
    expect(html).not.toMatch(/>[^<]*(Vallo[^<]*escrow|escrow[^<]*Vallo)[^<]*</i);
  });

  it("with the flag off, has no accept and says nothing is recorded and nothing waits", () => {
    const html = gate();
    expect(html).toContain('data-state="preview"');
    expect(html).not.toContain("fee-gate-accept");
    expect(words(html)).toContain("Nothing is recorded yet.");
    expect(words(html)).toContain("does not wait");
    expect(words(html)).not.toContain("Vallo records your acceptance");
  });

  it("with the flag on, is open until the explicit accept, and accepted only for these figures", () => {
    expect(gate({ blocking: true })).toContain('data-state="open"');
    expect(gate({ blocking: true })).toContain("fee-gate-accept");
    const accepted = acceptanceOf(listerFeeFigures(1_800_000_00, policy)!, policy);
    expect(gate({ blocking: true, accepted })).toContain('data-state="accepted"');
    expect(gate({ blocking: true, accepted, priceMinor: 1_900_000_00 })).toContain('data-state="open"');
  });

  it("says it cannot show figures when the policy could not be read, offers no accept, and says whether publishing waits", () => {
    const open = gate({ policy: null });
    expect(open).toContain('data-state="unreadable"');
    expect(open).not.toContain("fee-gate-accept");
    expect(open).not.toMatch(/2%|200/);
    expect(words(open)).toContain("does not wait");
    expect(words(gate({ policy: null, blocking: true }))).toContain("Publishing waits");
  });

  it("asks for a price rather than drawing a zero", () => {
    const html = gate({ priceMinor: null });
    expect(html).toContain('data-state="no-figure"');
    expect(html).not.toContain("₦0");
  });
});

describe.skipIf(!hasBrowser && !process.env.CI)("the lister's fee screen (axe)", () => {
  it.each([
    ["preview", {}],
    ["open", { blocking: true, policy: bearer }],
    ["unreadable", { policy: null }],
    ["no figure", { priceMinor: null }],
  ] as const)("%s has no axe violations", async (_name, over) => {
    expect(await axe(`<h1>List a property</h1><h2>Send for review</h2>${gate(over)}`)).toEqual([]);
  });
});
