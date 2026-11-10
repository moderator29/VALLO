import type { Metadata } from "next";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { readMyPayments } from "@/lib/money/history";
import { RowDownload } from "@/components/app/account/rows";
import { parseBefore } from "@/lib/money/history-model";
import { HISTORY_NOT_A_BALANCE } from "@/lib/money/copy";
import { PageFrame } from "@/components/app/PageFrame";
import { EmptyActions } from "@/components/app/EmptyActions";
import { EmptyState } from "@/components/app/Screen";
import { withNext } from "@/lib/auth/next-link";
import { HistoryUnavailable } from "@/components/app/money-history/HistoryStates";
import { PaymentsView } from "@/components/money/PaymentsView";
import { readMyBalances } from "@/lib/money/partner-reads";
import { readMyProtectedPayments } from "@/lib/money/protected-read";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: getDictionary(await getLocale()).experienceMoney.payments.title,
    robots: { index: false, follow: false },
  };
}
export const dynamic = "force-dynamic";

/**
 * /payments: what a renter or guest has paid through Vallo, and every refund
 * that came back to their card or bank account.
 *
 * A RECORD, NOT AN ACCOUNT. Vallo never holds anybody's money: when somebody
 * pays, Paystack splits the charge in the same transaction: the lister's share
 * to the lister's bank and any platform fee to Vallo. So there is
 * nothing on this screen to top up, spend or withdraw, and the figure at the
 * top is the sum of what was paid, said as that. Every row is read from
 * `my_payments_history` under the person's own session, at the moment of
 * asking (lib/money/history.ts).
 *
 * The total is lifetime and does not change as "Show earlier" pages back; the
 * list is fifty rows at a time, newest first, grouped by Lagos day.
 */
export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getLocale();
  /* The page's own words; every sentence about money is lib/money/copy.ts's. */
  const words = getDictionary(locale).experienceMoney.payments;
  const params = await searchParams;
  const before = parseBefore(params.before);
  /* Protected payments (BUILD 7.5): empty while the rail is off, which reads nothing. */
  const [read, balances, protectedRows] = await Promise.all([readMyPayments(before), readMyBalances(), readMyProtectedPayments()]);

  return (
    <main className="nf-page nf-md nf-history">
      <PageFrame title={words.title} fallback="/home">
      <div>

      {read.state === "signed-out" ? (
        <EmptyState
          icon="receipt-check"
          title={words.signInTitle}
          body={HISTORY_NOT_A_BALANCE}
          action={<EmptyActions primary={{ label: words.signIn, href: withNext("/sign-in", "/payments") }} />}
        />
      ) : read.state === "error" ? (
        <div className="mt-block">
          <HistoryUnavailable retryHref="/payments" />
        </div>
      ) : (
        <>
        {/* The member's own payments as a CSV, read under their own session (`/api/statement`). */}
        <div className="mt-inline">
          <RowDownload
            href="/api/statement"
            icon="arrow-down"
            label="Download statement"
            sub="Your payments and refunds as a spreadsheet file (CSV)."
            testId="payments-statement"
          />
        </div>
        <PaymentsView
          summary={read.summary}
          entries={read.entries}
          nextBefore={read.nextBefore}
          before={before}
          balances={balances}
          locale={locale}
          show={typeof params.show === "string" ? params.show : null}
          protectedPayments={protectedRows}
        />
        </>
      )}
      </div>
    </PageFrame>
    </main>
  );
}
