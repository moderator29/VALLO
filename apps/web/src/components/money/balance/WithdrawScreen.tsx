"use client";

import { banner } from "@/lib/ui/toast";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@vallo/i18n/core";
import { Button } from "@/components/ui/Button";
import { DragToConfirm } from "@/components/ui/DragToConfirm";
import { SelectField, TextField } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import {
  cancelBalanceMovement,
  checkBalanceBankAccount,
  confirmBalanceMovement,
  listBalanceBanks,
  prepareWithdrawal,
  type Quote,
} from "@/lib/money/member-wallet-actions";
import type { MovementView } from "@/lib/money/member-wallet";
import { ACTION_LABEL, MOVE_COPY } from "@/lib/money/balance-copy";
import { lastFour } from "@/lib/money/funds";
import { shareChips } from "../AmountPad";
import { Breakdown, Watching } from "./balance-ui";
import { reach } from "./reach";
import { WALLET_LINKS, WalletHeader, type WalletLinks } from "./WalletChrome";
import { AmountEntry, AvailableLine, Keypad, NotAvailable, PickArt, PickRow, QuickChips, type QuickAmount } from "./MoveKit";
import "@/app/css/money-wallet.css";

/**
 * WITHDRAW (Part B phase 8, the founder's fourteen steps; phase 9's check;
 * D81's screen): the Available line, the amount, "Withdraw to" with Change
 * (bank, account number, the bank names the account, the member says it is
 * theirs), Continue; then the provider's fee on a staged intent and the seven
 * figures, slide to withdraw, the code if asked, and the waiting room until
 * the bank confirms. Nothing is guessed in the browser: the name, the fee and
 * every total come back from the server. Not connected, the last step says
 * plainly it is not available yet.
 */
type Step = "amount" | "review" | "otp" | "waiting" | "unavailable";
type Account = { bankCode: string; bankName: string; accountNumber: string; accountName: string };

