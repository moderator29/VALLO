import { dateTimeLabel } from "@/lib/format/when";
import type { Metadata } from "next";
import { MoneyHistoryPanel } from "../_components/MoneyHistoryPanel";
import { formatMoney, getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { requireAdmin } from "@/lib/admin/guard";
import { getRefundConsole } from "@/lib/admin/money-queries";
import { getReconciliationHealth, getRentCharges } from "@/lib/admin/reads/money";
import { readGuaranteeDesk } from "@/lib/admin/reads/agreements";
import { readRefundClockBoard } from "@/lib/after-gate/refunds";
import { adminUi } from "../_components/ui";
import { DeskSections } from "../_components/DeskSections";
import { rulingWords } from "../_components/rulings";
import { DocFigure, DocHead, DocRow, DocRows, DocumentSheet } from "@/components/app/money/DocumentSheet";
import { readQueueQuery } from "../_components/QueueFilters";
import { PageHead, Panel } from "../_components/panels";
import { RefundsPanel } from "./MoneyRows";
import { ReconciliationPanel } from "./_desk/Reconciliation";
import { RefundClock } from "./RefundClock";
import { GuaranteeClaims } from "./GuaranteeDesk";
import { CautionRulings } from "./CautionDesk";
import { LedgerBooks } from "./LedgerBooks";
import { readLedgerBooks } from "@/lib/admin/desk-reads/ledger-books";
import { readCautionDesk } from "@/lib/admin/reads/caution-desk";
import type { SupabaseClient } from "@supabase/supabase-js";
import "./_desk/desk.css";
import "../agreements/agreements.css";

export const metadata: Metadata = {
  title: "Money",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * THE MONEY DESK, AFTER CUSTODY (Track A, 25 September 2026).
 *
 * Vallo never holds customer money, so there is no float, no wallet ledger,
 * no withdrawal to chase and no escrow to rule on. What is left for a person
 * to watch is:
 *
 *  - THE VALLO GUARANTEE: what the reserve holds (contributions settled with
 *    each charge, less approved claims), and the claims waiting on a decision.
 *  - CAUTIONS: disputed deductions and contested returns to rule on (V-36).
 *  - REFUNDS: every refund decided, and whether Paystack has taken it back to
 *    the card.
 *  - RECONCILIATION: whether the scheduled job that compares Paystack's
 *    charges with our records is running and clean.
 *  - TENANCY CHARGES: the move-in charges and whether each was paid.
 */
export default async function AdminMoneyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const ui = adminUi(t, locale);
  const params = await searchParams;
  const asked = readQueueQuery(params);
  const query = {
    ...(asked.q ? { q: asked.q } : {}),
    ...(asked.from ? { from: asked.from } : {}),
    ...(asked.to ? { to: asked.to } : {}),
  };
  const narrowed = Boolean(query.q || query.from || query.to);

  const access = await requireAdmin("finance");
  if (access.state !== "admin") {
    return (
      <div className="nf-console">
        <PageHead title="Money" lede="Your account cannot open this desk." />
      </div>
    );
  }

  const [guarantee, refunds, runs, rent, clock, caution, ledger] = await Promise.all([
    // The reserve's figures decide on auth.uid(), so they are asked as the operator.
    readGuaranteeDesk(access.supabase, access.userClient),
    getRefundConsole(query),
    getReconciliationHealth(),
    getRentCharges(),
    readRefundClockBoard(locale),
    readCautionDesk(access.userClient as unknown as SupabaseClient, access.supabase as unknown as SupabaseClient),
    // A service-role view: read on the server, behind the same finance door.
    readLedgerBooks(),
  ]);

  const x = t.experienceAdmin;
  const words = rulingWords(t);
  const sections = [
    { id: "guarantee", label: x.sections.guarantee, icon: "shield-stop" as const },
    { id: "caution", label: x.sections.cautions, icon: "key" as const },
    { id: "refunds", label: x.sections.refunds, icon: "wallet" as const },
    { id: "reconciliation", label: x.sections.reconciliation, icon: "history" as const },
    { id: "ledger", label: t.adminCoverage.ledger.title, icon: "document" as const },
    ...(rent.state === "ok" ? [{ id: "rent", label: x.sections.tenancy, icon: "document" as const }] : []),
    { id: "refund-clock", label: x.sections.refundClock, icon: "calendar-booking" as const },
    { id: "history", label: x.sections.history, icon: "feed" as const },
  ];

  return (
    <div className="nf-console nf-md">
      <PageHead
        title="Money"
        lede="Vallo never holds customer money: every card payment settles at the processor straight to the lister and Vallo in one transaction. This desk watches cautions, refunds to the card, the reconciliation job, and the record of the retired Vallo Guarantee."
      />

      {/* One desk, six questions: the glass pull lists them and scrolls to each. */}
      <DeskSections sections={sections} label={x.sections.navLabel} toggleLabel={x.sections.toggle} />

      {/* THE RESERVE, AS A STATEMENT. A record (what the reserve holds, what
          went in and what went out) is a light document sheet; the claims under
          it are controls, so they stay in the console's own theme (D28.1). */}
      <section id="guarantee" className="nf-admin-doc nf-admin-anchor">
        <DocumentSheet aria-labelledby="guarantee-title" data-testid="guarantee-statement">
          <DocHead label={x.money.statementOverline} title="The Vallo Guarantee (retired 9 November 2026)" id="guarantee-title" />
          {guarantee.state !== "ok" ? (
            <p className="nf-body mt-sm">The Guarantee reserve could not be read just now. Refresh to try again.</p>
          ) : (
            <>
              <p className="nf-doc__label mt-sm">In the reserve</p>
              <DocFigure testId="guarantee-reserve">{formatMoney(guarantee.balanceMinor, locale)}</DocFigure>
              <p className="nf-doc__note">Contributions less approved claims</p>
              <DocRows>
                <DocRow label="Contributed" numeric>
                  {formatMoney(guarantee.contributedMinor, locale)}
                </DocRow>
                <DocRow label="Paid out" numeric>
                  {formatMoney(guarantee.paidOutMinor, locale)}
                </DocRow>
              </DocRows>
              <p className="nf-doc__note">
                Retired by the founder on 9 November 2026: no new contributions and no new claims. What is shown is the
                record, and any claim made before it retired is still decided here.
              </p>
            </>
          )}
        </DocumentSheet>
        {guarantee.state === "ok" && (
          <Panel title="Claims made before it retired" id="claims" className="mt-md">
            <GuaranteeClaims claims={guarantee.claims} locale={locale} words={words} />
          </Panel>
        )}
      </section>

      <Panel title="Cautions" id="caution" className="nf-admin-anchor">
        <p className="nf-body">
          Vallo never holds a caution: it was paid to the lister with the move-in and is paid back between the parties. Rule on
          the record here. What is still owed after the due date, not in question, comes here as an escalation: investigate it
          against the inspection report and the messages, and give both sides the evidence held.
        </p>
        <div className="mt-block">
          <CautionRulings desk={caution} locale={locale} words={words} />
        </div>
      </Panel>

      <RefundsPanel refunds={refunds} narrowed={narrowed} locale={locale} ui={ui} />

      <section id="reconciliation" className="nf-admin-anchor">
        <ReconciliationPanel
          health={runs.state === "ok" ? runs.data : null}
          now={requestTime()}
          when={(iso) => (iso ? dateTimeLabel(iso) : "never")}
          variant="check"
          locale={locale}
        />
      </section>

      <LedgerBooks read={ledger} locale={locale} />

      {rent.state === "ok" ? (
        <Panel title="Tenancy charges" id="rent" className="nf-admin-anchor">
          <p className="nf-body">
            {rent.data.total} move-in charges opened; the latest are listed on each tenancy. A move-in charge opens only on
            an approved agreement.
          </p>
        </Panel>
      ) : null}

      <section id="refund-clock" className="nf-admin-anchor">
        <RefundClock board={clock} copy={t.afterTheGate.admin} />
      </section>

      {/* Every payment and refund that has already moved, platform-wide, read
          as the caller (the finance scope decides), with its CSV export. */}
      <MoneyHistoryPanel userClient={access.userClient} locale={locale} />
    </div>
  );
}

/** The request's clock, read once so every time on the page agrees. */
function requestTime(): number {
  return Date.now();
}
