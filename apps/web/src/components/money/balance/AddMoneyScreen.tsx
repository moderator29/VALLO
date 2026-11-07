"use client";

import { banner } from "@/lib/ui/toast";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Locale } from "@vallo/i18n/core";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { StepFrame } from "@/components/ui/StepFrame";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { confirmDepositPaid, prepareDeposit, type DepositStart } from "@/lib/money/member-wallet-actions";
import type { MovementView } from "@/lib/money/member-wallet";
import { ACTION_LABEL, MOVE_COPY } from "@/lib/money/balance-copy";
import { ADD_QUICK_NAIRA, groupNaira } from "@/lib/money/wallet-view";
import { MoneyFigure } from "../kit";
import { Watching } from "./balance-ui";
import { reach } from "./reach";
import { WALLET_LINKS, WalletHeader, type WalletLinks } from "./WalletChrome";
import { AmountEntry, AvailableLine, Keypad, NotAvailable, PickArt, PickRow, QuickChips, Summary, type QuickAmount } from "./MoveKit";
import "@/app/css/money-wallet.css";

/**
 * ADD MONEY (Part B phase 7; D81, the Supay reference's top up): the amount,
 * quick chips, the payment method, Continue, the keypad; then the amount read
 * back; then the provider's own hosted payment page (never a Vallo bank
 * account); then the waiting room until the provider says it landed.
 *
 * "Add money" is the product's word for it (the brief: one consistent label),
 * so the Supay "Top up" is this screen under the platform's own name. There
 * is one way to pay in today, the provider's payment page (bank transfer or
 * card on their page), so the method sheet shows that one, chosen, and says
 * so. Not connected, the last step says plainly it is not available yet and
 * nothing is asked of anyone.
 */
type Step = "amount" | "confirm" | "pay" | "waiting" | "unavailable";

const CHIPS: QuickAmount[] = [...ADD_QUICK_NAIRA.map((n) => ({ label: `₦${groupNaira(String(n))}`, naira: n })), { label: MOVE_COPY.others, naira: null }];

const TEST_LABEL: Record<string, string> = {
  bankName: "Bank",
  accountNumber: "Account number",
  accountName: "Account name",
  amount: "Amount",
};

