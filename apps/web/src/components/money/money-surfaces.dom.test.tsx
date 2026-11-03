import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, describe, expect, it } from "vitest";
import { axe, closeAxe, hasBrowser } from "@/lib/a11y/axe";
import type { HistoryEntry } from "@/lib/money/history-model";
import type { Balances, WithdrawalQuote } from "@/lib/money/vallo";
import { MoneyCentre } from "./MoneyCentre";
import { PayoutList } from "./PayoutList";
import { ReceiptVault } from "./ReceiptVault";
import { ReferenceList } from "./ReferenceList";
import { TransactionTimeline } from "./TransactionTimeline";
import { WithdrawalMaths } from "./WithdrawalMaths";

afterAll(closeAxe);

/* Test values only: structural names, the founder's worked figures. */
const balances: Balances = { availableMinor: 245_000_00, protectedMinor: 1_800_000_00, currency: "NGN", heldBy: "Partner Name", asOf: "2026-10-06T08:30:00Z" };
const quote: WithdrawalQuote = {
  intentId: "i",
  amountMinor: 1_000_000_00,
  processingFeeMinor: 300_00,
  receiveMinor: 999_700_00,
  currency: "NGN",
  destination: { bankName: "Bank", accountName: "Account Name", last4: "1234" },
  expiresAt: "2099-01-01T00:00:00Z",
};
const NOW = Date.parse("2026-10-06T09:00:00Z");

function row(over: Partial<HistoryEntry>): HistoryEntry {
  return {
    id: "r", kind: "payment", occurredAt: "2026-10-01T10:00:00Z", amountMinor: 100_00, direction: "out", status: "successful",
    reference: "ref-1", title: "Space title", bookingId: "b1", grossMinor: null, guaranteeMinor: null, commissionMinor: null,
    listerShareMinor: null, payerName: null, payeeName: null, ...over,
  };
}

describe("the money centre: Available and Protected never look alike", () => {
  const html = renderToStaticMarkup(<MoneyCentre balances={balances} locale="en" />);

  it("draws two figures on two different materials, each with its own sentence", () => {
    expect(html).toMatch(/nf-pot nf-pot--available[\s\S]*Available[\s\S]*245,000[\s\S]*Yours to withdraw/);
    expect(html).toMatch(/nf-pot nf-pot--protected[\s\S]*Protected[\s\S]*1,800,000[\s\S]*Not yours to withdraw yet/);
  });

  it("names who holds both, says Vallo does not, and says when", () => {
    expect(html).toContain("your own account with Partner Name");
    expect(html).toContain("Vallo does not hold customer funds.");
    expect(html).toContain("As Partner Name reported it");
  });

  it("draws no figure at all when the read is absent or carries no time", () => {
    for (const out of [
      renderToStaticMarkup(<MoneyCentre balances={null} locale="en" />),
      renderToStaticMarkup(<MoneyCentre balances={{ ...balances, asOf: "not a time" }} locale="en" />),
    ]) {
      expect(out).toContain('data-state="absent"');
      expect(out).not.toMatch(/₦/);
    }
  });
});

