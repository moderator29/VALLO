/**
 * WHICH SCREENS THE APP SWITCHER MUST NOT SHOW (NATIVE_BUILD_QUEUE item 5).
 *
 * When the app leaves the screen (the app switcher, Control Centre, a call
 * coming in), iOS takes a picture of the last frame for the switcher, and
 * Android does the same for Recents. On a wallet balance, a payout, a card
 * form or an identity document that picture is a leak to anyone glancing at
 * the phone. The shell covers these screens before the picture is taken
 * (`ValloShell.setPrivacyCover`, built into the iOS and Android projects).
 *
 * Plugin-free on purpose, so it can be tested and imported anywhere at no
 * cost. `privacy-cover.ts` is the half that talks to the shell.
 *
 * By path prefix, matched on whole segments. A screen elsewhere that shows
 * money in a sheet takes a hold instead (`holdPrivacyCover`).
 */
export const PRIVATE_PREFIXES: readonly string[] = [
  /* Money. */
  "/wallet",
  "/checkout",
  "/pay",
  "/payments",
  "/payouts",
  "/refunds",
  "/receipts",
  "/rent/pay",
  "/rent/review",
  "/rewards/withdraw",
  "/agent/earnings",
  "/host/earnings",
  "/admin/money",
  "/admin/payments",
  /* The keys to the money and the person. */
  "/settings/payments",
  "/settings/passcode",
  "/settings/privacy/money-lock",
  "/verification",
  "/admin/kyc",
];

/** `/agreements/<id>/fund` is the one money screen under a dynamic segment. */
const PRIVATE_PATTERNS: readonly RegExp[] = [/^\/agreements\/[^/]+\/fund(\/|$)/];

export function isPrivateScreen(pathname: string): boolean {
  const path = (pathname || "/").split(/[?#]/)[0]!.replace(/\/+$/, "") || "/";
  if (PRIVATE_PATTERNS.some((re) => re.test(path))) return true;
  return PRIVATE_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}
