import { inForceCaption, rateStartLabel } from "@/lib/admin/fee-dates";
import type { Metadata } from "next";
import { countOf, formatMoney, getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { getFeeConsole, type FeeRateView } from "@/lib/admin/money-queries";
import { getRevenueSummary, REVENUE_WINDOW_DAYS } from "@/lib/admin/revenue-queries";
import type { RevenueSummary } from "@/lib/admin/revenue-queries";
import { adminUi, type AdminUi } from "../_components/ui";
import { PageHead } from "../_components/panels";
import { FeeRateForm } from "../_components/MoneyDecisions";
import { PaperLedger, PaperLedgerRow, PaperStatus } from "../_components/paper";
import { DocFigure, DocHead, DocRow, DocRows, DocSection, DocState, DocumentSheet } from "@/components/app/money/DocumentSheet";
import { readWithdrawalFees } from "@/lib/admin/desk-reads/withdrawal-fees-read";
import { WithdrawalFees } from "./WithdrawalFees";

export const metadata: Metadata = {
  title: "Fees",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const SOURCE_LABEL: Record<string, string> = {
  /* The source key is historical: rows from before custody was retired
     (docs/MONEY_ARCHITECTURE.md) still carry it. Vallo holds no escrow now. */
  escrow_commission: "Commission (before custody was retired)",
  listing_fee: "Listing fee",
};

/**
 * What the platform charges, what it has earned, and the controls to change it.
 *
 * Everything is zero today, by the owner's decision: the engine is built and
 * switched off until there is a user base, so that nobody already earning here
 * is ambushed by a rate they did not sign up to.
 *
 * ZERO IS RENDERED AS "NO FEE" AND NEVER AS A BLANK. That is the one rule this
 * page has to get right. A missing value and a deliberate zero look identical
 * in a table of numbers and mean completely different things: one is a decision
 * the platform made and can stand behind, the other is a bug. Every row here
 * says which.
 *
 * A rate change is an INSERT, never an edit, so the history below is the whole
 * story of what has ever been charged and nothing in it can be quietly revised.
 * That is also why a rate cannot start in the past: back-dating one would make
 * a fee already charged unexplainable by the table.
 *
 * THE EARNED SECTION IS THE OTHER HALF OF THE SAME QUESTION, and it is new.
 * A rate table says what the platform intends to charge. It cannot say whether
 * a single naira ever arrived, and until `public.platform_revenue` existed the
 * answer was that commission was withheld from payees and credited to nobody.
 * Showing the rate and the receipts on one screen is what makes the difference
 * visible: a rate above zero with nothing earned beside it is now a question an
 * operator can see rather than one nobody could ask.
 */
export default async function AdminFeesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const ui = adminUi(t, locale);

  const asked = (await searchParams)["withdraw"];
  const [read, revenue, withdrawal] = await Promise.all([
    getFeeConsole(),
    getRevenueSummary(REVENUE_WINDOW_DAYS),
    readWithdrawalFees(typeof asked === "string" ? asked.slice(0, 20) : null),
  ]);

  if (read.state !== "ok") {
    return (
      <div className="nf-console">
        <PageHead title="Fees" lede="What the platform charges." />
        <ui.QueueUnavailable />
      </div>
    );
  }

  return (
    <div className="nf-console">
      <PageHead
        title="Fees"
        lede="What the platform charges, with the date each rate started. Changing a rate adds a row rather than editing one, so anything already charged stays explainable by the rate that was in force at the time."
      />

      <FeeSection
        title="Commission on a completed transaction"
        blurb="Taken from money that actually changed hands: a rent or a stay that was paid for, as Vallo's share of the split charge. Vallo never holds the rest. It is computed at the moment of settlement and frozen onto the transaction with the rate that produced it, so it is never recomputed from a rate that has moved since."
        kind="commission"
        rates={read.data.commission}
        ui={ui}
        locale={locale}
      />

      <FeeSection
        title="Listing fee"
        blurb="Charged to a lister for putting a property up. Not a share of anything, which is why it can be a flat amount as well as a percentage."
        kind="listing_fee"
        rates={read.data.listingFee}
        ui={ui}
        locale={locale}
      />

      <Earned
        summary={revenue.state === "ok" ? revenue.data : null}
        ratesAllZero={[read.data.commission, read.data.listingFee].every((rates) => {
          const live = rates.find((r) => r.inForce);
          return !live || (live.basisPoints === 0 && live.flatMinor === 0);
        })}
        ui={ui}
        locale={locale}
      />

      <WithdrawalFees read={withdrawal} locale={locale} />
    </div>
  );
}

function describe(rate: FeeRateView, locale: Awaited<ReturnType<typeof getLocale>>): string {
  const parts: string[] = [];
  if (rate.basisPoints > 0) parts.push(`${rate.basisPoints / 100}%`);
  if (rate.flatMinor > 0) parts.push(`${formatMoney(rate.flatMinor, locale)} flat`);
  // The whole point of this page. A zero rate is an answer, not an absence.
  return parts.length === 0 ? "No fee" : parts.join(" plus ");
}

/**
 * What has actually landed in `public.platform_revenue`.
 *
 * Read through `public.admin_revenue_summary`, because the table denies every
 * browser-reachable role outright. An unavailable read renders as a refusal
 * rather than as zero: "you cannot see this" and "the platform has earned
 * nothing" are very different sentences and must never be printed the same way.
 */
function Earned({
  summary,
  ratesAllZero,
  ui,
  locale,
}: {
  summary: RevenueSummary | null;
  /* "Every rate is zero today" is said only when it is true: nothing earned
     under a live rate above zero is a different fact, and the per-source rows
     below already say "Nothing booked in this window". */
  ratesAllZero: boolean;
  ui: AdminUi;
  locale: Awaited<ReturnType<typeof getLocale>>;
}) {
  const t = getDictionary(locale);
  if (!summary) {
    return (
      <ui.Section title="What the platform has earned">
        <ui.QueueUnavailable />
      </ui.Section>
    );
  }

  /* The revenue ledger is a RECORD, so it is a statement on paper (D28.1):
     the window's total leads, then where it came from, then the latest entries.
     Nothing on it is a control. */
  return (
    <section className="nf-admin-doc">
      <DocumentSheet aria-labelledby="earned-title" data-testid="revenue-statement">
        <DocHead label={t.experienceAdmin.money.statementOverline} title="What the platform has earned" id="earned-title" />
        <p className="nf-doc__label mt-sm">{`Last ${summary.windowDays} days`}</p>
        <DocFigure>{formatMoney(summary.windowTotalMinor, locale)}</DocFigure>
        {summary.windowTotalMinor === 0 && ratesAllZero && <p className="nf-doc__note">Every rate is zero today</p>}
        <DocRows>
          <DocRow label="All time" numeric>
            {formatMoney(summary.allTimeMinor, locale)}
          </DocRow>
          {summary.bySource.map((line) => (
            <DocRow key={line.source} label={SOURCE_LABEL[line.source] ?? line.source} numeric>
              {formatMoney(line.amountMinor, locale)}
              <span className="block text-[length:var(--nf-text-overline)] font-normal text-[var(--nf-content-muted)]">
                {line.entries === 0 ? "Nothing booked in this window" : countOf(line.entries, "entries")}
              </span>
            </DocRow>
          ))}
        </DocRows>
        <p className="nf-doc__note">
          Booked to the revenue ledger, which is written in the same transaction that credits the payee. Totals cover the last{" "}
          {summary.windowDays} days. All time is since the revenue ledger existed.
        </p>

        {summary.recent.length > 0 && (
          <DocSection title="The most recent entries">
            <PaperLedger label="The most recent revenue entries">
              {summary.recent.map((entry) => (
                <PaperLedgerRow
                  key={entry.id}
                  when={ui.when(entry.createdAt)}
                  title={SOURCE_LABEL[entry.source] ?? entry.source}
                  sub={<span className="font-mono">{entry.reference}</span>}
                  amount={formatMoney(entry.amountMinor, locale)}
                  status={<PaperStatus state="done">Booked</PaperStatus>}
                />
              ))}
            </PaperLedger>
          </DocSection>
        )}
      </DocumentSheet>
    </section>
  );
}

function FeeSection({
  title,
  blurb,
  kind,
  rates,
  ui,
  locale,
}: {
  title: string;
  blurb: string;
  kind: "commission" | "listing_fee";
  rates: FeeRateView[];
  ui: AdminUi;
  locale: Awaited<ReturnType<typeof getLocale>>;
}) {
  const live = rates.find((r) => r.inForce);

  /* THE RATE IS A RECORD, THE FORM IS A CONTROL. What is in force and every rate
     there has ever been are drawn on a sheet of paper, because that history is
     exactly what gets shown to a lister or an auditor who asks what was
     charged. Changing a rate is a form, so it sits under the paper in the
     console's own theme, never on it. */
  return (
    <section className="nf-admin-doc" aria-labelledby={`fee-${kind}`}>
      <DocumentSheet aria-labelledby={`fee-${kind}`} data-testid={`fee-${kind}`}>
        <DocHead label="Rate" title={title} id={`fee-${kind}`} />
        <p className="nf-doc__note">{blurb}</p>

        <DocFigure>{live ? describe(live, locale) : "No rate on record"}</DocFigure>
        <p className="nf-doc__note">
          {live
            ? inForceCaption(live.effectiveFrom, ui.when)
            : "Nothing is being charged, because no rate exists at all. That is a bug rather than a decision."}
        </p>

        <DocSection title="Every rate there has ever been">
          <DocRows>
            {rates.map((rate) => (
              <DocRow key={rate.id} label={rateStartLabel(rate.effectiveFrom, ui.when)}>
                <span className="block font-semibold">
                  {describe(rate, locale)}
                  {rate.inForce && (
                    <span className="ml-xs">
                      <DocState done>In force</DocState>
                    </span>
                  )}
                  {rate.scheduled && (
                    <span className="ml-xs">
                      <DocState done={false}>Starts later</DocState>
                    </span>
                  )}
                </span>
                {rate.setByName && (
                  <span className="block text-[length:var(--nf-text-overline)] font-normal text-[var(--nf-content-muted)]">
                    {rate.setByName}
                  </span>
                )}
                {rate.note && (
                  <span className="block text-[length:var(--nf-text-overline)] font-normal text-[var(--nf-content-muted)]">{rate.note}</span>
                )}
              </DocRow>
            ))}
          </DocRows>
        </DocSection>
      </DocumentSheet>

      <FeeRateForm
        kind={kind}
        currentBasisPoints={live?.basisPoints ?? 0}
        currentFlatMinor={live?.flatMinor ?? 0}
      />
    </section>
  );
}
