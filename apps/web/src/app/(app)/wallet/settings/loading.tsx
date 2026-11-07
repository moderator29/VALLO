import { MoneyWait } from "@/components/app/money-history/MoneyWait";
import { PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";
import "@/app/css/money-wallet.css";

/**
 * Wallet settings, while it loads (SW12, round 3): the page top, then each
 * group's label over its two-across grid of tool tiles, the shape the tools
 * screen draws. It was the overview's balance card.
 */
export default function LoadingWalletSettings() {
  return (
    <MoneyWait label="Loading wallet settings" className="nf-page">
      <div className="nf-mw" data-testid="wallet-settings-loading">
        <PageHeaderSkeleton layout="large" />
        {[0, 1, 2].map((group) => (
          <section key={group} className="nf-mw-section" aria-hidden="true">
            <span className="nf-skeleton block" style={{ width: "8rem", height: "1rem" }} />
            <div className="nf-mw-toolgrid">
              {[0, 1].map((i) => (
                <span key={i} className="nf-skeleton block" style={{ height: "8.5rem", borderRadius: "var(--nf-radius-lg)" }} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </MoneyWait>
  );
}