export function AddMoneyScreen({
  availableMinor,
  connected,
  locale,
  links = WALLET_LINKS,
  initial,
}: {
  availableMinor: number | null;
  connected: boolean;
  locale: Locale;
  links?: WalletLinks;
  /** The preview harness's way in to a later step, with sample data it labels. */
  initial?: { step?: Step; amount?: string; movement?: MovementView };
}) {
  const router = useRouter();
  const [clientKey, setClientKey] = useState(() => crypto.randomUUID());
  const [step, setStep] = useState<Step>(initial?.step ?? "amount");
  const [amount, setAmount] = useState(initial?.amount ?? "");
  const [methodOpen, setMethodOpen] = useState(false);
  const [start, setStart] = useState<DepositStart | null>(null);
  const [movement, setMovement] = useState<MovementView | null>(initial?.movement ?? null);
  const [busy, setBusy] = useState(false);

  const minor = amount ? Number(amount) * 100 : 0;

  const begin = async () => {
    if (!connected) {
      setStep("unavailable");
      return;
    }
    setBusy(true);
    const r = await reach(() => prepareDeposit({ clientKey, amount }));
    setBusy(false);
    if (!r.ok) {
      banner.error(r.error);
      if (!r.unreached) setClientKey(crypto.randomUUID());
      return;
    }
    setStart(r.data);
    setStep("pay");
  };

  const paid = async () => {
    if (!start) return;
    setBusy(true);
    const r = await reach(() => confirmDepositPaid({ movementId: start.movement.id }));
    setBusy(false);
    if (!r.ok) {
      banner.error(r.error);
      return;
    }
    /* Said by the one banner at the top of the screen (Grade 1). */
    if (r.data.message) banner.info(r.data.message);
    if (r.data.movement.status !== "awaiting_payment") {
      setMovement(r.data.movement);
      setStep("waiting");
    }
  };

  /* SW5 (round 3): the amount, the check and the payment stand in the
     platform's STEP FRAME; the keypad stays in the content. The outcomes keep
     the wallet's own top. Every gate, key and reach is unchanged. */
  const framed = step === "amount" || step === "confirm" || step === "pay";
  const body = (
    <div className="nf-balance nf-mw" data-screen="add" data-testid="wallet-add" data-step={step}>
      {framed ? null : <WalletHeader title={ACTION_LABEL.add} back={links.overview} />}

      {step === "amount" ? (
        <div className="nf-mw-move">
          <AvailableLine minor={availableMinor} locale={locale} connected={connected} />
          <AmountEntry value={amount} onChange={setAmount} label="Amount to add" hint="From your own bank or card. The smallest amount is ₦100." />
          <QuickChips chips={CHIPS} value={amount} onChange={setAmount} />
          <PickRow
            label={MOVE_COPY.method}
            value={MOVE_COPY.methodName}
            lead={<PickArt name="cards-stack-orange" />}
            onOpen={() => setMethodOpen(true)}
            testId="add-method"
          />
          <div className="nf-mw-foot">
            <Keypad value={amount} onChange={setAmount} />
          </div>
        </div>
      ) : null}

      {step === "confirm" ? (
        <div className="nf-mw-move">
          <div className="nf-mw-amount">
            <MoneyFigure minor={minor} locale={locale} size="hero" kobo="auto" />
          </div>
          <Summary
            rows={[
              { label: "Amount", value: <MoneyFigure minor={minor} locale={locale} size="row" kobo="auto" /> },
              { label: MOVE_COPY.method, value: MOVE_COPY.methodName },
              { label: "Added", value: "Once your bank confirms" },
            ]}
          />
        </div>
      ) : null}

      {step === "unavailable" ? <NotAvailable body={MOVE_COPY.notAvailableAdd} back={links.overview} /> : null}

      {step === "pay" && start ? (
        <div className="nf-mw-move">
          <div className="nf-mw-amount">
            <MoneyFigure minor={start.movement.amountMinor} locale={locale} size="hero" kobo="auto" />
          </div>
          {start.hosted.kind === "checkout_url" ? (
            <>
              <p className="nf-body-sm text-center text-[var(--nf-content-secondary)]">
                The payment page opens in a new tab. Come back here when you have paid; nothing is added until your bank confirms.
              </p>
              <Button variant="primary" size="lg" full onClick={() => window.open(start.hosted.kind === "checkout_url" ? start.hosted.url : "", "_blank", "noopener")}>
                Open the payment page
              </Button>
            </>
          ) : start.hosted.kind === "test_account" ? (
            <div className="nf-panel nf-panel--card grid gap-xs" data-testid="balance-test-account">
              <p className="nf-overline text-[var(--nf-content-muted)]">Test environment: pay into this test account</p>
              <dl className="nf-maths">
                {Object.entries(start.hosted.details).map(([k, v]) => (
                  <div className="nf-maths__row" key={k}>
                    <dt>{TEST_LABEL[k] ?? k}</dt>
                    <dd className="font-mono">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}
          <Button variant="secondary" size="lg" full loading={busy} onClick={paid}>
            I have paid
          </Button>
          <p className="nf-caption text-center text-[var(--nf-content-muted)]">Reference {start.movement.reference}</p>
        </div>
      ) : null}

      {step === "waiting" && movement ? (
        <div className="grid gap-block pb-block">
          <Watching kind="deposit" movement={movement} locale={locale} onDone={() => router.push(links.overview)} onSettled={() => router.refresh()} />
        </div>
      ) : null}

      <Sheet open={methodOpen} onOpenChange={setMethodOpen} title={MOVE_COPY.methodSheet} testId="add-method-sheet">
        <div className="grid gap-block pb-block">
          <div className="nf-mw-panel nf-mw-pick" aria-current="true">
            <PickArt name="cards-stack-orange" />
            <span className="nf-mw-pick__text">
              <span className="nf-mw-pick__value">{MOVE_COPY.methodName}</span>
              <span className="nf-mw-pick__label">{MOVE_COPY.methodSub}</span>
            </span>
            <UiIcon name="circle-check" size={22} className="text-[var(--nf-brand-primary)]" />
          </div>
          <p className="nf-caption text-[var(--nf-content-muted)]">{MOVE_COPY.methodOnly}</p>
          <Button variant="primary" size="lg" full onClick={() => setMethodOpen(false)}>
            Done
          </Button>
        </div>
      </Sheet>
    </div>
  );

  if (!framed) return body;
  const at = step === "amount" ? 1 : step === "confirm" ? 2 : 3;
  return (
    <StepFrame
      testId="add-steps"
      step={at}
      total={3}
      eyebrow={ACTION_LABEL.add}
      title={step === "amount" ? ADD_STEP.amount : step === "confirm" ? MOVE_COPY.review : ADD_STEP.pay}
      direction={at === 1 ? "back" : "forward"}
      {...(step === "confirm" ? { onBack: () => setStep("amount") } : {})}
      closeHref={links.overview}
      {...(step === "amount"
        ? { primary: { label: MOVE_COPY.continue, onClick: () => setStep("confirm"), disabled: !amount, testId: "move-continue" } }
        : step === "confirm"
          ? {
              primary: { label: "Continue to pay", onClick: begin, loading: busy, testId: "move-confirm" },
              secondary: { label: "Change amount", onClick: () => setStep("amount") },
            }
          : {})}
    >
      {body}
    </StepFrame>
  );
}

/* The step titles adding money did not have words for. */
const ADD_STEP = { amount: "How much to add", pay: "Pay from your bank" } as const;
