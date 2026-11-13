"use client";

import { useCopyFlash } from "@/lib/ui/use-copy";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Locale } from "@vallo/i18n/core";
import { useScopedCopy } from "@/lib/i18n/copy-scope";
import { cryptoPaymentStatus } from "@/lib/crypto/actions";
import { compareAtomic, fromAtomic, toAtomic } from "@/lib/crypto/decimal";
import { RESTING, STEPS, stepOf, type CryptoState } from "@/lib/crypto/state-machine";
import type { CryptoPaymentView } from "@/lib/crypto/view";
import { DocFigure, DocHead, DocPerforation, DocRow, DocRows, DocumentSheet } from "@/components/app/money/DocumentSheet";
import { Amount } from "@/components/ui/Amount";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { QrCode } from "./QrCode";
import { SuccessSheet } from "@/components/ui/SuccessSheet";
import { successCopy } from "@/lib/ui/success-moments";

/**
 * One crypto payment, from "send it here" to the receipt.
 *
 * Drawn in the payment sheet and on /pay/crypto/[reference]. It polls OUR row
 * (`cryptoPaymentStatus`, the payer's own RLS read), never the provider, on a
 * backoff that stops once the payment rests. The row only changes when a
 * signed provider report is applied in the database, so nothing on this
 * screen can mark a charge paid.
 */

const fill = (template: string, values: Record<string, string | number>): string =>
  Object.entries(values).reduce((text, [key, value]) => text.split(`{${key}}`).join(String(value)), template);

/** "4:59" from milliseconds. */
export function clock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Remaining crypto to send on an underpayment, exactly, or null. */
export function remainingToSend(view: CryptoPaymentView): string | null {
  if (!view.cryptoReceived) return null;
  try {
    const due = toAtomic(view.cryptoAmount, view.decimals);
    const got = toAtomic(view.cryptoReceived, view.decimals);
    return compareAtomic(got, due) < 0 ? fromAtomic(due - got, view.decimals) : null;
  } catch {
    return null;
  }
}

export function useCountdown(until: string): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return Math.max(0, Date.parse(until) - now);
}

/**
 * Poll our own row while the payment is moving: 4s, easing to 20s.
 *
 * A TICK, not only the view, re-arms the timer. A refused poll (the rate
 * limit, a dropped connection) changes nothing in the view, and with the view
 * as the only dependency the effect never ran again: the page stopped
 * updating after one refusal. Every poll now moves the tick, whatever it got.
 */
