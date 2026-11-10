import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, describe, expect, it, vi } from "vitest";
import { axe, closeAxe, hasBrowser } from "@/lib/a11y/axe";
import { protectedQuote } from "@/lib/money/protected-fees";
import { PREVIEW_DEALS, PREVIEW_NOW } from "@/app/(dev)/preview/protected/fixtures";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => undefined, refresh: () => undefined }) }));
afterAll(closeAxe);

const { ChooseHowToPay } = await import("./ChooseHowToPay");
const { ReviewProtection } = await import("./ReviewProtection");
const { ProtectedPayment } = await import("./ProtectedPayment");
const { ListerProtectedView } = await import("./ListerProtectedView");

const noop = () => undefined;
const actions = { refresh: noop, reportTransfer: noop, confirmMilestone: noop, raiseProblem: noop, newDetails: noop };
const words = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/\s+/g, " ");
const journey = (key: string) =>
  renderToStaticMarkup(<ProtectedPayment deal={PREVIEW_DEALS[key]!} now={PREVIEW_NOW} locale="en" actions={actions} />);
const quote = protectedQuote(PREVIEW_DEALS.funding!.amountMinor)!;

describe("the protected payment screens", () => {
  it("screen 1 shows the fee, who pays it and the total before anything is chosen; card is never called unsafe", () => {
    const out = renderToStaticMarkup(
      <ChooseHowToPay deal={PREVIEW_DEALS.funding!} offer={{ state: "offered", quote }} cardAllowed locale="en" onContinue={noop} />,
    );
    const text = words(out);
    expect(text).toContain("Protected bank transfer");
    expect(text).toContain("paid by the lister");
    expect(text).toContain("Total to transfer");
    expect(text).not.toMatch(/free protection|unsafe|not safe/i);
    expect(out).toContain('role="radiogroup"');
  });

  it("screen 1 with no approved category draws no protected option at all", () => {
    const out = renderToStaticMarkup(<ChooseHowToPay deal={PREVIEW_DEALS.funding!} offer={{ state: "absent" }} cardAllowed locale="en" onContinue={noop} />);
    expect(out).not.toContain("pp-option-protected");
    expect(out).toContain("pp-option-card");
  });

  it("screen 2 starts with Agree disabled until the payer ticks the box", () => {
    const out = renderToStaticMarkup(<ReviewProtection deal={PREVIEW_DEALS.funding!} quote={quote} agreementVersion={3} locale="en" onAgree={noop} />);
    expect(out).toMatch(/data-testid="pp-review-agree"[^>]*disabled|disabled[^>]*data-testid="pp-review-agree"/);
    expect(words(out)).toContain("I have reviewed the agreement, payment conditions and refund process.");
  });

  it("screen 3: amount first, copyable details, the genuine clock, and the button that does not confirm payment", () => {
    const text = words(journey("funding"));
    expect(text.indexOf("Transfer the exact amount")).toBeLessThan(text.indexOf("Account number"));
    expect(text).toContain("Transfer expires in 24:00");
    expect(text).toContain("This does not confirm payment.");
    expect(words(journey("funding-no-expiry"))).toContain("No time limit was given");
  });

  it("screen 4 waits and never says protected", () => {
    const text = words(journey("waiting"));
    expect(text).toContain("Transfer being confirmed");
    expect(text).not.toMatch(/Your payment is protected/);
  });

  it("screens 5 and 6: protected only on the confirmed state, the custodian named in the provider's words, the category's own milestone", () => {
    const stay = words(journey("protected"));
    expect(stay).toContain("Your payment is protected.");
    expect(stay).toContain("Vallo does not hold your funds.");
    expect(stay).toContain("Have you checked in?");
    expect(words(journey("protected-rent"))).toContain("Do you have the keys?");
  });

  it("every later state has its words", () => {
    expect(words(journey("released"))).toContain("Payment released");
    expect(words(journey("dispute"))).toContain("You raised a problem");
    expect(words(journey("refunded"))).toContain("Refund confirmed");
    expect(words(journey("review"))).toContain("A person at Vallo is looking at this payment");
    expect(words(journey("expired"))).toContain("These transfer details have expired");
  });

  it("the lister never sees a balance", () => {
    const text = words(renderToStaticMarkup(<ListerProtectedView deal={PREVIEW_DEALS.protected!} now={PREVIEW_NOW} locale="en" />));
    expect(text).toContain("Protected transaction amount");
    expect(text).toContain("This is not a balance you can spend.");
    expect(text).not.toMatch(/wallet|available funds|your balance/i);
  });
});

describe.skipIf(!hasBrowser && !process.env.CI)("the protected payment screens (axe)", () => {
  it.each(["funding", "waiting", "protected", "released", "dispute", "expired"])("%s has no axe violations", async (key) => {
    expect(await axe(journey(key))).toEqual([]);
  });
  it("screen 1 and 2 have no axe violations", async () => {
    expect(
      await axe(renderToStaticMarkup(<ChooseHowToPay deal={PREVIEW_DEALS.funding!} offer={{ state: "offered", quote }} cardAllowed locale="en" onContinue={noop} />)),
    ).toEqual([]);
    expect(
      await axe(renderToStaticMarkup(<ReviewProtection deal={PREVIEW_DEALS.funding!} quote={quote} agreementVersion={3} locale="en" onAgree={noop} />)),
    ).toEqual([]);
  });
});
