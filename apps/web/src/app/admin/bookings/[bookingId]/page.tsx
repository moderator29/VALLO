import type { Metadata } from "next";
import Link from "next/link";
import { formatMoney, formatParty, getDictionary, plural } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { lagosToday } from "@/lib/bookings/schema";
import { getBookingDetail } from "@/lib/admin/bookings-queries";
import type { CancellationReason } from "@/lib/trust/cancellation";
import { StayCancel } from "../../_components/AdminActions";
import { fill } from "../../_components/copy";
import { adminUi } from "../../_components/ui";
import { ArrivalCheckRecord } from "@/components/app/arrival-check/ArrivalCheckRecord";
import { ActingFor } from "../../_components/ActingFor";
import { CaseHistory } from "../../_components/CaseHistory";
import { PaperLedger, PaperLedgerRow, PaperStatus } from "../../_components/paper";
import { PageHead } from "../../_components/panels";
import { DocHead, DocRow, DocRows, DocSection, DocumentSheet } from "@/components/app/money/DocumentSheet";
import { BookingChargebacks } from "../../chargebacks/BookingChargebacks";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getLocale());
  return { title: t.admin.bookings.title, robots: { index: false, follow: false } };
}

export const dynamic = "force-dynamic";

/**
 * One stay, in full, and the only place on Vallo where a paid stay can be
 * cancelled and the money returned.
 *
 * Everything an operator needs to make that decision is on this page before
 * the decision is offered: what was paid, what has already gone back, every
 * payment attempt, every refund already decided and the whole of the stay's
 * history with a name against each line. The control itself is last, after all
 * of it, because a refund is somebody's money and the reading comes first.
 *
 * A stay whose last night has passed is deliberately NOT cancellable here.
 * Releasing nights nobody can rebook helps nobody, and the money question on a
 * stay that already happened is a different conversation with a different
 * answer, so the page says so rather than offering a button that would do the
 * wrong thing quietly.
 */