function useLivePayment(initial: CryptoPaymentView): CryptoPaymentView {
  const [view, setView] = useState(initial);
  const [tick, setTick] = useState(0);
  const delay = useRef(4000);
  useEffect(() => {
    if (RESTING.has(view.state)) return;
    let cancelled = false;
    const id = window.setTimeout(async () => {
      let refused = false;
      try {
        const result = await cryptoPaymentStatus(view.reference);
        if (cancelled) return;
        if (result.ok && result.data) setView(result.data);
        refused = !result.ok;
      } catch {
        refused = true;
      }
      if (cancelled) return;
      /* After a refusal, wait the longest interval before asking again. */
      delay.current = refused ? 20_000 : Math.min(20_000, Math.round(delay.current * 1.4));
      setTick((n) => n + 1);
    }, delay.current);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [view.reference, view.state, tick]);
  return view;
}

/** One fact on the plain card: the label quiet above, the value beneath. */
function Fact({ label, children, mono = false, numeric = false }: { label: string; children: ReactNode; mono?: boolean; numeric?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="nf-caption text-[var(--nf-content-muted)]">{label}</dt>
      {/* Stays `overflow-wrap: anywhere` on purpose: an address or hash is one token and must wrap inside its cell (13 November 2026; the gate is app/css/overflow-wrap.test.ts). */}
      <dd className={`nf-body mt-3xs [overflow-wrap:anywhere] text-[var(--nf-content-primary)] ${mono ? "font-mono" : ""} ${numeric ? "tabular-nums" : ""}`}>
        {children}
      </dd>
    </div>
  );
}

function CopyRow({ label, value, copyLabel, copiedLabel, mono = true }: { label: string; value: string; copyLabel: string; copiedLabel: string; mono?: boolean }) {
  const [copied, copyValue] = useCopyFlash();
  return (
    <div className="flex items-start gap-sm">
      <div className="min-w-0 flex-1">
        <p className="nf-caption text-[var(--nf-content-muted)]">{label}</p>
        {/* Stays `overflow-wrap: anywhere` on purpose: an address or hash is one token and must wrap inside its cell (13 November 2026; the gate is app/css/overflow-wrap.test.ts). */}
        <p className={`nf-body mt-3xs [overflow-wrap:anywhere] text-[var(--nf-content-primary)] ${mono ? "font-mono" : "font-semibold"}`}>{value}</p>
      </div>
      <Button
        variant="secondary"
        size="sm"
        className="shrink-0"
        done={copied}
        onClick={() => void copyValue(value)}
        aria-label={`${copyLabel}: ${label}`}
      >
        {copied ? copiedLabel : copyLabel}
      </Button>
    </div>
  );
}

function Steps({ state, labels, confirmations }: { state: CryptoState; labels: Record<(typeof STEPS)[number], string>; confirmations: string | null }) {
  const current = stepOf(state);
  const at = current ? STEPS.indexOf(current) : -1;
  return (
    <ol className="grid gap-sm" aria-label="Payment progress">
      {STEPS.map((step, i) => {
        const done = at > i || state === "settled";
        const active = at === i && state !== "settled";
        return (
          <li key={step} className="flex items-center gap-sm" aria-current={active ? "step" : undefined}>
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                done
                  ? "border-transparent bg-[var(--nf-state-success)] text-[var(--nf-content-inverse)]"
                  : active
                    ? "border-[var(--nf-brand-primary)] text-[var(--nf-brand-primary)]"
                    : "border-[var(--nf-border-default)] text-[var(--nf-content-muted)]"
              }`}
            >
              {done ? <UiIcon name="verified-badge" size="xs" /> : <span className="nf-caption">{i + 1}</span>}
            </span>
            <span className={`nf-body-sm ${active ? "font-semibold text-[var(--nf-content-primary)]" : "text-[var(--nf-content-secondary)]"}`}>
              {labels[step]}
              {active && step === "confirming" && confirmations ? (
                <span className="nf-caption ml-inline text-[var(--nf-content-muted)]">{confirmations}</span>
              ) : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function CryptoPaymentStatus({
  initial,
  locale,
  providerName,
  onNewQuote,
  onPayAnotherWay,
}: {
  initial: CryptoPaymentView;
  locale: Locale;
  providerName: string;
  /** Start again with a fresh quote (the sheet passes this; the page links back to the charge). */
  onNewQuote?: () => void;
  onPayAnotherWay?: () => void;
}) {
  const t = useScopedCopy("cryptoPay");
  const s = useScopedCopy("success");
  const view = useLivePayment(initial);

  /*
   * THE SUCCESS SHEET OPENS ON A TRANSITION SEEN HERE, never on arrival.
   * The row only becomes `settled` when a signed provider report is applied
   * in the database, so watching it change is watching the truth. A payment
   * that was already settled when the page loaded is a receipt being reread
   * and gets no celebration; overpaid, underpaid and refunded never do.
   */
  const [celebrate, setCelebrate] = useState(false);
  const [seenState, setSeenState] = useState(initial.state);
  if (seenState !== view.state) {
    setSeenState(view.state);
    if (view.state === "settled" && seenState !== "settled") setCelebrate(true);
  }
  const paidWords = successCopy(s, "cryptoPaid");
  const left = useCountdown(view.expiresAt);
  const p = { provider: providerName, asset: view.asset, network: view.networkName };

  const confirmations =
    view.confirmations !== null
      ? view.confirmationsRequired
        ? fill(t.confirmationsCount, { count: view.confirmations, required: view.confirmationsRequired })
        : fill(t.confirmationsSome, { count: view.confirmations })
      : null;

  const showInstructions = (view.state === "awaiting_payment" || view.state === "underpaid") && view.depositAddress && left > 0;
  const remaining = remainingToSend(view);
  const body = fill(t.stateBodies[view.state], {
    ...p,
    received: view.cryptoReceived ?? "0",
    remaining: remaining ?? view.cryptoAmount,
    extra: view.cryptoOverpaid ?? "",
  });
  const tone =
    view.state === "settled"
      ? "text-[var(--nf-state-success)]"
      : view.state === "failed" || view.state === "refunded"
        ? "text-[var(--nf-state-error)]"
        : view.state === "expired" || view.state === "underpaid"
          ? "text-[var(--nf-state-warning)]"
          : "text-[var(--nf-content-primary)]";

  return (
    <div className="grid gap-block">
      <div role="status" aria-live="polite">
        <p className={`nf-h3 ${tone}`}>{t.states[view.state]}</p>
        <p className="nf-body-sm mt-inline-tight leading-relaxed text-[var(--nf-content-secondary)]">{body}</p>
      </div>

      {view.state !== "expired" && view.state !== "failed" && view.state !== "refunded" && (
        <Panel variant="card">
          <Steps state={view.state} labels={t.steps} confirmations={confirmations} />
        </Panel>
      )}

      {showInstructions && (
        <Panel variant="card" className="grid gap-block">
          <div className="flex flex-col items-center gap-sm">
            <QrCode value={view.depositAddress!} label={fill(t.qrLabel, p)} />
            <p className="nf-caption text-center text-[var(--nf-content-muted)]">{fill(t.addressOwner, p)}</p>
          </div>
          <CopyRow
            label={t.sendExactly}
            value={`${view.state === "underpaid" && remaining ? remaining : view.cryptoAmount} ${view.asset}`}
            copyLabel={t.copy}
            copiedLabel={t.copied}
            mono={false}
          />
          <CopyRow label={fill(t.sendTo, p)} value={view.depositAddress!} copyLabel={t.copy} copiedLabel={t.copied} />
          {view.depositMemo && (
            <>
              <CopyRow label={t.memo} value={view.depositMemo} copyLabel={t.copy} copiedLabel={t.copied} />
              <p className="nf-caption text-[var(--nf-state-warning)]">{t.memoWarning}</p>
            </>
          )}
          <p className="nf-caption flex items-start gap-inline leading-relaxed text-[var(--nf-content-secondary)]">
            <UiIcon name="shield-stop" size="xs" className="mt-3xs shrink-0" />
            <span>{view.networkWarning}</span>
          </p>
          <p className="nf-caption text-[var(--nf-content-muted)]" aria-live="off">
            {fill(t.expiresIn, { time: clock(left) })}
          </p>
          {view.hostedUrl && (
            <a
              href={view.hostedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="nf-body-sm text-center font-semibold text-[var(--nf-brand-primary)] underline"
            >
              {fill(t.openHosted, p)}
            </a>
          )}
        </Panel>
      )}

      {view.state === "settled" && (
        /* THE RECEIPT IS PAPER (D28.1, reference 7082): the crypto receipt on
           the same document sheet as every other receipt, with the naira
           charge as its figure and every fact a person needs to prove the
           payment as a row. Restyle only: the rows are the ones this panel
           always drew, from the same view, in the same order.

           ONLY FOR `settled`, the one state in which the charge IS paid
           (state-machine.ts: settled is "the charge is paid (FINAL)"). A
           printable document headed "Charge paid" over the naira figure on a
           refund, or on an overpayment still being converted, would be a
           paper proof of a payment that has not happened (audit A5). */
        <DocumentSheet kind="receipt" printable as="section" aria-labelledby="crypto-receipt-title" data-testid="crypto-receipt">
          <DocHead label={t.receipt} title={t.receiptCharge} id="crypto-receipt-title" />
          <div className="nf-doc__hero">
            <DocFigure testId="crypto-receipt-figure">
              <Amount minorUnits={view.amountMinor} locale={locale} showFraction secondaryClassName="nf-doc__kobo" />
            </DocFigure>
          </div>
          <DocPerforation />
          <DocRows>
            <DocRow label={t.receiptSent} numeric>{`${view.cryptoReceived ?? view.cryptoAmount} ${view.asset}`}</DocRow>
            <DocRow label={t.receiptNetwork}>{view.networkName}</DocRow>
            <DocRow label={t.receiptRate} numeric>{fill(t.rateValue, { rate: view.rate, asset: view.asset })}</DocRow>
            {view.txHash && (
              <DocRow label={t.receiptTx} numeric>
                <span className="nf-doc__ref">{view.txHash}</span>
              </DocRow>
            )}
            {view.refundTxHash && (
              <DocRow label={t.receiptRefundTx} numeric>
                <span className="nf-doc__ref">{view.refundTxHash}</span>
              </DocRow>
            )}
            <DocRow label={t.receiptReference} numeric>
              <span className="nf-doc__ref">{view.reference}</span>
            </DocRow>
            {view.providerPaymentId && (
              <DocRow label={fill(t.receiptProviderReference, p)} numeric>
                <span className="nf-doc__ref">{view.providerPaymentId}</span>
              </DocRow>
            )}
          </DocRows>
        </DocumentSheet>
      )}

      {(view.state === "refunded" || view.state === "overpaid") && (
        /* A REFUND OR AN OVERPAYMENT: the facts, on the plain card, with no
           title and no hero figure. The status line above already says what
           happened in the words `crypto-pay` gives each state; this card only
           keeps the references a person needs to trace the crypto. */
        <Panel variant="card" data-testid="crypto-facts">
          <dl className="grid gap-sm">
            <Fact label={t.receiptSent} numeric>{`${view.cryptoReceived ?? view.cryptoAmount} ${view.asset}`}</Fact>
            <Fact label={t.receiptNetwork}>{view.networkName}</Fact>
            <Fact label={t.receiptRate} numeric>{fill(t.rateValue, { rate: view.rate, asset: view.asset })}</Fact>
            {view.txHash && <Fact label={t.receiptTx} mono>{view.txHash}</Fact>}
            {view.refundTxHash && <Fact label={t.receiptRefundTx} mono>{view.refundTxHash}</Fact>}
            {view.refundAddress && <Fact label={t.receiptReturnedTo} mono>{view.refundAddress}</Fact>}
            <Fact label={t.receiptReference} mono>{view.reference}</Fact>
            {view.providerPaymentId && <Fact label={fill(t.receiptProviderReference, p)} mono>{view.providerPaymentId}</Fact>}
          </dl>
        </Panel>
      )}

      {(view.state === "expired" || view.state === "failed" || view.state === "refunded" || (view.state === "awaiting_payment" && left <= 0)) && (
        <div className="grid gap-sm">
          {onNewQuote && (
            <Button variant="primary" full onClick={onNewQuote}>
              {t.newQuote}
            </Button>
          )}
          {onPayAnotherWay && (
            <Button variant="secondary" full onClick={onPayAnotherWay}>
              {t.payAnotherWay}
            </Button>
          )}
        </div>
      )}

      <p className="nf-caption leading-relaxed text-[var(--nf-content-muted)]">{fill(t.noCustody, p)}</p>

      <SuccessSheet
        open={celebrate}
        onOpenChange={setCelebrate}
        variant={paidWords.variant}
        object={paidWords.object}
        title={paidWords.title}
        body={paidWords.body}
        amount={{ minorUnits: view.amountMinor, locale }}
        details={[
          { label: s.detail.amount, value: `${view.cryptoReceived ?? view.cryptoAmount} ${view.asset}` },
          { label: s.detail.reference, value: view.reference, mono: true },
        ]}
        primary={{ label: s.continue }}
      />
    </div>
  );
}
