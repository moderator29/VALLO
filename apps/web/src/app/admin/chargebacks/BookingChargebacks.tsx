import Link from "next/link";
import { getDictionary } from "@vallo/i18n";
import type { Dictionary, Locale } from "@vallo/i18n/core";
import { Amount } from "@/components/ui/Amount";
import { StatusPill } from "@/components/ui/StatusPill";
import { getBookingChargebacks } from "@/lib/admin/reads/chargebacks";
import type { ChargebackRow } from "@/lib/admin/reads/chargebacks-model";
import { CHARGEBACKS_BASE, STATE_TONE } from "./ChargebacksDesk";
import { OpenChargebackButton } from "./ChargebackActions";

/**
 * THE CHARGEBACK PANEL ON A STAY'S CONSOLE PAGE (`/admin/bookings/<id>`).
 *
 * Drawn only for someone the chargeback functions admit (finance staff, or
 * an admin): the stay's page is the operations desk's, and an operations
 * member without finance sees nothing here, exactly as
 * `public.staff_chargebacks` would refuse them. It lists the chargebacks on
 * this stay's payments and offers to record one on each settled payment,
 * through `public.chargeback_open`.
 */
export async function BookingChargebacks({
  bookingId,
  payments,
  locale,
}: {
  bookingId: string;
  payments: { reference: string | null; provider: string; amountMinor: number; status: string }[];
  locale: Locale;
}) {
  const read = await getBookingChargebacks(bookingId);
  if (read === null) return null;
  const copy = getDictionary(locale).chargebacks.desk;
  return <BookingChargebacksView bookingId={bookingId} read={read} payments={payments} copy={copy} locale={locale} />;
}

export function BookingChargebacksView({
  bookingId,
  read,
  payments,
  copy,
  locale,
}: {
  read: { state: "ok"; data: ChargebackRow[] } | { state: "unavailable" };
  payments: { reference: string | null; provider: string; amountMinor: number; status: string }[];
  bookingId: string;
  copy: Dictionary["chargebacks"]["desk"];
  locale: Locale;
}) {
  const settled = payments.filter((p) => p.status === "SUCCESSFUL" && p.reference);
  return (
    <section className="nf-panel nf-panel--card nf-admin-card mt-md p-md sm:p-lg" aria-labelledby="nf-booking-chargebacks" data-testid="booking-chargebacks">
      <div className="flex flex-wrap items-baseline justify-between gap-xs">
        <h2 id="nf-booking-chargebacks" className="nf-h3">
          {copy.booking.title}
        </h2>
        <span className="nf-caption text-[var(--nf-content-secondary)]">{copy.booking.hint}</span>
      </div>
      {read.state !== "ok" ? (
        <p className="nf-body mt-sm text-[var(--nf-content-secondary)]">{copy.unavailableBody}</p>
      ) : read.data.length === 0 ? (
        <p className="nf-body mt-sm text-[var(--nf-content-secondary)]">{copy.booking.none}</p>
      ) : (
        <ul className="mt-sm grid gap-xs">
          {read.data.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-xs">
              {/* Stays `overflow-wrap: anywhere` on purpose: a dispute reference is one token and must wrap inside its cell (13 November 2026; the gate is app/css/overflow-wrap.test.ts). */}
              <Link href={`${CHARGEBACKS_BASE}/${row.id}`} className="font-mono font-semibold underline underline-offset-2 [overflow-wrap:anywhere]">
                {row.reference || row.providerDisputeId}
              </Link>
              <span className="flex flex-wrap items-center gap-xs">
                <StatusPill tone={STATE_TONE[row.state]}>{copy.states[row.state]}</StatusPill>
                <Amount minorUnits={row.amountMinor} currency={row.currency} locale={locale} showFraction className="font-semibold" />
              </span>
            </li>
          ))}
        </ul>
      )}
      {settled.length > 0 ? (
        <div className="mt-md flex flex-wrap gap-xs">
          {settled.map((p) => (
            <OpenChargebackButton
              key={p.reference!}
              copy={copy}
              variant="secondary"
              label={settled.length > 1 ? `${copy.open.onPayment} (${p.reference})` : copy.open.onPayment}
              defaults={{ reference: p.reference!, provider: p.provider, amountMinor: p.amountMinor }}
            />
          ))}
        </div>
      ) : null}
      <p className="mt-sm">
        <Link href={`${CHARGEBACKS_BASE}?booking=${bookingId}`} className="inline-flex min-h-11 items-center text-[length:var(--nf-text-caption)] font-semibold underline underline-offset-2">
          {copy.booking.openDesk}
        </Link>
      </p>
    </section>
  );
}