export function WithdrawScreen({
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
  initial?: { step?: Step; amount?: string; account?: Account; quote?: Quote; movement?: MovementView };
}) {
  const router = useRouter();
  const [clientKey, setClientKey] = useState(() => crypto.randomUUID());
  const [step, setStep] = useState<Step>(initial?.step ?? "amount");
  const [amount, setAmount] = useState(initial?.amount ?? "");
  const [account, setAccount] = useState<Account | null>(initial?.account ?? null);
  const [toOpen, setToOpen] = useState(false);
  const [banks, setBanks] = useState<{ name: string; code: string }[] | null>(null);
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [named, setNamed] = useState<string | null>(null);
  const [quote, setQuote] = useState<Quote | null>(initial?.quote ?? null);
  const [movement, setMovement] = useState<MovementView | null>(initial?.movement ?? null);
  const [otp, setOtp] = useState("");
  /* The code step's own instruction (where the code went). Every outcome is
     said by the one banner at the top of the screen (Grade 1). */
  const [otpNote, setOtpNote] = useState<string | null>(null);
  const [toError, setToError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const bankName = banks?.find((b) => b.code === bankCode)?.name ?? "";
  const chips: QuickAmount[] = availableMinor !== null ? shareChips(availableMinor) : [];
  const ready = Boolean(amount) && (connected ? account !== null : true);

  useEffect(() => {
    if (!toOpen || banks || !connected) return;
    let live = true;
    void reach(() => listBalanceBanks()).then((r) => {
      if (!live) return;
      if (r.ok) setBanks(r.data.banks);
      else setToError(r.error);
    });
    return () => {
      live = false;
    };
  }, [toOpen, banks, connected]);

  const check = async () => {
    setBusy(true);
    setToError(null);
    const r = await reach(() => checkBalanceBankAccount({ bankCode, bankName, accountNumber }));
    setBusy(false);
    if (r.ok) setNamed(r.data.accountName);
    else setToError(r.error);
  };

  const prepare = async () => {
    if (!connected || !account) {
      setStep("unavailable");
      return;
    }
    setBusy(true);
    const r = await reach(() =>
      prepareWithdrawal({
        clientKey,
        bankCode: account.bankCode,
        bankName: account.bankName,
        accountNumber: account.accountNumber,
        shownAccountName: account.accountName,
        amount,
      }),
    );
    setBusy(false);
    if (!r.ok) {
      banner.error(r.error);
      /* A fresh key for a fresh attempt; the refused one moved nothing. */
      if (!r.unreached) setClientKey(crypto.randomUUID());
      return;
    }
    setQuote(r.data);
    setStep("review");
  };

  const submit = async (code?: string): Promise<boolean> => {
    if (!quote) return false;
    const r = await reach(() => confirmBalanceMovement({ movementId: quote.movementId, ...(code ? { otp: code } : {}) }));
    if (!r.ok) {
      banner.error(r.error);
      return false;
    }
    if (r.data.needsOtp) {
      setStep("otp");
      setOtpNote(r.data.message);
      return false;
    }
    setMovement(r.data.movement);
    setStep("waiting");
    return true;
  };

  const backFromReview = () => {
    if (quote) void reach(() => cancelBalanceMovement({ movementId: quote.movementId }));
    setQuote(null);
    setClientKey(crypto.randomUUID());
    setStep("amount");
  };

  return (
    <div className="nf-balance nf-mw" data-screen="withdraw" data-testid="wallet-withdraw" data-step={step}>
      <WalletHeader title={ACTION_LABEL.withdraw} back={links.overview} />

      {step === "amount" ? (
        <div className="nf-mw-move">
          <AvailableLine minor={availableMinor} locale={locale} connected={connected} />
          <AmountEntry value={amount} onChange={setAmount} label="Amount to withdraw" hint="The smallest withdrawal is ₦1,000. The fee is shown before you confirm." />
          {chips.length > 0 ? <QuickChips chips={chips} value={amount} onChange={setAmount} /> : null}
          <PickRow
            label={MOVE_COPY.withdrawTo}
            value={account ? `${account.accountName}, ${account.bankName} •••• ${lastFour(account.accountNumber)}` : MOVE_COPY.chooseAccount}
            lead={<PickArt name="banknotes-stack" />}
            action={account ? MOVE_COPY.change : "Choose"}
            onOpen={() => {
              setToOpen(true);
              setNamed(null);
              setToError(connected ? null : MOVE_COPY.notAvailableWithdraw);
            }}
            testId="withdraw-account"
          />
          <div className="nf-mw-foot">
            <Button variant="primary" size="lg" full loading={busy} disabled={!ready} onClick={prepare} data-testid="move-continue">
              {MOVE_COPY.continue}
            </Button>
            <Keypad value={amount} onChange={setAmount} />
          </div>
        </div>
      ) : null}

      {step === "review" && quote ? (
        <div className="nf-mw-move" data-testid="withdraw-review">
          <p className="nf-mw-label text-center">{MOVE_COPY.review}</p>
          <Breakdown breakdown={quote.breakdown} locale={locale} destination={{ label: "To", title: quote.destination.title, detail: quote.destination.detail }} receivedLabel="You'll receive" />
          <p className="nf-caption text-[var(--nf-content-muted)]">
            The processing fee is set by our licensed provider for this withdrawal and is what you will be charged. Reference {quote.reference}.
          </p>
          <div className="nf-mw-foot">
            <DragToConfirm
              money
              label="Slide to withdraw"
              armedLabel="Press again to withdraw"
              keyboardLabel="Withdraw"
              confirmingLabel="Sending to your bank"
              confirmedLabel="Sent"
              errorLabel="Not sent. Nothing has moved."
              onConfirm={() => submit()}
            />
            <Button variant="secondary" size="lg" full onClick={backFromReview}>
              Change something
            </Button>
          </div>
        </div>
      ) : null}

      {step === "otp" ? (
        <div className="nf-mw-move">
          <TextField
            label="Code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={8}
            inputClassName="nf-balance__otp"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
          />
          {otpNote ? (
            <p role="status" className="nf-mw-error">
              {otpNote}
            </p>
          ) : null}
          <Button
            variant="primary"
            size="lg"
            full
            loading={busy}
            disabled={otp.length < 4}
            onClick={async () => {
              setBusy(true);
              await submit(otp);
              setBusy(false);
            }}
          >
            Confirm withdrawal
          </Button>
        </div>
      ) : null}

      {step === "unavailable" ? <NotAvailable body={MOVE_COPY.notAvailableWithdraw} back={links.overview} /> : null}

      {step === "waiting" && movement ? (
        <div className="grid gap-block pb-block">
          <Watching kind="withdrawal" movement={movement} locale={locale} onDone={() => router.push(links.overview)} onSettled={() => router.refresh()} />
        </div>
      ) : null}

      <Sheet open={toOpen} onOpenChange={setToOpen} title={MOVE_COPY.withdrawTo} testId="withdraw-to">
        <div className="grid gap-block pb-block">
          <p className="nf-body-sm text-[var(--nf-content-secondary)]">A bank account in your name. We check the name on it with the bank first.</p>
          <SelectField
            label="Bank"
            value={bankCode}
            onChange={(e) => {
              setBankCode(e.target.value);
              setNamed(null);
            }}
            disabled={!banks}
          >
            <option value="">{banks ? "Choose your bank" : connected ? "Loading banks" : "Not connected yet"}</option>
            {(banks ?? []).map((b) => (
              <option key={b.code} value={b.code}>
                {b.name}
              </option>
            ))}
          </SelectField>
          <TextField
            label="Account number"
            inputMode="numeric"
            autoComplete="off"
            maxLength={10}
            value={accountNumber}
            onChange={(e) => {
              setAccountNumber(e.target.value.replace(/\D/g, ""));
              setNamed(null);
            }}
          />
          {named ? (
            <div className="nf-balance__verified" data-testid="balance-verified-account">
              <p className="nf-caption text-[var(--nf-content-secondary)]">The bank says this account belongs to</p>
              <p className="nf-h3 mt-xs text-[var(--nf-content-primary)]">{named}</p>
              <p className="nf-body-sm text-[var(--nf-content-secondary)]">
                {bankName} •••• {lastFour(accountNumber)}
              </p>
              <div className="mt-row grid grid-cols-2 gap-sm">
                <Button variant="secondary" onClick={() => setNamed(null)}>
                  Not mine
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    setAccount({ bankCode, bankName, accountNumber, accountName: named });
                    setToOpen(false);
                  }}
                >
                  Yes, it is mine
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="primary" size="lg" full loading={busy} disabled={!connected || !bankCode || accountNumber.length !== 10} onClick={check}>
              Check account
            </Button>
          )}
          {toError ? (
            <p role="alert" className="nf-mw-error">
              {toError}
            </p>
          ) : null}
        </div>
      </Sheet>
    </div>
  );
}
