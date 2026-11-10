/**
 * IS THE MEMBER WALLET REACHABLE? (founder, 10 November 2026).
 *
 * No. Vallo has no wallet provider, so the Wallet screens (overview,
 * transactions, settings, add, send, withdraw) are hidden: the routes under
 * /wallet return not found, and no nav, settings or home entry points at them.
 * The code is kept so the Wallet can return if a provider is ever chosen.
 *
 * This is the one switch. Rent payments go through the protected payment rail
 * (EscrowPay, switched off in `lib/rent/payment-open.ts` and the rail flag);
 * every other payment goes through Paystack. Neither needs a Wallet.
 *
 * Opening it is a founder decision made here in code, with its date. Pure and
 * client-safe.
 */
export const WALLET_OPEN: boolean = false;