export default async function AdminBookingPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const copy = t.admin.bookings;
  const common = t.admin.common;
  const ui = adminUi(t, locale);

  const { bookingId } = await params;
  const read = await getBookingDetail(bookingId);

  const backLink = (
    <Link href="/admin/bookings" className="nf-chip mb-md inline-flex w-fit items-center gap-2xs">
      {copy.back}
    </Link>
  );

  if (read.state !== "ok") {
    return (
      <div className="nf-console">
        {backLink}
        <ui.QueueUnavailable />
      </div>
    );
  }

  const stay = read.data;
  if (!stay) {
    return (
      <div className="nf-console">
        {backLink}
        {/* UI-15: a record that is not there is not good news: the neutral
            "no match" mark, never the success shield. */}
        <h1 className="sr-only">{copy.goneTitle}</h1>
        <ui.QueueEmpty title={copy.goneTitle} body={copy.goneBody} state="no-match" />
      </div>
    );
  }

  const f = copy.fields;
  const money = (minor: number) => formatMoney(minor, locale);
  const place = [stay.area, stay.city].filter(Boolean).join(", ");
  const over = stay.checkOut < lagosToday();
  const cancellable = stay.status !== "CANCELLED" && !over;

  return (
    <div className="nf-console">
      {backLink}

      <PageHead
        title={stay.listingTitle}
        lede={`${place.length > 0 ? `${place} · ` : ""}${fill(copy.bookedWhen, { when: ui.when(stay.createdAt) })}`}
        lead={
        <div className="mb-xs flex flex-wrap items-center gap-xs">
          <ui.StatusChip status={stay.status} />
          {stay.paidMinor > 0 ? (
            <ui.StatusChip
              label={fill(copy.settledChip, { amount: money(stay.paidMinor) })}
              tone="success"
            />
          ) : (
            <ui.StatusChip label={copy.unpaidChip} tone="neutral" />
          )}
          {stay.refundedMinor > 0 && (
            <ui.StatusChip
              label={fill(copy.refundedChip, { amount: money(stay.refundedMinor) })}
              tone="warning"
            />
          )}
        </div>
        }
      />

      {/* V-91: what the guest answered on arrival, with the photos. */}
      <ArrivalCheckRecord bookingId={stay.id} locale={locale} />

      {/* SCUML item 17: who the lister was acting for, with the mandate and its dates. */}
      <ActingFor kind="booking" id={stay.id} locale={locale} />

      <div className="nf-panel nf-panel--card nf-admin-card p-md sm:p-lg">
        <ui.DetailSection title={copy.sections.stay}>
          <ui.DetailRow label={f.reference} value={<span className="nf-numeric">{stay.id}</span>} />
          <ui.DetailRow
            label={f.dates}
            value={`${ui.day(stay.checkIn)} to ${ui.day(stay.checkOut)}`}
          />
          <ui.DetailRow label={f.length} value={plural(stay.nights, t.counts.nights, locale)} />
          {/* This row read "1 adults" for a party of one, in every language, for
              the whole life of the console. The count nouns now go through
              `Intl.PluralRules` for the request's locale, and the adults-only
              case is decided by `formatParty` rather than by a ternary here, so
              every surface that states a party states it the same way. */}
          <ui.DetailRow
            label={f.party}
            value={formatParty(stay.adults, stay.children, t.counts, locale)}
          />
          <ui.DetailRow label={f.status} value={ui.statusLabel(stay.status)} />
        </ui.DetailSection>

        <ui.DetailSection title={copy.sections.people}>
          {/* V-90: the guest's name opens their person file. */}
          <ui.DetailRow
            label={f.guest}
            value={
              <Link href={`/admin/people/${stay.guestId}`} className="underline underline-offset-2">
                {stay.guestName ?? copy.unnamed}
              </Link>
            }
          />
          <ui.DetailRow label={f.host} value={stay.agentName} />
          <ui.DetailRow
            label={f.listing}
            value={
              <Link href={stay.stayHref} className="underline">
                {stay.listingTitle}
              </Link>
            }
          />
          {stay.arrivingName && (
            <>
              <ui.DetailRow label={f.arriving} value={stay.arrivingName} />
              <ui.DetailRow label={f.arrivingPhone} value={stay.arrivingPhone} />
              <ui.DetailRow label={f.arrivingEmail} value={stay.arrivingEmail} />
            </>
          )}
        </ui.DetailSection>

      </div>

      {/* THE PAYMENT RECORD, ON PAPER (D28.1). What the stay cost, what has been
          settled, every attempt and every refund already decided is a RECORD, so
          it is a light document sheet, the thing an operator screenshots for a
          guest or an auditor. The cancellation control stays below it in the
          console's own theme, because a control is never on the paper. */}
      <section className="nf-admin-doc mt-md">
        <DocumentSheet aria-labelledby="stay-record-title" data-testid="stay-payment-record">
          <DocHead label={t.experienceAdmin.money.statementOverline} title={copy.sections.money} id="stay-record-title" />
          <DocRows>
            <DocRow label={f.perNight} numeric>{money(stay.pricePerNightMinor)}</DocRow>
            <DocRow label={f.cleaning} numeric>{money(stay.cleaningFeeMinor)}</DocRow>
            <DocRow label={f.service} numeric>{money(stay.serviceFeeMinor)}</DocRow>
            <DocRow label={f.subtotal} numeric>{money(stay.subtotalMinor)}</DocRow>
            <DocRow label={f.total} variant="total" numeric>{money(stay.totalMinor)}</DocRow>
          </DocRows>
          <DocRows className="nf-doc__rows--confirm">
            <DocRow label={f.settled} numeric>{money(stay.paidMinor)}</DocRow>
            <DocRow label={f.returned} numeric>{money(stay.refundedMinor)}</DocRow>
          </DocRows>

          <DocSection title={copy.sections.payments}>
            {stay.payments.length === 0 ? (
              <p className="nf-doc__note">{copy.noPayments}</p>
            ) : (
              <PaperLedger label={copy.sections.payments}>
                {stay.payments.map((payment) => (
                  <PaperLedgerRow
                    key={payment.id}
                    when={ui.when(payment.createdAt)}
                    title={`${payment.provider}`}
                    sub={payment.reference ? <span className="font-mono">{payment.reference}</span> : undefined}
                    amount={money(payment.amountMinor)}
                    status={
                      <PaperStatus state={payment.status === "SUCCESSFUL" ? "done" : payment.status === "FAILED" ? "failed" : "waiting"}>
                        {ui.statusLabel(payment.status)}
                      </PaperStatus>
                    }
                  />
                ))}
              </PaperLedger>
            )}
          </DocSection>

          <DocSection title={copy.sections.refunds}>
            {stay.refunds.length === 0 ? (
              <p className="nf-doc__note">{copy.noRefunds}</p>
            ) : (
              <PaperLedger label={copy.sections.refunds}>
                {stay.refunds.map((refund) => (
                  <PaperLedgerRow
                    key={refund.id}
                    when={ui.when(refund.createdAt)}
                    title={refund.decidedByName ?? copy.unnamed}
                    sub={
                      <>
                        {copy.reasons[refund.reason as CancellationReason] ?? refund.reason}
                        {refund.note ? ` · ${refund.note}` : ""}
                        {refund.reference ? <span className="block font-mono">{refund.reference}</span> : null}
                      </>
                    }
                    amount={
                      <>
                        {money(refund.refundMinor)}
                        <span className="block text-[length:var(--nf-text-overline)] font-normal text-[var(--nf-content-muted)]">
                          {fill(copy.refundLine, { refund: money(refund.refundMinor), retained: money(refund.retainedMinor) })}
                        </span>
                      </>
                    }
                  />
                ))}
              </PaperLedger>
            )}
          </DocSection>
        </DocumentSheet>
      </section>

      {/* Chargebacks on this stay's payments, and recording one: finance only
          (the panel draws nothing for anybody the chargeback functions refuse). */}
      <BookingChargebacks
        bookingId={stay.id}
        payments={stay.payments.map((p) => ({ reference: p.reference, provider: p.provider, amountMinor: p.amountMinor, status: p.status }))}
        locale={locale}
      />

      <div className="nf-panel nf-panel--card nf-admin-card mt-md p-md sm:p-lg">
        <CaseHistory
          title={copy.sections.history}
          hint={t.experienceAdmin.cases.historyCount.replace("{count}", String(stay.events.length))}
          testId="booking-history"
        >
          <div>
          {stay.events.map((event) => (
            <ui.DetailRow
              key={event.id}
              label={ui.when(event.createdAt)}
              value={
                <span>
                  <span className="block">
                    {event.from ? `${ui.statusLabel(event.from)} to ` : ""}
                    {ui.statusLabel(event.to)}
                    {event.actorName ? ` · ${event.actorName}` : ""}
                  </span>
                  {event.note ? (
                    <span className="mt-3xs block text-[length:var(--nf-text-caption)] text-[var(--nf-content-secondary)]">
                      {event.note}
                    </span>
                  ) : null}
                </span>
              }
            />
          ))}
          </div>
        </CaseHistory>
        <p className="mt-sm">
          <Link
            href={`/admin/audit?who=all&q=${stay.id}`}
            className="inline-flex min-h-11 items-center text-[length:var(--nf-text-caption)] font-semibold underline underline-offset-2"
          >
            {t.experienceAdmin.cases.trailLink}
          </Link>
        </p>

        {cancellable ? (
          <StayCancel bookingId={stay.id} copy={copy} common={common} locale={locale} />
        ) : (
          <p className="mt-md text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-muted)]">
            {stay.status === "CANCELLED" ? copy.cancelledAlready : copy.pastNote}
          </p>
        )}
      </div>
    </div>
  );
}
