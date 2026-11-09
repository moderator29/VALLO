import { MoneyWait } from "@/components/app/money-history/MoneyWait";
import { FIGURE_LABEL } from "@/lib/money/balance-copy";
import { PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";
import "@/app/css/money-wallet.css";

/**
 * The Wallet, before the partner's figures arrive (D81): the header and the
 * card itself, inert, with the figure and the rows as slabs, so nothing
 * moves when they land. No zero is ever drawn in the meantime. Every screen
 * under /wallet waits on this.
 */
export default function LoadingWallet() {
  return (
    <MoneyWait label="Loading Wallet" className="nf-page">
      <div className="nf-mw" data-testid="wallet-loading">
        {/* The page's one top (round 3): the round back, the large title. */}
        <PageHeaderSkeleton layout="large" />
        <span className="nf-skeleton block" style={{ height: "3.25rem", borderRadius: "var(--nf-radius-segment)" }} aria-hidden="true" />
        <section className="nf-mw-card" data-theme="dark" aria-hidden="true">
          <div className="nf-mw-card__head">
            <span className="nf-mw-card__caption">{FIGURE_LABEL.available}</span>
          </div>
          <span className="nf-skeleton block" style={{ width: "62%", height: "2.5rem" }} />
          <span className="nf-skeleton block" style={{ width: "40%", height: "0.875rem" }} />
          <div className="nf-mw-card__totals">
            <span className="nf-skeleton block" style={{ height: "4.25rem", borderRadius: "var(--nf-radius-md)" }} />
            <span className="nf-skeleton block" style={{ height: "4.25rem", borderRadius: "var(--nf-radius-md)" }} />
          </div>
        </section>
        <span className="nf-skeleton block" style={{ height: "4rem", borderRadius: "var(--nf-radius-lg)" }} aria-hidden="true" />
        <div className="nf-mw-panel" aria-hidden="true">
          {[0, 1, 2].map((i) => (
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
