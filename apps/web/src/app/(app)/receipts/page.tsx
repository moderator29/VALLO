import type { Metadata } from "next";
import { getLocale } from "@/lib/locale";
import { readMyPayments } from "@/lib/money/history";
import { parseBefore } from "@/lib/money/history-model";
import { parseVaultKind, parseVaultQuery, vaultEntries } from "@/lib/money/vault";
import { PARTNERS_SHORT, RECEIPTS_EMPTY_BODY, RECEIPTS_EMPTY_TITLE, RECEIPTS_LEDE, RECEIPTS_TITLE } from "@/lib/money/copy";
import { PageFrame } from "@/components/app/PageFrame";
import { EmptyActions } from "@/components/app/EmptyActions";
import { EmptyState, TYPE } from "@/components/app/Screen";
import { ButtonLink } from "@/components/ui/Button";
import { withNext } from "@/lib/auth/next-link";
import { HistoryEmpty, HistoryUnavailable } from "@/components/app/money-history/HistoryStates";
import { ReceiptVault } from "@/components/money/ReceiptVault";

export const metadata: Metadata = { title: "Receipts", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * /receipts: THE RECEIPT VAULT (R3-05).
 *
 * Read from the member's own payment history (`my_payments_history`, under
 * their own session), the same record /payments draws: a receipt here is a
 * payment our partner confirmed or a refund that completed, never a pending
 * row. Each opens its booking, where the receipt is drawn on the document
 * sheet with its print action. A server-side search across every page is C2
 * REQUEST 6 to Session 2; until then the search says it covers the records on
 * this page, which it does.
 */
export default async function ReceiptsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getLocale();
  const params = await searchParams;
  const before = parseBefore(params.before);
  const kind = parseVaultKind(params.kind);
  const query = parseVaultQuery(params.q);
  const read = await readMyPayments(before);

  return (
    <main className="nf-page nf-md">
      <PageFrame title={RECEIPTS_TITLE} fallback="/payments">
      <div>
      {read.state === "signed-out" ? (
        <EmptyState
          icon="receipt-check"
          title="Sign in to see your receipts"
          body={RECEIPTS_LEDE}
          action={<EmptyActions primary={{ label: "Sign in", href: withNext("/sign-in", "/receipts") }} />}
        />
      ) : read.state === "error" ? (
        <div className="mt-block">
          <HistoryUnavailable retryHref="/receipts" />
        </div>
      ) : (
        <div className="mt-inline space-y-block">
          <p className={TYPE.body}>{RECEIPTS_LEDE}</p>
          {read.entries.length === 0 && !before ? (
            <HistoryEmpty title={RECEIPTS_EMPTY_TITLE} body={RECEIPTS_EMPTY_BODY} next={{ href: "/payments", label: "See your payments" }} />
          ) : (
            <ReceiptVault
              entries={vaultEntries(read.entries, kind, query)}
              scanned={read.entries.length}
              kind={kind}
              query={query}
              basePath="/receipts"
              locale={locale}
              counts={
                read.nextBefore || before
                  ? undefined
                  : { all: vaultEntries(read.entries, "all", query).length, payment: vaultEntries(read.entries, "payment", query).length, refund: vaultEntries(read.entries, "refund", query).length }
              }
            />
          )}
          {read.nextBefore ? (
            <ButtonLink href={`/receipts?before=${encodeURIComponent(read.nextBefore)}`} variant="secondary" size="md">
              Show earlier
            </ButtonLink>
          ) : null}
          <p className={TYPE.rowMeta}>{PARTNERS_SHORT}</p>
        </div>
      )}
      </div>
    </PageFrame>
    </main>
  );
}
