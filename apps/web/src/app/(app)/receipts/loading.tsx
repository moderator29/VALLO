import { PageFrame } from "@/components/app/PageFrame";
import { TYPE } from "@/components/app/Screen";
import { Line, MoneyWait } from "@/components/app/money-history/MoneyWait";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import { StatusPill } from "@/components/ui/StatusPill";
import {
  PARTNERS_SHORT,
  RECEIPTS_FILTER,
  RECEIPTS_LEDE,
  RECEIPTS_SEARCH_HINT,
  RECEIPTS_SEARCH_LABEL,
  RECEIPTS_TITLE,
  RECEIPT_PRIVACY_ACTION,
  RECEIPT_PRIVACY_BODY,
  RECEIPT_PRIVACY_TITLE,
} from "@/lib/money/copy";

/**
 * Receipts, before the payment history is read (W2, round 5): the vault
 * itself, inert (`MoneyWait`). The search field, the three kinds, the
 * sharing card and the partners line are the page's own, drawn where they
 * will stay; the receipts are list rows with slabs for the title, the
 * date line, the amount and the state. A wait cannot read the address, so
 * it draws the default kind (All); a link that names another kind changes
 * which chip is lit when the page lands, and nothing moves. The chips and
 * the sharing action are drawn without their links, so the wait prefetches
 * nothing.
 */
export default function LoadingReceipts() {
  return (
    <MoneyWait label="Loading your receipts" className="nf-page nf-md">
      <PageFrame title={RECEIPTS_TITLE} fallback="/payments">
      <div>
      <div className="mt-inline space-y-block">
        <p className={TYPE.body}>{RECEIPTS_LEDE}</p>
        <div className="space-y-block">
          <div className="grid gap-inline">
            <label htmlFor="nf-vault-q-wait" className="nf-body-sm font-semibold text-[var(--nf-content-secondary)]">
              {RECEIPTS_SEARCH_LABEL}
            </label>
            <input id="nf-vault-q-wait" type="search" placeholder={RECEIPTS_SEARCH_HINT} className="nf-field" readOnly tabIndex={-1} />
          </div>
          <div className="flex flex-wrap gap-inline">
            {(["all", "payment", "refund"] as const).map((k) => (
              <Chip key={k} behaviour="static" selected={k === "all"}>
                {RECEIPTS_FILTER[k]}
              </Chip>
            ))}
          </div>
          <ListGroup label={RECEIPTS_FILTER.all} labelAs="h2">
            {[0, 1, 2].map((i) => (
              <ListRow
                key={i}
                /* Two lines each, as a place's name and the date, kind and
                   reference line set in this column at phone width. */
                title={
                  <>
                    <Line width="100%" />
                    <Line width="55%" />
                  </>
                }
                sub={
                  <>
                    <Line width="100%" />
                    <Line width="60%" />
                  </>
                }
                value={<Line width="5.5rem" />}
                status={
                  <StatusPill tone="neutral">
                    <Line width="3.5em" />
                  </StatusPill>
                }
                chevron
              />
            ))}
          </ListGroup>
          <section className="nf-panel nf-panel--card">
            <h2 className="nf-body font-semibold text-[var(--nf-content-primary)]">{RECEIPT_PRIVACY_TITLE}</h2>
            <p className="nf-body-sm mt-inline text-[var(--nf-content-secondary)]">{RECEIPT_PRIVACY_BODY}</p>
            <div className="mt-row">
              {/* A button, not the page's link: a link in a wait would prefetch. */}
              <Button variant="secondary" size="md">
                {RECEIPT_PRIVACY_ACTION}
              </Button>
            </div>
          </section>
        </div>
        <p className={TYPE.rowMeta}>{PARTNERS_SHORT}</p>
      </div>
      </div>
    </PageFrame>
    </MoneyWait>
  );
}
