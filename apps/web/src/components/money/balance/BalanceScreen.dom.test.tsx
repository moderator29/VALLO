import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { MovementView } from "@/lib/money/member-wallet";
import type { BalanceFigures } from "@/lib/money/funds";
import { ACTIVITY_EMPTY, HELD_BY, MOVE_COPY, NOT_CONNECTED_FIGURE, NOT_CONNECTED_LINE, WALLET_TOOL_GROUPS } from "@/lib/money/balance-copy";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh() {}, push() {}, back() {}, replace() {} }),
  usePathname: () => "/wallet",
}));
/* The header's back is the shared `BackControl`, which reads the words the
   root layout provides; these screens are rendered bare here, so the English
   copy stands in for the provider. */
vi.mock("@/lib/i18n/client-copy", async () => {
  const { getDictionary } = await import("@vallo/i18n");
  const { clientCopyOf } = await import("@/lib/i18n/client-copy-of");
  const copy = clientCopyOf(getDictionary("en"));
  return {
    ClientCopyProvider: ({ children }: { children: React.ReactNode }) => children,
    useClientCopy: () => copy,
    useClientCopyOptional: () => copy,
  };
});
vi.mock("@/lib/money/member-wallet-actions", () => ({
  balanceMovementStatus: vi.fn(),
  cancelBalanceMovement: vi.fn(),
  checkBalanceBankAccount: vi.fn(),
  confirmBalanceMovement: vi.fn(),
  confirmDepositPaid: vi.fn(),
  findBalanceRecipient: vi.fn(),
  listBalanceBanks: vi.fn(),
  openBalanceAccount: vi.fn(),
  prepareDeposit: vi.fn(),
  prepareSend: vi.fn(),
  prepareWithdrawal: vi.fn(),
}));

const { BalanceScreen } = await import("./BalanceScreen");
const { TransactionsScreen } = await import("./TransactionsScreen");
const { WalletSettingsScreen } = await import("./WalletSettingsScreen");
const { SendScreen } = await import("./SendScreen");
const { AddMoneyScreen } = await import("./AddMoneyScreen");
const { WithdrawScreen } = await import("./WithdrawScreen");
const { WaitingRoom } = await import("./balance-ui");
const { BalanceOnboarding } = await import("./BalanceOnboarding");

/* Test values only, the founder's section 37 figures. */
const AT = "2026-10-07T10:00:00.000Z";
const NOW = Date.parse(AT) + 3 * 60_000;
const figures: BalanceFigures = {
  available: { minor: 2_450_000_00, confirmedAt: AT },
  protected: { minor: 850_000_00, confirmedAt: AT },
  pending: { minor: 50_000_00, confirmedAt: AT },
  processing: { minor: 0, confirmedAt: null },
  currency: "NGN",
};
const withdrawal: MovementView = {
  id: "6b1f1c1e-1111-4a4a-8888-000000000001",
  kind: "withdrawal",
  status: "processing",
  amountMinor: 250_000_00,
  providerFeeMinor: 50_00,
  currency: "NGN",
  counterparty: { bank: "Test Bank", last4: "4821", name: "ADA EZE" },
  reference: "rm-plw-6b1f1c1e-1111-4a4a-8888-000000000001",
  createdAt: AT,
  observedAt: AT,
  confirmedByProvider: false,
};
const received: MovementView = { ...withdrawal, id: "r-1", kind: "transfer_in", status: "completed", amountMinor: 30_000_00, counterparty: {}, reference: "r-1" };
const sent: MovementView = { ...withdrawal, id: "s-1", kind: "transfer_out", status: "completed", amountMinor: 45_000_00, counterparty: { name: "Tunde A." }, reference: "s-1" };

const text = (html: string) => html.replace(/<[^>]+>/g, " ");

function render(live: boolean, movements: MovementView[] = [withdrawal]) {
  return renderToStaticMarkup(
    <BalanceScreen figures={figures} movements={movements} live={live} locale="en" now={NOW} totals={{ inMinor: 1_380_000_00, outMinor: 345_000_00, count: 4 }} />,
  );
}

