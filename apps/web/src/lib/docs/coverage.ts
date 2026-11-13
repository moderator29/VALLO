/**
 * THE DOCUMENTATION COVERAGE MANIFEST (Agent DOCS, 11 November 2026).
 *
 * Every page the app can serve (a `page.tsx` under `src/app`, development
 * previews and API handlers left out) maps to ONE of:
 *
 *   - a documentation entry: the address of the page that explains it
 *     (`/docs/<chapter>`, `/guides/...`, `/help`, a legal page, or a page of the
 *     staff manual at `/admin/handbook/manual/<page>`);
 *   - `needsNone`: an explicit, written reason it needs no documentation of its
 *     own (it IS a document, it is plumbing, it is internal);
 *   - `gap`: a feature that is real and not yet documented. A gap is allowed
 *     to exist but never silently: it carries its reason, it is listed in
 *     `docs/handoff/DOCS_COVERAGE.md`, and the test caps how many there are.
 *
 * `coverage.test.ts` fails when a route is in the app and in none of these, when
 * a listed route no longer exists, when a documentation entry points at a page
 * that does not exist, and when a document button points at a route that does
 * not exist. Add a page to the app and you add a line here, in the same change.
 *
 * Pure data, no imports of the app, so the test can read it anywhere.
 */

export type CoverageGroup =
  | { doc: string; routes: readonly string[] }
  | { needsNone: string; routes: readonly string[] }
  | { gap: string; routes: readonly string[] };

const D = (slug: string) => `/docs/${slug}`;
const M = (slug: string) => `/admin/handbook/manual/${slug}`;

