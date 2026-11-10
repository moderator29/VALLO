import type { Metadata } from "next";
import { formatMoney, getDictionary, plural } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import {
  getPaymentHealth,
  getSavedMethods,
  STALE_HOLD_MINUTES,
} from "@/lib/admin/payments-queries";
import { findAdminSubject } from "@/lib/admin/queries";
import { getTermsStanding } from "@/lib/admin/legal-queries";
import { adminUi } from "../_components/ui";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { LookupPanel } from "./LookupPanel";
import { ActingFor, ActingForLookup } from "../_components/ActingFor";
import { readActingForParams } from "@/lib/compliance/beneficial-ownership";
import { getPaymentsDesk } from "@/lib/admin/reads/payments";
import { readPage } from "@/lib/admin/reads/money-derive";
import { LiveRefresh } from "../_components/LiveRefresh";
import { CalmNote, DeskHead, Panel, flatParams } from "../money/_desk/Desk";
import { PaymentsCharts, PaymentsKpis, PaymentsTable } from "./PaymentsFlow";
import { currentPaystack, describePaystackMode } from "@/lib/payments/paystack-mode";
import { getSubscriptionsDesk, LIVE_SUBSCRIPTION_STATUSES } from "@/lib/admin/reads/subscriptions";
import { DeskCopilot } from "@/lib/admin/copilot/contexts/DeskCopilot";
import { paymentsContext } from "@/lib/admin/copilot/contexts/payments";
import "../money/_desk/desk.css";

/** Payment attempts per page. */
const PAYMENTS_PAGE_SIZE = 12;

