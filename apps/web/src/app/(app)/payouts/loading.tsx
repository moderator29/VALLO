import { PageFrame } from "@/components/app/PageFrame";
import { TYPE } from "@/components/app/Screen";
import { HeroFigureWait, MoneyWait, PayoutCardWait } from "@/components/app/money-history/MoneyWait";
import {
  EARNINGS_SETTLEMENT,
  EARNINGS_TOTAL_LABEL,
  HISTORY_NOT_A_BALANCE,
  PAYOUTS_LEDE,
  PAYOUTS_SAME_FIGURES,
  PAYOUTS_TITLE,
  PAYOUT_FEE_LABEL,
  PAYOUT_PAID_LABEL,
  PAYOUT_RECEIVED_LABEL,
} from "@/lib/money/copy";

/**
 * Payouts, before the earnings history is read (W2, round 5): the page
 * itself, inert, with only the figures as slabs (`MoneyWait`). The header,
 * the total's band with its caption and note, the lede and the labels of each
 * payout's sum are the page's own; the total, the dates and the amounts
 * arrive into lines already drawn at their height. It replaces the group's
 * generic rows, which had no band and so moved the whole screen when it came.
 */
export default function LoadingPayouts() {
  return (
    <MoneyWait label="Loading your payouts" className="nf-page grid grid-cols-1 gap-md nf-history">
      <PageFrame title={PAYOUTS_TITLE} fallback="/home">
      <div>
      <div className="mt-inline space-y-block">
        <HeroFigureWait caption={EARNINGS_TOTAL_LABEL} sub={`${EARNINGS_SETTLEMENT} ${HISTORY_NOT_A_BALANCE}`} />
        <p className={TYPE.body}>{PAYOUTS_LEDE}</p>
        <div className="grid gap-sm">
          <p className="nf-body-sm text-[var(--nf-content-secondary)]">{PAYOUTS_SAME_FIGURES}</p>
          <ol className="grid gap-sm">
            {[0, 1].map((i) => (
              <PayoutCardWait key={i} labels={[PAYOUT_PAID_LABEL, PAYOUT_FEE_LABEL]} total={PAYOUT_RECEIVED_LABEL} />
            ))}
          </ol>
        </div>
      </div>
      </div>
    </PageFrame>
    </MoneyWait>
  );
}