describe("withdrawal shows its maths before the confirm", () => {
  const confirm = (ok: boolean) => <button type="button" disabled={!ok}>Confirm withdrawal</button>;

  it("prints amount, the fee read back and what reaches the bank", () => {
    const html = renderToStaticMarkup(<WithdrawalMaths withdrawal={{ state: "ready", quote }} locale="en" now={NOW} action={confirm} />);
    expect(html).toMatch(/Amount[\s\S]*1,000,000[\s\S]*Processing fee[\s\S]*300[\s\S]*You&#x27;ll receive[\s\S]*999,700/);
    expect(html).toContain("read back from it. It is not an estimate.");
    expect(html).not.toContain("disabled");
  });

  it("waits for the partner's fee: no total, no confirm", () => {
    const html = renderToStaticMarkup(<WithdrawalMaths withdrawal={{ state: "waiting", amountMinor: 1_000_000_00 }} locale="en" now={NOW} action={confirm} />);
    expect(html).toContain("Being set by our payment partner");
    expect(html).not.toContain("You&#x27;ll receive");
    expect(html).toContain("disabled");
  });

  it("treats a quote that does not add up, or has expired, as no quote", () => {
    const wrong = renderToStaticMarkup(<WithdrawalMaths withdrawal={{ state: "ready", quote: { ...quote, receiveMinor: 999_800_00 } }} locale="en" now={NOW} action={confirm} />);
    expect(wrong).not.toContain("999,800");
    expect(wrong).toContain("disabled");
    const stale = renderToStaticMarkup(<WithdrawalMaths withdrawal={{ state: "ready", quote: { ...quote, expiresAt: "2026-10-06T08:00:00Z" } }} locale="en" now={NOW} action={confirm} />);
    expect(stale).toContain('data-state="expired"');
    expect(stale).toContain("disabled");
  });
});

describe("the timeline speaks in sentences", () => {
  it("never shows a status name", () => {
    const html = renderToStaticMarkup(
      <TransactionTimeline events={[{ kind: "protected", at: "2026-10-01T09:21:00Z", amountMinor: 100_00 }]} viewer="payer" locale="en" next="Released when you confirm." />,
    );
    expect(html).toContain("held by our licensed payment partner until you confirm");
    expect(html.replace(/<[^>]*>/g, " ")).not.toMatch(/ESCROW|OPENED|[a-z]_[a-z]/);
    expect(html).toContain('data-testid="timeline-next"');
  });
});

describe("the receipt vault and payouts", () => {
  const vault = renderToStaticMarkup(
    <ReceiptVault entries={[row({})]} scanned={12} kind="all" query="space" basePath="/receipts" locale="en" />,
  );

  it("searches by a plain GET form, filters by link, and is honest about its reach", () => {
    expect(vault).toMatch(/<form[^>]*action="\/receipts"[^>]*method="get"/);
    expect(vault).toContain("Searching the records on this page (12)");
    expect(vault).toContain('href="/receipts?kind=refund&amp;q=space"');
  });

  it("labels the reference as Vallo's transaction reference and opens the booking", () => {
    expect(vault).toContain("Transaction ref-1");
    expect(vault).toContain('href="/bookings/b1"');
  });

  it("prints a payout's figures from the record, adding up", () => {
    const html = renderToStaticMarkup(
      <PayoutList entries={[row({ kind: "earning", direction: "in", grossMinor: 1_800_000_00, commissionMinor: 72_000_00, guaranteeMinor: 0, amountMinor: 1_728_000_00 })]} locale="en" />,
    );
    expect(html).toMatch(/Renter or guest paid[\s\S]*1,800,000[\s\S]*Platform fee[\s\S]*72,000[\s\S]*You received[\s\S]*1,728,000/);
    expect(html).not.toContain("Payment processing");
  });

  it("draws no chain hash for a fiat payment", () => {
    const html = renderToStaticMarkup(<ReferenceList references={[{ kind: "transaction", value: "t" }, { kind: "chain", value: "0xabc" }]} settlement="fiat" />);
    expect(html).not.toContain("0xabc");
  });
});

describe.skipIf(!hasBrowser && !process.env.CI)("the money surfaces (axe)", () => {
  it.each([
    ["money centre", <MoneyCentre key="a" balances={balances} locale="en" />],
    ["money centre absent", <MoneyCentre key="b" balances={null} locale="en" />],
    ["withdrawal ready", <WithdrawalMaths key="c" withdrawal={{ state: "ready", quote }} locale="en" now={NOW} />],
    ["withdrawal waiting", <WithdrawalMaths key="d" withdrawal={{ state: "waiting", amountMinor: 100_00 }} locale="en" now={NOW} />],
    ["timeline", <TransactionTimeline key="e" events={[{ kind: "payment_confirmed", at: "2026-10-01T09:20:00Z", amountMinor: 100_00 }]} viewer="payee" locale="en" />],
    ["vault", <ReceiptVault key="f" entries={[row({})]} scanned={1} kind="all" query="" basePath="/receipts" locale="en" />],
    ["payouts", <PayoutList key="g" entries={[row({ kind: "earning", grossMinor: 200_00, commissionMinor: 4_00, amountMinor: 196_00 })]} locale="en" />],
  ] as const)("%s has no axe violations", async (_name, node) => {
    expect(await axe(`<h1>Money</h1>${renderToStaticMarkup(node)}`)).toEqual([]);
  });
});