export const metadata: Metadata = {
  title: "Payments",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Payment health.
 *
 * THE QUESTION THIS SCREEN ANSWERS. "Has the provider settled what it was
 * sent." Vallo holds no customer money (docs/MONEY_ARCHITECTURE.md), so the
 * one thing that can be outstanding is a charge the processor has not settled.
 *
 * The overdrawn-wallets table and the stale withdrawal holds that used to lead
 * this page are gone with custody: `admin_payment_health` still returns both
 * keys, always empty.
 *
 * Unsettled payments come last and are read-only: the reconcile route at
 * /api/paystack/reconcile is what re-asks the provider, and duplicating that as
 * a button here would give two code paths permission to decide a payment landed.
 */
export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const ui = adminUi(t, locale);
  const c = t.admin.payments;

  const params = await searchParams;
  const rawTerm = params["q"];
  const term = (Array.isArray(rawTerm) ? rawTerm[0] : rawTerm)?.trim() ?? "";

  const flat = flatParams(params);
  const acting = readActingForParams(params, "transaction");
  const [read, lookup, flow, subs] = await Promise.all([
    getPaymentHealth(STALE_HOLD_MINUTES),
    term.length > 0 ? findAdminSubject(term) : Promise.resolve(null),
    getPaymentsDesk({
      ...(flat.outcome ? { outcome: flat.outcome } : {}),
      page: readPage(params.page),
      pageSize: PAYMENTS_PAGE_SIZE,
    }),
    getSubscriptionsDesk(),
  ]);
  const s = t.subscriptions.admin;
  /* Vallo Pro and Vallo Business, read only (lib/admin/reads/subscriptions.ts). */
  const subscriptions = (
    <ui.Section title={s.title} hint={s.hint}>
      {subs.state !== "ok" ? (
        <p className="nf-caption text-[var(--nf-content-muted)]" data-testid="admin-subscriptions-unavailable">
          {s.unavailable}
        </p>
      ) : (
        <>
          <ui.StatRow>
            {LIVE_SUBSCRIPTION_STATUSES.map((status) => (
              <ui.Stat key={status} label={s.counts[status]} value={String(subs.data.counts[status])} tone="neutral" />
            ))}
          </ui.StatRow>
          {subs.data.latest.length === 0 ? (
            <p className="nf-caption mt-sm text-[var(--nf-content-muted)]">{s.none}</p>
          ) : (
            <Table caption={s.caption} density="compact">
              <THead>
                <TR>
                  <TH>{s.plan}</TH>
                  <TH>{s.status}</TH>
                  <TH>{s.member}</TH>
                  <TH>{s.mode}</TH>
                  <TH>{s.ends}</TH>
                  <TH>{s.started}</TH>
                  <TH align="end">{s.amount}</TH>
                </TR>
              </THead>
              <TBody>
                {subs.data.latest.map((row) => (
                  <TR key={row.id}>
                    <TD className="font-semibold text-[var(--nf-content-primary)]">{row.planName}</TD>
                    <TD>{s.statuses[row.status as keyof typeof s.statuses] ?? row.status}</TD>
                    <TD className="[overflow-wrap:anywhere] [user-select:all]">{row.userId}</TD>
                    <TD>{row.mode ?? s.trial}</TD>
                    <TD>{row.endsAt ? ui.when(row.endsAt) : ""}</TD>
                    <TD>{ui.when(row.createdAt)}</TD>
                    <TD align="end">{row.amountMinor != null ? formatMoney(row.amountMinor, locale) : s.trial}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </>
      )}
    </ui.Section>
  );
  const payments = flow.state === "ok" ? flow.data : null;
  /* Read-only: which Paystack account this deployment is talking to, so a
     sandbox deployment can never be mistaken for the live one. */
  const paystack = currentPaystack();
  const head = (
    <>
      <DeskHead title={t.admin.shell.nav.payments} lede={c.lede} />
      <p
        className="nf-caption mt-sm text-[var(--nf-content-muted)]"
        data-testid="paystack-mode"
        data-mode={paystack.mode}
      >
        {describePaystackMode(paystack)}
      </p>
    </>
  );
  const found =
    lookup && lookup.state === "ok" && lookup.data?.state === "found"
      ? lookup.data.subject.userId
      : null;
  /* Both reads for the same person, started together: the panel draws one
     block and a second round trip for the legal row would show as a stall. */
  const [methods, standing] = await Promise.all([
    found ? getSavedMethods(found) : Promise.resolve(null),
    found ? getTermsStanding(found) : Promise.resolve(null),
  ]);

  const copilot = (
    <DeskCopilot
      scope="finance"
      deskName="Payments"
      context={paymentsContext({
        unsettled: read.state === "ok" ? read.data.unsettled.length : null,
        liveSubscriptions:
          subs.state === "ok" ? LIVE_SUBSCRIPTION_STATUSES.reduce((sum, status) => sum + subs.data.counts[status], 0) : null,
        outcomeFilter: flat.outcome ? ui.columnLabel("transactionStatus", flat.outcome) : null,
        searching: term.length > 0,
      })}
    />
  );

  if (read.state !== "ok") {
    return (
      <div className="nf-console nf-md">
        <LiveRefresh />
        {head}
        <PaymentsKpis desk={payments} locale={locale} />
        <PaymentsCharts desk={payments} locale={locale} />
        <PaymentsTable desk={payments} params={flat} locale={locale} ui={ui} />
        {subscriptions}
        <ui.QueueUnavailable />
        {copilot}
      </div>
    );
  }

  /* `overdrawn` and `staleHolds` are not read. They listed wallets below zero
     and withdrawal holds past their window, and there are no wallets and no
     withdrawals: custody is retired (docs/MONEY_ARCHITECTURE.md), the custody
     tables are unreachable from every app role, and `admin_payment_health`
     can only answer both with empty lists. A panel for either would describe
     a ledger that no longer moves (D48). */
  const { unsettled, totals } = read.data;
  const healthy = unsettled.length === 0;

  return (
    <div className="nf-console nf-md">
      <LiveRefresh />
      {head}

      {/* The answer to the desk's question first: has the provider settled what
          it was sent. It sat under the whole payments table (C1 sweep). */}
      <Panel title={c.healthTitle} hint={c.healthHint}>
      <ui.StatRow>
        <ui.Stat
          label={c.waitingProvider}
          value={formatMoney(totals.unsettledMinor, locale)}
          hint={unsettled.length === 0 ? c.nothingUnsettled : plural(unsettled.length, c.pendingOrFailed, locale)}
          tone={unsettled.length === 0 ? "success" : "neutral"}
        />
      </ui.StatRow>

      {healthy && (
        <div className="mt-sm">
          <CalmNote
            kind="clear"
            title={c.clearTitle}
            fills={c.clearFills}
            creates={c.clearCreates}
          />
        </div>
      )}
      </Panel>

      {unsettled.length > 0 && (
        <ui.Section
          title={c.waitingProvider}
          hint={c.waitingHint}
        >
          {/* The provider's reference gets the widest column: it is what an
              operator pastes into Paystack or Yellow Card to find out what
              actually happened, and it never clips. */}
          <Table caption={c.waitingCaption} density="compact">
            <THead>
              <TR>
                <TH>{c.state}</TH>
                <TH>{c.reference}</TH>
                <TH>{c.provider}</TH>
                <TH>{c.started}</TH>
                <TH align="end">{c.amount}</TH>
              </TR>
            </THead>
            <TBody>
              {unsettled.map((payment) => (
                <TR key={payment.id}>
                  <TD>
                    {/*
                      NOT A TERNARY OVER A FOUR-VALUE ENUM.

                      This read `status === "FAILED" ? "Failed" : "Pending"` for
                      both the word and the colour, so every value that is not
                      FAILED collapsed into one word in one colour.

                      WHAT THAT WAS AND WAS NOT, STATED ACCURATELY. It was not a
                      live falsehood: `admin_payment_health` selects
                      `status in ('PENDING','FAILED')`, so only two of the four
                      ever reach this row today. It was a binary written over a
                      thing that is not binary, which becomes a false statement
                      about money the day somebody widens that `in` list, on the
                      desk whose whole job is finding false statements about
                      money. And it was English on a four-language platform.

                      The word comes from the column's own vocabulary and the
                      tone from `toneForStatus`, which maps all four. A status
                      the reader could not name is null rather than "PENDING",
                      and renders as "not recorded" in neutral: see
                      `transactionStatus` in `payments-queries`. F2-060.
                    */}
                    <ui.StatusChip
                      status={payment.status ?? ""}
                      label={ui.columnLabel("transactionStatus", payment.status)}
                    />
                  </TD>
                  <TD className="font-semibold text-[var(--nf-content-primary)] [overflow-wrap:anywhere] [user-select:all]">
                    {payment.providerRef ?? payment.id}
                  </TD>
                  <TD>{payment.provider ?? c.unknownProvider}</TD>
                  <TD>{ui.when(payment.createdAt)}</TD>
                  <TD align="end" className="font-bold">
                    {formatMoney(payment.amountMinor, locale)}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </ui.Section>
      )}

      <PaymentsKpis desk={payments} locale={locale} />
      <PaymentsCharts desk={payments} locale={locale} />
      <PaymentsTable desk={payments} params={flat} locale={locale} ui={ui} />

      {subscriptions}

      <LookupPanel
        term={term}
        lookup={lookup}
        methods={methods}
        standing={standing}
        ui={ui}
        locale={locale}
      />

      {/* SCUML item 17: who the lister behind a transaction was acting for. */}
      <ui.Section title={t.complianceBeneficialOwnership.lane.lookupTitle} hint={t.complianceBeneficialOwnership.lane.lookupHint}>
        <ActingForLookup action="/admin/payments" kind={acting.kind} id={acting.id} locale={locale} />
        {acting.id.length > 0 && <ActingFor kind={acting.kind} id={acting.id} locale={locale} />}
      </ui.Section>
      {copilot}
    </div>
  );
}
