import Link from "next/link";
import { formatMoney, plural, type Dictionary, type Locale } from "@vallo/i18n/core";
import { TYPE } from "@/components/app/Screen";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { ReceiptSheet } from "@/components/app/money/ReceiptSheet";
import { depositLine } from "@/lib/reservations/deposits";
import { depositReceipt } from "@/lib/reservations/deposit-receipt";
import type { GuestDepositView } from "@/lib/reservations/guest-deposit";
import { DepositSummary } from "./DepositSummary";
import { PayDepositButton } from "./PayDepositButton";
import { DepositReturnCheck } from "./DepositReturnCheck";

/**
 * ONE TABLE'S DEPOSIT, FOR THE GUEST (`/pay/deposit/[reservationId]`).
 *
 * The page every deposit notice and the Paystack return open. Top to bottom:
 * the answer from the return (only when coming back from paying), the table
 * it is for, the deposit in one line, the amount and the restaurant's rule,
 * the card button while it is owed, and the receipt once money moved. Drawn
 * from the record; the route reads it, the preview hands fixtures in.
 */

/** "Tue 13 Oct, 19:30" on the Lagos clock, the trip row's own format. */
export function lagosWhen(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Lagos",
  }).format(at);
}

export function DepositPageBody({
  view,
  t,
  locale,
  returnReference = null,
  now = new Date(),
}: {
  view: GuestDepositView;
  t: { deposits: Dictionary["tableDeposits"]; counts: Dictionary["counts"]; venueFallback: string };
  locale: Locale;
  /** The charge reference Paystack sent the guest back with, when they are coming back from paying. */
  returnReference?: string | null;
  now?: Date;
}) {
  const w = t.deposits;
  const d = view.deposit;
  const venue = view.venueName ?? t.venueFallback;
  const money = (minor: number) => formatMoney(minor, locale, "NGN");
  const line = depositLine(d, money, lagosWhen, w.status);
  const receipt = depositReceipt(
    {
      venueName: venue,
      location: view.location,
      when: lagosWhen(view.reservedFor),
      partySize: view.partySize,
      status: d.status,
      amountMinor: d.amountMinor,
      paidAt: d.paidAt,
      reference: d.reference,
    },
    { deposits: w, counts: t.counts },
    locale,
  );
  const owed = d.status === "due" || d.status === "pending";
  const refundPassed = d.refundUntil ? Date.parse(d.refundUntil) <= now.getTime() : true;

  return (
    <div className="grid gap-block pb-block" data-testid="deposit-page">
      {returnReference ? (
        <div className="nf-panel nf-panel--card p-card">
          <DepositReturnCheck reservationId={view.reservationId} reference={returnReference} words={w.page} />
        </div>
      ) : null}

      <section className="nf-panel nf-panel--card p-card" aria-labelledby="deposit-table">
        <div className="flex items-start gap-row">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-sm bg-[var(--nf-surface-raised)]">
            <UiIcon name="utensils" size={20} aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 id="deposit-table" className={TYPE.rowTitle}>
              {venue}
            </h2>
            {view.location ? <p className={TYPE.rowMeta}>{view.location}</p> : null}
          </div>
        </div>
        {line ? (
          <p className={`mt-row ${TYPE.body}`} data-testid="deposit-line">
            {line}
          </p>
        ) : null}
        <dl className="mt-row grid gap-inline border-t border-[var(--nf-border-subtle)] pt-row">
          <div className="flex items-baseline justify-between gap-inline">
            <dt className={TYPE.rowMeta}>{w.page.when}</dt>
            <dd className={`nf-numeric text-right ${TYPE.rowTitle}`}>{lagosWhen(view.reservedFor)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-inline">
            <dt className={TYPE.rowMeta}>{w.page.party}</dt>
            <dd className={`text-right ${TYPE.rowTitle}`}>{plural(view.partySize, t.counts.guests, locale)}</dd>
          </div>
          {d.refundUntil && (owed || d.status === "paid") ? (
            <div className="flex items-baseline justify-between gap-inline">
              <dt className={TYPE.rowMeta}>{refundPassed ? w.page.freeUntilPassed : w.page.freeUntil}</dt>
              <dd className={`nf-numeric text-right ${TYPE.rowTitle}`}>{lagosWhen(d.refundUntil)}</dd>
            </div>
          ) : null}
          <div className="flex items-baseline justify-between gap-inline">
            <dt className={TYPE.rowMeta}>{w.page.howPaid}</dt>
            <dd className={`text-right ${TYPE.rowTitle}`}>{w.page.cardOnly}</dd>
          </div>
        </dl>
      </section>

      {owed ? (
        <DepositSummary
          amountMinor={d.amountMinor}
          perGuest={d.perGuest}
          ratePerGuestMinor={d.perGuest ? Math.round(d.amountMinor / Math.max(1, view.partySize)) : null}
          refundUntilHours={d.refundUntilHours}
          words={w.guest}
          locale={locale}
        />
      ) : null}

      {view.payable ? (
        <PayDepositButton
          reservationId={view.reservationId}
          label={w.guest.pay.replace("{amount}", money(d.amountMinor))}
          pendingLabel={w.guest.opening}
          size="lg"
          full
        />
      ) : null}

      {d.status === "paid" ? (
        <section className="nf-panel nf-panel--card p-card" aria-labelledby="deposit-next">
          <h2 id="deposit-next" className={TYPE.rowTitle}>
            {w.page.afterTitle}
          </h2>
          <ul className="mt-row grid gap-inline">
            <li className={`flex items-start gap-inline-tight ${TYPE.rowMeta}`}>
              <UiIcon name="receipt" size={16} className="mt-[0.15rem] shrink-0" aria-hidden />
              <span>{w.page.afterApplied}</span>
            </li>
            <li className={`flex items-start gap-inline-tight ${TYPE.rowMeta}`}>
              <UiIcon name="history" size={16} className="mt-[0.15rem] shrink-0" aria-hidden />
              <span>{w.page.afterRefund}</span>
            </li>
            <li className={`flex items-start gap-inline-tight ${TYPE.rowMeta}`}>
              <UiIcon name="info" size={16} className="mt-[0.15rem] shrink-0" aria-hidden />
              <span>{w.page.afterKept}</span>
            </li>
          </ul>
        </section>
      ) : null}

      {receipt ? <ReceiptSheet receipt={receipt} headingId="deposit-receipt" testId="deposit-receipt" /> : null}

      <p className="text-center">
        <Link
          href="/bookings?side=stays&from=stays"
          className="nf-body-sm font-semibold text-[var(--nf-content-link)] underline underline-offset-4"
        >
          {w.page.backToBookings}
        </Link>
      </p>
    </div>
  );
}
