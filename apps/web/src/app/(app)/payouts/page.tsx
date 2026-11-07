import type { Metadata } from "next";
import { getLocale } from "@/lib/locale";
import { readMyEarnings } from "@/lib/money/history";
import { parseBefore } from "@/lib/money/history-model";
import { PAYOUTS_LEDE, PAYOUTS_TITLE } from "@/lib/money/copy";
import { PageFrame } from "@/components/app/PageFrame";
import { EmptyState } from "@/components/app/Screen";
import { ButtonLink } from "@/components/ui/Button";
import { withNext } from "@/lib/auth/next-link";
import { HistoryUnavailable } from "@/components/app/money-history/HistoryStates";
import { PayoutsView } from "@/components/money/PayoutsView";
import { getDictionary } from "@vallo/i18n";
import { readMyChargebackHold } from "@/lib/money/chargeback-hold";
import { ChargebackHoldNotice } from "@/components/money/ChargebackHoldNotice";

export const metadata: Metadata = { title: "Payouts", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * /payouts: PAYOUTS FOR HOSTS AND OWNERS (R3-05), with the same figures as at
 * publish (D51 rule 4): what was paid, the platform fee in naira, and what
 * reached the bank, payment by payment.
 *
 * From the lister's own earnings history (`my_earnings_history`, under their
 * session), whose rows carry the gross, the commission and any legacy
 * Guarantee contribution as recorded at settlement. Nothing is withdrawn here,
 * because on the live rail nothing waits to be: each share settled to the bank
 * in the same transaction (`EARNINGS_SETTLEMENT`).
 */
export default async function PayoutsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getLocale();
  const before = parseBefore((await searchParams).before);
  const [read, hold] = await Promise.all([readMyEarnings(before), readMyChargebackHold()]);

  return (
    <main className="nf-page nf-md nf-history">
      <PageFrame title={PAYOUTS_TITLE} fallback="/home">
      <div>
      {/* Chargebacks: the payout rule, said calmly, only when it applies. */}
      <ChargebackHoldNotice hold={hold} copy={getDictionary(locale).chargebacks.hold} locale={locale} />
      {read.state === "signed-out" ? (
        <EmptyState
          icon="bank-column"
          title="Sign in to see your payouts"
          body={PAYOUTS_LEDE}
          action={
            <ButtonLink href={withNext("/sign-in", "/payouts")} variant="primary" size="lg">
              Sign in
            </ButtonLink>
          }
        />
      ) : read.state === "error" ? (
        <div className="mt-block">
          <HistoryUnavailable retryHref="/payouts" />
        </div>
      ) : (
        <PayoutsView summary={read.summary} entries={read.entries} nextBefore={read.nextBefore} before={before} locale={locale} now={new Date().getTime()} />
      )}
      </div>
    </PageFrame>
    </main>
  );
}