export const COVERAGE: readonly CoverageGroup[] = [
  /* ---------------------------------------------------- the documents themselves */
  {
    needsNone: "These pages ARE the written surface: the documents, policies and their indexes.",
    routes: [
      "/about", "/careers", "/community", "/cancellations", "/disclaimer", "/eula", "/legal/disclaimer", "/legal/privacy",
      "/legal/terms", "/privacy", "/terms", "/standards", "/safety", "/host-agreement", "/docs", "/docs/[slug]", "/guides",
      "/guides/[slug]", "/help", "/ai/permissions", "/ai/privacy", "/ai/security", "/ai/terms", "/delete-account", "/support",
      "/settings/help",
      /* The other session's documents, which arrived with the merge of 10 November 2026. */
      "/legal", "/legal/cookies", "/cookies", "/docs/how-protection-works", "/admin/manual", "/admin/manual/[chapter]",
    ],
  },
  {
    needsNone: "Internal or developer-only surface, not met by a member.",
    routes: ["/styleguide"],
  },
  {
    needsNone: "Page plumbing a member passes through without a decision: a callback, a code step, the offline card, a first-run card.",
    routes: ["/auth/callback", "/offline", "/first-run/[feature]", "/sign-in/email", "/sign-in/phone", "/sign-up/finish", "/sign-up/photo", "/welcome"],
  },
  /* ------------------------------------------------------------------ account */
  {
    doc: D("getting-started"),
    routes: [
      "/", "/sign-in", "/sign-in/code", "/sign-up", "/sign-up/email", "/sign-up/verify", "/forgot-password", "/forgot-password/code",
      "/reset-password", "/home", "/profile", "/profile/application", "/profile/setup", "/profile/setup/[role]",
      "/profile/setup/agent", "/profile/setup/owner",
    ],
  },
  { doc: D("getting-around"), routes: ["/contact"] },
  { doc: D("settings"), routes: [
    "/settings", "/settings/accessibility", "/settings/account", "/settings/appearance", "/settings/devices", "/settings/devices/alert",
    "/settings/interests", "/settings/passcode", "/settings/passport", "/settings/payments", "/settings/phone", "/settings/place",
    "/settings/privacy", "/settings/privacy/ai", "/settings/privacy/blocked", "/settings/privacy/data", "/settings/privacy/money-lock",
    "/settings/region", "/settings/standing",
  ] },
  { doc: D("ai-assistant"), routes: ["/assistant", "/assistant/person", "/settings/ai-assistant", "/settings/ai-assistant/consent", "/agent/assistant", "/host/assistant"] },
  { doc: D("notifications"), routes: ["/notifications", "/notifications/[id]", "/settings/notifications", "/settings/notifications/reminders", "/email/preferences", "/agent/notifications", "/host/notifications"] },
  { doc: D("badges-and-verification"), routes: ["/verification", "/agent/verification"] },
  { doc: D("profiles-and-passport"), routes: ["/u", "/u/[handle]", "/u/[handle]/edit", "/u/[handle]/followers", "/u/[handle]/following", "/u/[handle]/message", "/passport/[who]", "/directory"] },
  { doc: D("rewards-and-referrals"), routes: [
    "/rewards", "/rewards/history", "/rewards/referrals", "/rewards/withdraw", "/leaderboard", "/settings/invite",
    "/settings/invite/how-it-works", "/settings/invite/referrals", "/settings/invite/referrals/[id]", "/r", "/r/[code]",
  ] },
  /* ------------------------------------------------------------------ finding */
  { doc: D("finding-a-place"), routes: ["/search", "/stays", "/stays/search"] },
  { doc: D("understanding-a-listing"), routes: ["/listing/[id]", "/listing/[id]/trust", "/stay/[id]", "/areas/[state]/[area]"] },
  { doc: D("saved-and-compare"), routes: ["/saved", "/saved/searches", "/compare"] },
  { doc: D("price-check"), routes: ["/price", "/price/area/[id]"] },
  { doc: D("tools-without-an-account"), routes: ["/move-in-cost", "/check", "/record/[code]", "/s/[token]", "/safe/[token]", "/landlord/[token]"] },
  { doc: D("viewings"), routes: ["/listing/[id]/visit", "/listing/[id]/visit/[inspectionId]", "/inspections/gate/[id]"] },
  /* ------------------------------------------------------- renting and paying */
  { doc: D("agreements-and-paying"), routes: ["/agreements", "/agreements/[id]", "/agreements/[id]/fund", "/agreements/[id]/held"] },
  { doc: D("tenancy-and-move-in"), routes: ["/rent/move-in/[listingId]", "/rent/pay/[inspectionId]", "/rent/review/[paymentId]", "/rent/share/[id]", "/tenancy/[id]", "/tenancy/[id]/complaint"] },
  { doc: D("booking-a-stay"), routes: ["/bookings", "/bookings/[bookingId]", "/checkout", "/checkout/[bookingId]"] },
  { doc: D("reviews"), routes: ["/bookings/[bookingId]/review"] },
  { doc: D("restaurants"), routes: ["/restaurants", "/restaurant/[id]", "/pay/deposit/[reservationId]"] },
  { doc: D("wallet"), routes: ["/wallet", "/wallet/add", "/wallet/send", "/wallet/settings", "/wallet/transactions", "/wallet/withdraw", "/payments", "/payouts", "/receipts", "/refunds"] },
  { doc: D("what-vallo-costs"), routes: ["/pro", "/pro/confirm"] },
  /* ------------------------------------------------------------------- offers */
  { doc: D("making-an-offer"), routes: ["/listing/[id]/offer"] },
  { doc: D("the-deal-room"), routes: ["/offers", "/offers/[id]"] },
  /* ------------------------------------------------------------ people, talk */
  { doc: D("messages-and-notifications"), routes: ["/messages", "/messages/[id]", "/messages/new", "/messages/share/[kind]/[id]", "/support/messages", "/support/messages/[id]", "/support/new", "/agent/messages", "/agent/messages/[id]"] },
  { doc: D("around"), routes: ["/around", "/around/[slug]", "/around/new", "/around/people", "/around/settings", "/post/[id]", "/stories/[id]", "/stories/new"] },
  { doc: D("circle"), routes: ["/circle", "/circle/ask", "/circle/c/[slug]", "/circle/c/[slug]/manage", "/circle/c/[slug]/new", "/circle/new", "/circle/p/[id]"] },
  { doc: D("roommates"), routes: [
    "/roommates", "/roommates/campus", "/roommates/campus/[slug]", "/roommates/discover", "/roommates/groups", "/roommates/groups/[id]",
    "/roommates/groups/new", "/roommates/me", "/roommates/new", "/roommates/nysc", "/roommates/p/[userId]", "/roommates/profile",
    "/roommates/r/[id]", "/roommates/r/[id]/edit", "/roommates/safety", "/roommates/split", "/roommates/verify",
    /* From the other session's Roommates work, merged 10 November 2026. */
    "/roommates/connected/[interestId]", "/roommates/tools/agreement", "/roommates/tools/checklist",
  ] },
  /* ----------------------------------------------------------- supply, hosts */
  { doc: D("for-agents"), routes: ["/for-agents"] },
  { doc: D("for-owners"), routes: ["/for-landlords"] },
  { doc: D("hosting"), routes: ["/for-hosts", "/host", "/host/apply", "/host/start"] },
  { doc: D("host-workspace"), routes: [
    "/host/arrival", "/host/bookings", "/host/calendar", "/host/decide", "/host/earnings", "/host/earnings/statement", "/host/photos",
    "/host/reservations", "/host/reviews", "/host/rooms", "/host/settings", "/host/transfer",
  ] },
  { doc: D("agent-workspace"), routes: [
    "/agent/analytics", "/agent/analytics/[metric]", "/agent/analytics/listings/[listingId]", "/agent/bookings", "/agent/dashboard",
    "/agent/earnings", "/agent/firm", "/agent/inspections", "/agent/list", "/agent/listings", "/agent/listings/[listingId]/arrival",
    "/agent/listings/[listingId]/board", "/agent/listings/[listingId]/calendar", "/agent/listings/[listingId]/health",
    "/agent/listings/[listingId]/mandate", "/agent/listings/[listingId]/promotion", "/agent/listings/[listingId]/sharing",
    "/agent/listings/[listingId]/status", "/agent/portfolio", "/agent/promotion", "/agent/reviews", "/agent/settings",
  ] },
  /* --------------------------------------------------------------- known gaps */
  { gap: "Crypto payment pages exist for notification deep links; no member flow in the docs offers it. Not documented until the founder says whether it is offered.", routes: ["/pay/crypto/[reference]"] },
  { gap: "Review call invitations for the person a case is about; needs a short section in Trust and safety.", routes: ["/calls/reviews", "/calls/reviews/[id]"] },
  /* ------------------------------------------------------------ staff manual */
  { doc: M("desks-and-access"), routes: ["/admin", "/admin/handbook", "/admin/handbook/position", "/admin/handbook/manual", "/admin/handbook/manual/[slug]", "/admin/lookup", "/admin/staff", "/admin/audit", "/admin/oversight", "/admin/queue", "/admin/overview", "/admin/my-desk", "/admin/my-desk/announcements", "/admin/my-desk/tasks", "/admin/my-desk/weekly", "/admin/reports/weekly", "/admin/business-development", "/admin/marketing", "/admin/social-media", "/admin/content", "/admin/technical"] },
  { doc: M("identity-and-applications"), routes: ["/admin/kyc", "/admin/kyc/guide", "/admin/agents", "/admin/businesses", "/admin/review-calls", "/admin/review-calls/[id]", "/admin/account-recovery"] },
  { doc: M("listings-and-supply"), routes: ["/admin/listings", "/admin/listings/[id]", "/admin/examples", "/admin/supply", "/admin/people", "/admin/people/[id]", "/admin/stops", "/admin/reference"] },
  { doc: M("agreements-and-bookings"), routes: ["/admin/agreements", "/admin/agreements/settings", "/admin/bookings", "/admin/bookings/[bookingId]", "/admin/bookings/reservations", "/admin/bookings/visits"] },
  { doc: M("money-and-fees"), routes: ["/admin/money", "/admin/payments", "/admin/chargebacks", "/admin/chargebacks/[chargebackId]", "/admin/fees", "/admin/restaurant-fees", "/admin/referrals", "/admin/arrangements"] },
  { doc: M("cases-and-safety"), routes: ["/admin/trust", "/admin/cases", "/admin/cases/[id]", "/admin/alerts", "/admin/appeals", "/admin/standing", "/admin/weight-withheld", "/admin/blocked-terms", "/admin/circle", "/admin/social", "/admin/roommates", "/admin/account-deletions"] },
  { doc: M("support-desk"), routes: ["/admin/support", "/admin/support-lead", "/admin/doc-feedback"] },
  { doc: M("offers-and-deals-desk"), routes: ["/admin/offers", "/admin/offers/[id]"] },
  { doc: M("operations-and-tools"), routes: ["/admin/operations", "/admin/operations/providers", "/admin/crashes", "/admin/field-speed", "/admin/call-usage", "/admin/analytics", "/admin/front-door", "/admin/retention", "/admin/compliance", "/admin/switches", "/admin/settings", "/admin/copilot"] },
];