describe("the Wallet overview (D81)", () => {
  it("leads with Available, says when it was confirmed, and shows the other three apart from it", () => {
    const html = render(true);
    expect(html).toContain("2,450,000");
    expect(html).toContain("Confirmed 3 minutes ago");
    for (const label of ["Held for a deal", "Pending", "Processing"]) expect(html).toContain(label);
    expect(html).toContain("850,000");
  });

  it("shows Money in and Money out from the server's sums, never its own", () => {
    const html = render(true);
    expect(html).toContain("Money in");
    expect(html).toContain("1,380,000");
    expect(html).toContain("Money out");
    expect(html).toContain("345,000");
  });

  it("has exactly two capsules at the foot, Withdraw and Send, and no second Withdraw or Send anywhere", () => {
    const html = render(true);
    expect((html.match(/class="nf-mw-cap /g) ?? []).length).toBe(2);
    expect(html).toContain('data-testid="balance-action-withdraw"');
    expect(html).toContain('data-testid="balance-action-send"');
    expect(html).toContain('href="/wallet/withdraw"');
    expect(html).toContain('href="/wallet/send"');
    expect((html.match(/href="\/wallet\/withdraw"/g) ?? []).length).toBe(1);
    expect((html.match(/href="\/wallet\/send"/g) ?? []).length).toBe(1);
    expect(text(html)).not.toMatch(/\bTransfer\b/);
  });

  it("says our licensed provider holds the money, and never names the provider (28 October 2026)", () => {
    const html = render(true);
    expect(html).not.toContain("Payluk");
    expect(html).toContain(HELD_BY);
  });

  it("says when the figures could not be refreshed", () => {
    expect(render(false)).toContain("last figures we confirmed");
  });

  it("keeps a movement that is still on its way in words, not as done", () => {
    const html = render(true);
    expect(html).toContain("On its way to your bank");
    expect(html).not.toContain("Completed");
  });

  it("has an empty state that says what will appear", () => {
    expect(render(true, [])).toContain(ACTIVITY_EMPTY.title);
  });

  it("opens the full history from See all, and carries the tools group, not a second bottom bar", () => {
    const html = render(true);
    expect(html).toContain('href="/wallet/transactions"');
    for (const href of ["/receipts", "/payouts", "/refunds", "/wallet/settings"]) expect(html).toContain(`href="${href}"`);
    expect(html).not.toContain("nf-tabbar");
  });

  it("calls itself a wallet, never a balance, in what a member reads", () => {
    expect(text(render(true))).not.toMatch(/\bbalance\b/i);
  });

  it("goes back through the shared back control, named for where it goes, not a hand-drawn link", () => {
    const html = render(true);
    expect(html).toContain("data-nav-back");
    expect(html).toContain('data-back-destination="/home"');
    expect(html).toContain('aria-label="Back to Home"');
    expect(html).not.toMatch(/<a[^>]*data-testid="wallet-back"/);
  });
});

describe("the Wallet before it is connected (founder, 7 October)", () => {
  const html = renderToStaticMarkup(<BalanceScreen figures={null} movements={[]} live={false} connected={false} reason="switched_off" locale="en" now={0} />);
  const words = text(html);

  it("draws the whole Wallet: the card, Add money, the two capsules and the activity", () => {
    expect(html).toContain('data-testid="balance-not-live"');
    expect(html).toContain('data-testid="balance-card"');
    for (const a of ["add", "withdraw", "send"]) expect(html).toContain(`data-testid="balance-action-${a}"`);
    expect(html).toContain('data-testid="balance-activity-empty"');
    expect(words).toContain("Withdraw");
    expect(words).toContain("Send");
  });

  it("shows no figure, not even a zero, and says why in one short line", () => {
    expect(words).toContain(NOT_CONNECTED_FIGURE);
    expect(words).toContain(NOT_CONNECTED_LINE);
    expect(words).not.toMatch(/₦\s*\d|\d[\d,]*\.\d\d/);
    expect(html).not.toContain('data-testid="balance-available"');
  });

  it("names no provider and carries no paragraph about partners or rails", () => {
    expect(words).not.toMatch(/Payluk|escrow|partner|rail/i);
  });
});

describe("the Transactions screen (D81; the brief, section 4)", () => {
  const all = [withdrawal, received, sent];

  it("filters by the kinds the ledger stores, and draws no Withdraw or Send capsule", () => {
    const html = renderToStaticMarkup(<TransactionsScreen figures={figures} movements={all} locale="en" />);
    expect((html.match(/data-testid="wallet-row"/g) ?? []).length).toBe(3);
    for (const f of ["all", "received", "added", "sent", "withdrawals"]) expect(html).toContain(`data-testid="transactions-filter-${f}"`);
    expect(html).not.toContain("nf-mw-cap");
    expect(html).not.toContain("Bills");
  });

  it("shows only the chosen kind", () => {
    const html = renderToStaticMarkup(<TransactionsScreen figures={figures} movements={all} locale="en" initialFilter="sent" />);
    expect((html.match(/data-testid="wallet-row"/g) ?? []).length).toBe(1);
    expect(html).toContain('data-kind="transfer_out"');
    expect(html).toContain("To: Tunde A.");
  });

  it("says plainly when a filter has nothing", () => {
    const html = renderToStaticMarkup(<TransactionsScreen figures={figures} movements={all} locale="en" initialFilter="added" />);
    expect(html).toContain("No money added yet");
  });
});

describe("the tools destination (the brief, section 5)", () => {
  it("leads every tool to a real screen, cards and bank accounts as one", () => {
    const html = renderToStaticMarkup(<WalletSettingsScreen />);
    const hrefs = WALLET_TOOL_GROUPS.flatMap((g) => g.tools.map((t) => t.href));
    for (const href of hrefs) expect(html).toContain(`href="${href}"`);
    expect((html.match(/href="\/settings\/payments"/g) ?? []).length).toBe(1);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});

describe("the move-money screens never fake a success", () => {
  it("say plainly at the last step that it is not available yet, and show nothing as sent", () => {
    for (const html of [
      renderToStaticMarkup(<SendScreen availableMinor={null} connected={false} locale="en" initial={{ step: "unavailable", amount: "45000" }} />),
      renderToStaticMarkup(<AddMoneyScreen availableMinor={null} connected={false} locale="en" initial={{ step: "unavailable", amount: "5000" }} />),
      renderToStaticMarkup(<WithdrawScreen availableMinor={null} connected={false} locale="en" initial={{ step: "unavailable", amount: "5000" }} />),
    ]) {
      expect(html).toContain('data-testid="move-not-available"');
      expect(html).toContain(MOVE_COPY.notAvailableTitle);
      expect(text(html)).not.toMatch(/\bSent\b|Successful|Completed/);
    }
  });

  it("draw the Supay steps: amount, quick chips, a choice row, reasons, Continue and a keypad", () => {
    const html = renderToStaticMarkup(<SendScreen availableMinor={2_450_000_00} connected locale="en" />);
    for (const id of ["move-available", "move-amount", "move-quick", "send-recipient", "send-reasons", "move-continue", "move-keypad"]) expect(html).toContain(`data-testid="${id}"`);
    for (const reason of ["Rent", "Booking", "Split bill", "Gift", "Business", "Other"]) expect(html).toContain(`>${reason}<`);
  });

  it("will not continue a live send without a recipient the server named", () => {
    const html = renderToStaticMarkup(<SendScreen availableMinor={2_450_000_00} connected locale="en" initial={{ amount: "45000" }} />);
    expect(html).toMatch(/<button(?=[^>]*data-testid="move-continue")[^>]*disabled=""/);
  });
});

describe("the waiting room", () => {
  it("ticks only what the record says, and promises no time", () => {
    const html = renderToStaticMarkup(<WaitingRoom movement={withdrawal} locale="en" kind="withdrawal" />);
    expect(html).toContain('data-status="processing"');
    expect((html.match(/data-done="true"/g) ?? []).length).toBe(1);
    expect(html).toContain("You will not be charged twice");
    expect(html).not.toMatch(/%|seconds/);
  });

  it("an unknown outcome tells the member not to try again", () => {
    const html = renderToStaticMarkup(<WaitingRoom movement={{ ...withdrawal, status: "unknown" }} locale="en" kind="withdrawal" />);
    expect(html).toContain("Please do not try again");
  });

  it("done is said only for a completed movement", () => {
    const html = renderToStaticMarkup(<WaitingRoom movement={{ ...withdrawal, status: "completed" }} locale="en" kind="withdrawal" />);
    expect(html).toContain("Confirmed. This is done.");
    expect((html.match(/data-done="true"/g) ?? []).length).toBe(3);
  });
});

describe("financial onboarding", () => {
  it("is not a form: it explains, lists what is missing, and opens with one button", () => {
    const html = renderToStaticMarkup(<BalanceOnboarding state="VERIFICATION_REQUIRED" gaps={["phone"]} />);
    expect(html).not.toContain("<input");
    expect(html).toContain("A Nigerian mobile number");
    expect(html).toContain("/settings/phone");
    expect(html).toContain("Vallo never holds it");
  });
});
