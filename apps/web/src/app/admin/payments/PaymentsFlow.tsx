import Link from "next/link";
import { formatMoney, getDictionary, plural, type Dictionary, type Locale } from "@vallo/i18n";
import { fill } from "../_components/copy";
import {
  PAYMENT_OUTCOMES,
  channelLabel,
  type PaymentOutcome,
  type PaymentsDesk,
} from "@/lib/admin/reads/payments";
import { StatusPill, type StatusTone } from "@/components/ui/StatusPill";
import type { AdminUi } from "../_components/ui";
import { CalmNote, EmptyChart, Framed, Kpi, NumberedPager, Panel, TableNote, Waiting } from "../money/_desk/Desk";
import { RankBars, RankFrame, SeriesChart, StatusBar, type StatusTone4 } from "../money/_desk/charts";
import { percentChange } from "@/lib/admin/reads/money-derive";
import { dayLabel } from "../bookings/BookingsDesk";

/**
 * The money coming in, drawn from `getPaymentsDesk`
 * (`lib/admin/reads/payments.ts`): four KPI cards of exact counts this week
 * against the week before, succeeded money per day (drawn only once two days
 * have some), attempts by channel, one status bar on the status four, and
 * every attempt in a numbered table.
 */

/**
 * Where a payment attempt ended, in words: this desk's own three, and the
 * console's transaction words for failed and refunded, which mean the same.
 */
export function outcomeWords(t: Dictionary): Record<PaymentOutcome, string> {
  const status = t.admin.common.columns.transactionStatus;
  return { ...t.admin.payments.outcome, failed: status.FAILED, refunded: status.REFUNDED };
}
const OUTCOME_TONE: Record<PaymentOutcome, StatusTone> = {
  succeeded: "success",
  initialised: "warning",
  abandoned: "neutral",
  failed: "danger",
  refunded: "info",
};
const OUTCOME_TONE4: Record<PaymentOutcome, StatusTone4> = {
  succeeded: "good",
  initialised: "pending",
  abandoned: "bad",
  failed: "bad",
  refunded: "info",
};

export function PaymentsKpis({ desk, locale = "en" }: { desk: PaymentsDesk | null; locale?: Locale }) {
  const t = getDictionary(locale);
  const c = t.admin.payments;
  const word = outcomeWords(t);
  const w = desk?.week;
  const d = (k: PaymentOutcome | "started", upIsGood = true) =>
    w ? { percent: percentChange(w.thisWeek[k], w.lastWeek[k]), against: t.admin.money.vsSevenDaysBefore, upIsGood } : null;
  return (
    <div className="nf-md-kpis">
      <Kpi locale={locale} label={c.kpiStarted} value={w ? String(w.thisWeek.started) : null} delta={d("started")} note={c.kpiStartedNote} />
      <Kpi locale={locale} label={word.succeeded} value={w ? String(w.thisWeek.succeeded) : null} delta={d("succeeded")} note={c.kpiSucceededNote} />
      <Kpi locale={locale} label={word.failed} value={w ? String(w.thisWeek.failed) : null} delta={d("failed", false)} note={c.kpiFailedNote} />
      <Kpi locale={locale} label={word.abandoned} value={w ? String(w.thisWeek.abandoned) : null} delta={d("abandoned", false)} note={c.kpiAbandonedNote} />
    </div>
  );
}

export function PaymentsCharts({ desk, locale }: { desk: PaymentsDesk | null; locale: Locale }) {
  const t = getDictionary(locale);
  const c = t.admin.payments;
  if (!desk) {
    return (
      <Panel title={c.perDayTitle}>
        <Waiting title={c.unreadTitle} body={c.unreadCharts} />
      </Panel>
    );
  }
  const word = outcomeWords(t);
  const days = desk.perDay;
  const activeDays = days.filter((x) => x.amountMinor > 0).length;
  const ticks = days.map((x, i) => (i % 5 === 0 || i === days.length - 1 ? dayLabel(x.day, locale) : ""));
  const t30 = desk.last30;
  const total30 = PAYMENT_OUTCOMES.reduce((s, o) => s + t30[o], 0);

  return (
    <>
      <div className="nf-md-grid nf-md-grid--main">
        <Panel title={c.perDayTitle} hint={c.perDayHint}>
          {activeDays < 2 ? (
            <EmptyChart
              height={200}
              yLabels={[formatMoney(0, locale), "", "", "", ""]}
              xLabels={ticks}
              note={{
                title: activeDays === 0 ? c.perDayNone : c.perDayOne,
                fills: c.perDayFills,
                creates: c.perDayCreates,
                action: { href: "/admin/money", label: c.openMoneyDesk },
              }}
            />
          ) : (
            <SeriesChart
              locale={locale}
              id="payments-volume"
              xLabels={days.map((x) => dayLabel(x.day, locale))}
              series={[{ name: t.admin.money.moneyIn, values: days.map((x) => x.amountMinor), rank: 0, area: true }]}
              label={c.perDayLabel}
              yLabel={(v) => formatMoney(v, locale, "NGN", { compact: true })}
              readout={days.map((x) => ({
                title: dayLabel(x.day, locale, true),
                rows: [
                  { label: t.admin.money.moneyIn, value: formatMoney(x.amountMinor, locale) },
                  { label: c.paymentsRow, value: String(x.count) },
                ],
              }))}
            />
          )}
        </Panel>
        <Panel title={c.byChannelTitle} hint={c.byChannelHint}>
          {desk.byChannel.length === 0 ? (
            <Framed frame={<RankFrame rows={4} />}>
              <CalmNote title={c.noAttemptTitle} fills={c.byChannelFills} creates={c.byChannelCreates} />
            </Framed>
          ) : (
            <>
              <RankBars rows={desk.byChannel.slice(0, 6).map((c) => ({ label: c.channel, count: c.attempts }))} />
              <p className="nf-md-panel__foot">
                {desk.byChannel
                  .filter((ch) => ch.succeeded > 0)
                  .map((ch) => fill(c.channelIn, { channel: ch.channel, amount: formatMoney(ch.succeededMinor, locale) }))
                  .join(" · ") || c.nothingOnChannel}
              </p>
            </>
          )}
        </Panel>
      </div>
      <Panel title={c.endedTitle} hint={plural(total30, c.attempts30, locale)}>
        <StatusBar
          locale={locale}
          label={c.endedLabel}
          segments={PAYMENT_OUTCOMES.map((o) => ({ key: o, label: word[o], count: t30[o], tone: OUTCOME_TONE4[o] }))}
        />
        {total30 === 0 && (
          <div className="mt-md">
            <CalmNote title={c.noAttemptTitle} fills={c.endedFills} creates={c.startsOne} />
          </div>
        )}
      </Panel>
    </>
  );
}

