import { PageFrame } from "@/components/app/PageFrame";
import { TYPE } from "@/components/app/Screen";
import { HistoryListWait, MoneyWait } from "@/components/app/money-history/MoneyWait";
import { REFUNDS_HOW_BODY, REFUNDS_HOW_TITLE, REFUNDS_LEDE, REFUNDS_SCOPE, REFUNDS_TITLE, REFUND_ROUTE } from "@/lib/money/copy";

/**
 * Refunds, before the payment history is read (W2, round 5): the page
 * itself, inert (`MoneyWait`). The lede, the scope line and the card that
 * says how a refund is asked for are the page's own words, so they are drawn
 * where they will stay; the refunds between them are rows with slabs for the
 * figures. A member with no refunds sees the rows give way to the empty
 * answer, which is the one thing the wait cannot know.
 */
export default function LoadingRefunds() {
  return (
    <MoneyWait label="Loading your refunds" className="nf-page nf-md nf-history">
      <PageFrame title={REFUNDS_TITLE} fallback="/payments">
      <div>
      <div className="mt-inline space-y-block">
        <p className={TYPE.body}>{REFUNDS_LEDE}</p>
        <p className={TYPE.rowMeta}>{REFUNDS_SCOPE}</p>
        <HistoryListWait rows={3} />
        <section className="nf-panel nf-panel--card">
          <h2 className="nf-body font-semibold text-[var(--nf-content-primary)]">{REFUNDS_HOW_TITLE}</h2>
          <p className="nf-body-sm mt-inline text-[var(--nf-content-secondary)]">{REFUNDS_HOW_BODY}</p>
          <p className="nf-body-sm mt-inline text-[var(--nf-content-secondary)]">{REFUND_ROUTE}</p>
        </section>
      </div>
      </div>
    </PageFrame>
    </MoneyWait>
  );
}
