import { notFound } from "next/navigation";
import { WALLET_OPEN } from "@/lib/money/wallet-open";

/**
 * One switch for every Wallet screen (`lib/money/wallet-open.ts`). While it is
 * closed each route under /wallet answers not found. The screens stay in the
 * code so the Wallet can come back.
 */
export default function WalletLayout({ children }: { children: React.ReactNode }) {
  if (!WALLET_OPEN) notFound();
  return children;
}
