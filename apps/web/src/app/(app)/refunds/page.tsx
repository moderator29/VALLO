import type { Metadata } from "next";
import { getLocale } from "@/lib/locale";
import { readMyPayments } from "@/lib/money/history";
import { parseBefore } from "@/lib/money/history-model";
import { REFUNDS_LEDE, REFUNDS_TITLE } from "@/lib/money/copy";
import { PageFrame } from "@/components/app/PageFrame";
import { EmptyState } from "@/components/app/Screen";
import { ButtonLink } from "@/components/ui/Button";
import { withNext } from "@/lib/auth/next-link";
import { HistoryUnavailable } from "@/components/app/money-history/HistoryStates";
import { RefundsView } from "@/components/money/RefundsView";
import { protectedRailLive } from "@/lib/money/rail-live";

export const metadata: Metadata = { title: "Refunds", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * /refunds: THE MEMBER'S REFUNDS (R3-05).
 *
 * Every refund on a payment the member made, in every state, each with its
 * state as a word ("Processing", "Refunded", never the processor's code),
 * from the member's own payment history. A refund is asked for from its
 * booking, which is where the cancellation terms and the request live; this
 * screen says so rather than offering a second door to the same request. A
 * refunds-only read across every page is part of C2 REQUEST 6.
 */
export default async function RefundsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getLocale();
  const before = parseBefore((await searchParams).before);
  const [read, protectedRailOpen] = await Promise.all([readMyPayments(before), protectedRailLive()]);

  return (
    <main className="nf-page nf-md nf-history">
      <PageFrame title={REFUNDS_TITLE} fallback="/payments">
      <div>
      {read.state === "signed-out" ? (
        <EmptyState
          icon="receipt-check"
          title="Sign in to see your refunds"
          body={REFUNDS_LEDE}
          action={
            <ButtonLink href={withNext("/sign-in", "/refunds")} variant="primary" size="lg">
              Sign in
            </ButtonLink>
          }
        />
      ) : read.state === "error" ? (
        <div className="mt-block">
          <HistoryUnavailable retryHref="/refunds" />
        </div>
      ) : (
        <RefundsView
          entries={read.entries}
          nextBefore={read.nextBefore}
          before={before}
          locale={locale}
          protectedRailOpen={protectedRailOpen}
        />
      )}
      </div>
    </PageFrame>
    </main>
  );
}