export function PaymentsTable({
  desk,
  params,
  locale,
  ui,
}: {
  desk: PaymentsDesk | null;
  params: Record<string, string | undefined>;
  locale: Locale;
  ui: AdminUi;
}) {
  const link = (key: "outcome", value: string | undefined) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v && k !== key && k !== "page") next.set(k, v);
    if (value) next.set(key, value);
    const qs = next.toString();
    return qs ? `/admin/payments?${qs}` : "/admin/payments";
  };
  const chip = (key: "outcome", value: string | undefined, label: string) => {
    const on = (params[key] ?? undefined) === value;
    return (
      <Link key={`${key}-${value ?? "all"}`} href={link(key, on ? undefined : value)} className="nf-md-toggle" aria-current={on ? "true" : undefined}>
        {label}
      </Link>
    );
  };
  const narrowed = Boolean(params.outcome);
  const t = getDictionary(locale);
  const c = t.admin.payments;
  const word = outcomeWords(t);

  return (
    <Panel title={c.everyTitle} hint={desk ? plural(desk.table.total, c.attempts, locale) : undefined}>
      <div className="mb-sm flex flex-wrap gap-xs" role="group" aria-label={c.narrowOutcome}>
        {chip("outcome", undefined, c.allOutcomes)}
        {PAYMENT_OUTCOMES.map((o) => chip("outcome", o, word[o]))}
      </div>
      {!desk ? (
        <Waiting title={c.unreadTitle} body={c.unreadTable} />
      ) : (
        <>
          <div className="nf-md-scroll"><table className="nf-md-table">
            <thead>
              <tr>
                <th scope="col">{c.started}</th>
                <th scope="col">{c.reference}</th>
                <th scope="col">{c.kind}</th>
                <th scope="col">{c.channel}</th>
                <th scope="col">{c.outcomeColumn}</th>
                <th scope="col" className="nf-md-num">{c.amount}</th>
              </tr>
            </thead>
            <tbody>
              {desk.table.rows.length === 0 ? (
                <TableNote
                  columns={6}
                  note={
                    narrowed
                      ? { title: t.admin.common.noMatchTitle, fills: c.noMatchFills, action: { href: "/admin/payments", label: c.showEvery } }
                      : { title: c.noneTitle, fills: c.noneFills, creates: c.startsOne }
                  }
                />
              ) : (
                desk.table.rows.map((p) => (
                  <tr key={`${p.kind}-${p.id}`}>
                    <td className="nf-md-date" data-label={c.started}>
                      {ui.when(p.createdAt)}
                    </td>
                    <td data-label={c.reference}>
                      {/* The reference, never clipped: it is what the provider traces by. */}
                      <span className="nf-md-ref">{p.reference}</span>
                    </td>
                    <td data-label={c.kind}>
                      {p.kind === "checkout" && p.bookingId ? (
                        <Link href={`/admin/bookings/${p.bookingId}`} className="underline-offset-2 hover:underline">
                          {c.checkout}
                        </Link>
                      ) : (
                        c.checkout
                      )}
                    </td>
                    <td className="nf-md-desc" data-label={c.channel}>
                      {channelLabel(p)}
                    </td>
                    <td data-label={c.outcomeColumn}>
                      <StatusPill tone={OUTCOME_TONE[p.outcome]}>{word[p.outcome]}</StatusPill>
                    </td>
                    <td className="nf-md-num nf-md-strong" data-label={c.amount}>
                      {formatMoney(p.amountMinor, locale)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table></div>
          {desk.table.total > 0 && (
            <NumberedPager base="/admin/payments" params={params} page={desk.table.page} total={desk.table.total} pageSize={desk.table.pageSize} noun={c.paymentsNoun} locale={locale} />
          )}
        </>
      )}
    </Panel>
  );
}