/**
 * Pages the page ledger still lists that are no longer in the app (removed or
 * renamed since the ledger was generated). They need no documentation; the
 * ledger rows are stale and the lead can drop them. Listed so the ledger check
 * stays exact instead of being loosened.
 */
export const RETIRED_IN_LEDGER: readonly string[] = ["/around/manage", "/profile/setup/firm", "/sign-up/phone"];

/** The most known gaps allowed. Lower this as gaps close; never raise it without a line in DOCS_COVERAGE.md. */
export const MAX_KNOWN_GAPS = 3;

/** Every route the manifest names, flattened. */
export function manifestRoutes(): string[] {
  return COVERAGE.flatMap((group) => [...group.routes]);
}

/** Routes in `routes` that no group names. This is the check the test runs. */
export function findUncovered(routes: readonly string[]): string[] {
  const named = new Set(manifestRoutes());
  return routes.filter((route) => !named.has(route));
}

/** Routes the manifest names that are not in `routes`: a stale line. */
export function findStale(routes: readonly string[]): string[] {
  const real = new Set(routes);
  return manifestRoutes().filter((route) => !real.has(route));
}

/** Does an href (with or without a query or hash) land on one of `routes`? Dynamic segments match anything. */
export function hrefResolves(href: string, routes: readonly string[]): boolean {
  const path = (href.split("#")[0] ?? "").split("?")[0] ?? "";
  const segs = path.split("/").filter(Boolean);
  return routes.some((route) => {
    const r = route.split("/").filter(Boolean);
    return r.length === segs.length && r.every((part, i) => (part.startsWith("[") && part.endsWith("]") ? (segs[i] ?? "").length > 0 : part === segs[i]));
  });
}
