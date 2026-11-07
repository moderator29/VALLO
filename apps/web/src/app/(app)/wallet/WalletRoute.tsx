import { EmptyActions } from "@/components/app/EmptyActions";
import { getLocale } from "@/lib/locale";
import { readMyBalance } from "@/lib/money/member-wallet";
import { BALANCE_LEDE } from "@/lib/money/balance-copy";
import { isWalletFilter } from "@/lib/money/wallet-view";
import { EmptyState } from "@/components/app/Screen";
import { ButtonLink } from "@/components/ui/Button";
import { withNext } from "@/lib/auth/next-link";
import { BalanceView, type WalletScreen } from "@/components/money/balance/BalanceView";
import { WalletHeader } from "@/components/money/balance/WalletChrome";

/** How many movements the Transactions screen reads; the overview previews the first few. */
const TRANSACTIONS_LIMIT = 100;

/**
 * One Wallet screen on the real read (D81). Every screen under /wallet is
 * drawn through this, so each one has the same honest states: signed out
 * (a door back here through `withNext`), not connected, opening the
 * account, the read failed, and the screen itself.
 */
export async function WalletRoute({ screen, path, title, filter }: { screen: WalletScreen; path: string; title: string; filter?: string }) {
  const locale = await getLocale();
  const read = await readMyBalance({ limit: screen === "transactions" ? TRANSACTIONS_LIMIT : 20 });

  return (
    <main className="nf-page">
      {read.state === "signed-out" ? (
        <div className="nf-mw">
          <WalletHeader title={title} back="/home" />
          <EmptyState
            icon="bank-column"
            title="Sign in to continue"
            body={BALANCE_LEDE}
            action={<EmptyActions primary={{ label: "Sign in", href: withNext("/sign-in", path) }} />}
          />
        </div>
      ) : (
        <BalanceView read={read} locale={locale} screen={screen} filter={isWalletFilter(filter) ? filter : undefined} />
      )}
    </main>
  );
}
