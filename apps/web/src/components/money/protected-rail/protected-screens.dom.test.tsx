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
const { ProtectedReceipt } = await import("./ProtectedReceipt");
const { PROTECTED_FUNDS_WORDING_FULL } = await import("@/lib/money/protected-wording");

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

describe("the screens nobody asks for", () => {
  const blame = /your fault|you sent the wrong|you made a mistake|you failed|you should have/i;
  const promise = /within \d|in \d+ (minutes|hours|days)|by tomorrow|soon\b/i;

  it.each([
    ["partner-unavailable", "We can't reach the payment partner just now"],
    ["wrong-amount", "We received a different amount"],
    ["late-transfer", "A transfer arrived after the details expired"],
    ["duplicate-transfer", "We received more than one transfer"],
    ["release-delayed", "The release is taking longer than usual"],
    ["refund-delayed", "Your refund is taking longer than usual"],
  ])("%s has its words, an icon and what happens next, blames nobody and promises no time", (key, title) => {
    const out = journey(key);
    const text = words(out);
    expect(text).toContain(title);
    expect(text).toContain("What happens now");
    expect(out).toContain('data-testid="pp-issue-pill"');
    expect(out).toContain("<svg");
    expect(text).not.toMatch(blame);
    expect(text).not.toMatch(promise);
  });

  it("a wrong amount shows the agreed amount, the amount received and the difference, and never asks for a top-up", () => {
    const text = words(journey("wrong-amount"));
    expect(text).toContain("Agreed amount");
    expect(text).toContain("Amount received");
    expect(text).toContain("Difference");
    expect(text).toMatch(/don't send another transfer/i);
    expect(text).not.toMatch(/Your payment is protected/);
  });

  it("a partner that does not answer shows the last confirmed status as that, with its time", () => {
    const text = words(journey("partner-unavailable"));
    expect(text).toContain("Last confirmed status");
    expect(text).toMatch(/Last confirmed 10 Nov/);
  });

  it("the lister is told to add a payout account, and sees a review in their own words", () => {
    const payout = renderToStaticMarkup(<ListerProtectedView deal={PREVIEW_DEALS["lister-payout"]!} now={PREVIEW_NOW} locale="en" />);
    expect(words(payout)).toContain("Add a payout account to be paid");
    expect(payout).toContain('href="/payouts"');
    const review = words(renderToStaticMarkup(<ListerProtectedView deal={PREVIEW_DEALS["lister-review"]!} now={PREVIEW_NOW} locale="en" />));
    expect(review).toContain("doesn't match the agreement");
  });
});

describe("the protected receipt", () => {
  it("names the custodian in the provider's full words, carries the partner's reference and the release history, and keeps help inside it", () => {
    const out = renderToStaticMarkup(<ProtectedReceipt deal={PREVIEW_DEALS.receipt!} now={PREVIEW_NOW} locale="en" paymentHref="/x" />);
    const text = words(out);
    expect(text).toContain(PROTECTED_FUNDS_WORDING_FULL);
    expect(text).toContain("Vallo does not hold your funds.");
    expect(text).toContain("EXAMPLE-REF-0001");
    expect(text).toContain("The bank confirmed it received the transfer");
    expect(text).toContain("The bank confirmed the release");
    expect(text).toContain("Something wrong with this payment?");
    expect(text).toContain("Who is holding this?");
    expect(text).toContain("It is not a bank statement.");
  });

  it("is not drawn before the outcome is confirmed", () => {
    expect(renderToStaticMarkup(<ProtectedReceipt deal={PREVIEW_DEALS.protected!} now={PREVIEW_NOW} locale="en" paymentHref="/x" />)).toBe("");
  });
});

describe.skipIf(!hasBrowser && !process.env.CI)("the protected payment screens (axe)", () => {
  it.each(["partner-unavailable", "wrong-amount", "late-transfer", "duplicate-transfer", "release-delayed", "refund-delayed"])(
    "%s has no axe violations",
    async (key) => {
      expect(await axe(journey(key))).toEqual([]);
    },
  );
  it("the lister's payout warning and the receipt have no axe violations", async () => {
    expect(await axe(renderToStaticMarkup(<ListerProtectedView deal={PREVIEW_DEALS["lister-payout"]!} now={PREVIEW_NOW} locale="en" />))).toEqual([]);
    expect(
      await axe(
        renderToStaticMarkup(
          <main>
            <h1>Your payment</h1>
            <ProtectedReceipt deal={PREVIEW_DEALS.receipt!} now={PREVIEW_NOW} locale="en" paymentHref="/x" />
          </main>,
        ),
      ),
    ).toEqual([]);
  });

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
