/**
 * PRO AND BUSINESS ARE NOT OFFERED (5 November 2026).
 *
 * App Review rejected build 10000126 under guideline 3.1.1: the app reached
 * Vallo Pro and Vallo Business, paid subscriptions bought outside the app,
 * with no In-App Purchase to buy them. Until the plans are either sold through
 * In-App Purchase or taken out of the iOS app on purpose, nothing in the
 * product shows, sells or starts a plan: no page, no menu row, no trial, no
 * checkout. Everything behind this stays in the code and the database, and
 * turning this to `true` brings all of it back in one change.
 */
export const SUBSCRIPTIONS_OPEN = false;
