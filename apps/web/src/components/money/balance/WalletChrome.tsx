import Link from "next/link";
import type { ReactNode } from "react";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { PageHeader } from "@/components/app/PageHeader";
import { ACTION_LABEL, WALLET_SETTINGS_TITLE, WALLET_TABS } from "@/lib/money/balance-copy";

/**
 * THE WALLET'S OWN CHROME (D81; the founder's governing reference, the
 * right-hand phone). The global header and dock step aside on /wallet
 * (`isFocusedRoute` in MobileTabBar.tsx), so this is the only bar: back,
 * the title, the settings gear; under it Overview and Transactions; and at
 * the foot of the Overview the two capsules, Withdraw and Send.
 *
 * Every address comes in through `WalletLinks`, so the preview harness can
 * draw the same screens wired to its own sample states.
 */
export type WalletLinks = {
  home: string;
  overview: string;
  transactions: string;
  settings: string;
  add: string;
  send: string;
  withdraw: string;
};

export const WALLET_LINKS: WalletLinks = {
  home: "/home",
  overview: "/wallet",
  transactions: "/wallet/transactions",
  settings: "/wallet/settings",
  add: "/wallet/add",
  send: "/wallet/send",
  withdraw: "/wallet/withdraw",
};

/**
 * The arrow is the shared `BackControl`, so it decides as every other back
 * does (`docs/BACK_NAVIGATION.md`): the screen the person came from when that
 * is safe, otherwise the declared parent (`/home` for the Overview, `/wallet`
 * for each Wallet screen), replacing rather than pushing. `back` is only the
 * answer for an address with no declared parent, such as the preview
 * harness's. A pushed link here left the screen just left behind the parent,
 * so the browser's own back walked straight into it again.
 */
export function WalletHeader({ title, back, settings, end }: { title: string; back: string; settings?: string | null; end?: ReactNode }) {
  /* ROUND 3 (the lead's ruling on Agent PAGES' job 1): the wallet's top is
     the platform's one page top, `PageHeader variant="large"` (what
     `PageFrame` draws): the round back, the large title, the gear as an
     action. The back decides as it always did (`BackControl` inside). */
  return (
    <div data-testid="wallet-header">
      <PageHeader
        variant="large"
        title={title}
        fallback={back}
        actions={
          end || settings ? (
            <>
              {end}
              {settings ? (
                <Link
                  href={settings}
                  className="nf-tap nf-icon-btn nf-icon-btn--round"
                  aria-label={WALLET_SETTINGS_TITLE}
                  data-testid="wallet-settings"
                >
                  <UiIcon name="settings-gear" size={20} />
                </Link>
              ) : null}
            </>
          ) : undefined
        }
      />
    </div>
  );
}

/** Overview | Transactions: two screens, so two links, the current one marked. */
export function WalletTabs({ active, links }: { active: "overview" | "transactions"; links: WalletLinks }) {
  return (
    <nav className="nf-mw-tabs" aria-label="Views" data-testid="wallet-tabs">
      {(["overview", "transactions"] as const).map((tab) => (
        <Link
          key={tab}
          href={tab === "overview" ? links.overview : links.transactions}
          className="nf-mw-tabs__tab"
          aria-current={active === tab ? "page" : undefined}
          data-testid={`wallet-tab-${tab}`}
        >
          {WALLET_TABS[tab]}
        </Link>
      ))}
    </nav>
  );
}

/**
 * THE TWO CAPSULES (D81; the brief, section 3E). Exactly two, side by side,
 * at the very bottom of the Overview: Withdraw (the action blue) and Send
 * (the spark fill). Nowhere else on the Wallet draws either. They open their
 * screens in every state; a screen that cannot finish yet says so at its
 * last step, never here by hiding the way in.
 */
export function WalletCapsules({ links }: { links: WalletLinks }) {
  return (
    <div className="nf-mw-capsules" role="group" aria-label="Move money" data-testid="wallet-capsules">
      <Link href={links.withdraw} className="nf-mw-cap nf-mw-cap--blue" data-testid="balance-action-withdraw">
        <UiIcon name="arrow-up" size={20} />
        <span>{ACTION_LABEL.withdraw}</span>
      </Link>
      <Link href={links.send} className="nf-mw-cap nf-mw-cap--spark" data-testid="balance-action-send">
        <UiIcon name="send" size={20} />
        <span>{ACTION_LABEL.send}</span>
      </Link>
    </div>
  );
}
