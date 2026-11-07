import { EmptyActions } from "@/components/app/EmptyActions";
import type { Metadata } from "next";
import { getLocale } from "@/lib/locale";
import { readMyBalance } from "@/lib/money/member-wallet";
import { BALANCE_LEDE, BALANCE_TITLE } from "@/lib/money/balance-copy";
import { EmptyState } from "@/components/app/Screen";
import { ButtonLink } from "@/components/ui/Button";
import { withNext } from "@/lib/auth/next-link";
import { BalanceView } from "@/components/money/balance/BalanceView";
import { WalletHeader } from "@/components/money/balance/WalletChrome";

export const metadata: Metadata = { title: "Wallet", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * /wallet: THE WALLET OVERVIEW (D81; the founder's brief of 8 October,
 * `docs/design/references/2026-10-08/WALLET-PROMPT.md`, and his governing
 * reference beside it; ADR 0003). What a member sees is money our escrow
 * partner holds for them, read from the partner with its time.
 *
 * Five honest states and no sixth: signed out; not connected (the whole
 * wallet drawn with no figure, because any figure would be invented);
 * opening the account; the read failed; and the wallet itself. Its screens:
 * /wallet/transactions, /wallet/settings, /wallet/add, /wallet/send and
 * /wallet/withdraw, each through `WalletRoute`. The preview harness draws
 * every state with sample reads (`/preview/money/wallet`).
 */
export default async function WalletPage() {
  const locale = await getLocale();
  const read = await readMyBalance();

  return (
    <main className="nf-page">
      {read.state === "signed-out" ? (
        <div className="nf-mw">
          <WalletHeader title={BALANCE_TITLE} back="/home" />
          <EmptyState
            icon="bank-column"
            title="Sign in to open Wallet"
            body={BALANCE_LEDE}
            action={<EmptyActions primary={{ label: "Sign in", href: withNext("/sign-in", "/wallet") }} />}
          />
        </div>
      ) : (
        <BalanceView read={read} locale={locale} />
      )}
    </main>
  );
}
