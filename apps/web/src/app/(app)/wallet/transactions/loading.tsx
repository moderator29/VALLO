import { MoneyWait } from "@/components/app/money-history/MoneyWait";
import { PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";
import "@/app/css/money-wallet.css";

/**
 * The transactions list, while it loads (SW12, round 3): the page top, the
 * Overview | Transactions switch, the available strip, the filter chips and
 * the rows, inert, so nothing moves when the partner's record lands. It was
 * the overview's balance card, a different screen's shape.
 */
export default function LoadingWalletTransactions() {
  return (
    <MoneyWait label="Loading your transactions" className="nf-page">
      <div className="nf-mw" data-testid="wallet-transactions-loading">
        <PageHeaderSkeleton layout="large" />
        <span className="nf-skeleton block" style={{ height: "3.25rem", borderRadius: "var(--nf-radius-segment)" }} aria-hidden="true" />
        <span className="nf-skeleton block" style={{ height: "4.5rem", borderRadius: "var(--nf-radius-lg)" }} aria-hidden="true" />
        <div className="flex gap-xs" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="nf-skeleton block" style={{ width: "5rem", height: "2.25rem", borderRadius: "var(--nf-radius-pill)" }} />
          ))}
        </div>
        <div className="nf-mw-panel" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="nf-mw-row">
              <span className="nf-skeleton block" style={{ width: "2.75rem", height: "2.75rem", borderRadius: "var(--nf-radius-md)" }} />
              <span className="grid gap-xs">
                <span className="nf-skeleton block" style={{ width: "60%", height: "0.875rem" }} />
                <span className="nf-skeleton block" style={{ width: "40%", height: "0.75rem" }} />
              </span>
              <span className="nf-skeleton block" style={{ width: "4.5rem", height: "0.875rem" }} />
            </div>
          ))}
        </div>
      </div>
    </MoneyWait>
  );
}
