/**
 * OPS-17: THE FIRST PATH SEGMENTS THIS APP ANSWERS AT.
 *
 * A signed-out request for a closed page is sent to sign-in, and so was a
 * request for an address that does not exist at all: every mistyped or dead
 * link became a 307 to a sign-in screen, and no signed-out 404 ever existed.
 * The proxy now answers an unknown first segment with the site's real 404
 * instead. `known-routes.test.ts` walks `src/app` and fails when a routable
 * directory is added or removed without this list following it. The
 * extra names are `next.config.ts` redirects (`/agents…` and `/trips`,
 * folded into Plans by V-76, and `/escrow`, retired by Track A
 * on 25 September 2026 and sent to `/agreements`). `/wallet` was one too, until
 * the member balance (Part B phase 6) became its page. `/support` was one until
 * it became a page of its own, the in-app help and support home.
 */
export const KNOWN_TOP_SEGMENTS: ReadonlySet<string> = new Set([
  "about", "admin", "agent", "agents", "agreements", "ai", "api", "areas", "around", "assistant", "auth", "bookings", "calls",
  "cancellations", "careers", "check", "checkout", "compare", "contact", "delete-account", "directory", "disclaimer", "docs", "escrow",
  "email", "eula", "first-run", "for-agents", "for-hosts", "for-landlords", "forgot-password", "gallery", "guides", "help", "home", "home-or-landing", "host", "host-agreement", "inspections",
  "join", "landlord", "leaderboard", "legal", "listing", "messages", "move-in-cost", "notifications", "offline", "open", "pay", "payments", "passport", "post",
  "payouts", "preview", "price", "privacy", "pro", "profile", "r", "receipts", "record", "refunds", "rent", "reset-password", "restaurant", "rewards",
  "restaurants", "s", "safe", "safety", "saved", "search", "settings", "sign-in", "sign-up",
  "standards", "start", "stay", "stays", "stories", "styleguide", "support", "tenancy", "terms",
  "trips", "u", "verification", "wallet", "welcome",
]);

/** The redirect sources in `next.config.ts`, which have no directory. */
export const REDIRECT_ONLY_SEGMENTS: ReadonlySet<string> = new Set(["agents", "escrow", "trips"]);

/** Whether the first segment of `path` is one this app can answer at. */
export function isKnownRoute(path: string): boolean {
  const first = path.split("/").filter(Boolean)[0];
  return first === undefined || KNOWN_TOP_SEGMENTS.has(first);
}
