import type { Dictionary } from "@vallo/i18n/core";

/**
 * THE WORDS A ROUTE HANDS ITS CLIENT ISLANDS (Session 3, W13).
 *
 * A `"use client"` component that called `getDictionary(locale)` shipped the
 * whole `@vallo/i18n` index in its route's first load: 1,351,758 bytes raw,
 * 398,654 gzipped, measured on the production build, on every money route
 * (checkout, rent pay, the payment methods, the money lock), the host wizard,
 * the agent's bookings and the support pages. The words those components use
 * are a few small namespaces (checkout is 2.8KB gzipped, success 1.9KB).
 *
 * So the server page, which already holds the dictionary, picks the slices
 * its islands need with `copyScopeOf(t, [...])` and renders them inside
 * `<CopyScope>` (`copy-scope.tsx`); the islands read `useScopedCopy(key)`.
 * Only the picked words cross into the page, and the bundle carries none.
 *
 * Type-only import of the dictionary shape, so this module is safe on both
 * sides and costs the client nothing.
 */
export type ScopedCopy = {
  checkout: Dictionary["checkout"];
  success: Dictionary["success"];
  cryptoPay: Dictionary["cryptoPay"];
  moneyLock: Dictionary["platform"]["moneyLock"];
  myReports: Dictionary["platform"]["myReports"];
  hostWorkspace: Dictionary["hostWorkspace"];
  featuresWizard: Dictionary["experienceFeatures"]["wizard"];
  /** The host pages' own words (C5), for the host workspace's client islands. */
  experienceHost: Dictionary["experienceHost"];
  /** Vallo Roommates, for its client islands. */
  roommates: Dictionary["roommates"];
};

export type ScopeKey = keyof ScopedCopy;

const READ: { [K in ScopeKey]: (t: Dictionary) => ScopedCopy[K] } = {
  checkout: (t) => t.checkout,
  success: (t) => t.success,
  cryptoPay: (t) => t.cryptoPay,
  moneyLock: (t) => t.platform.moneyLock,
  myReports: (t) => t.platform.myReports,
  hostWorkspace: (t) => t.hostWorkspace,
  featuresWizard: (t) => t.experienceFeatures.wizard,
  experienceHost: (t) => t.experienceHost,
  roommates: (t) => t.roommates,
};

export const ALL_SCOPE_KEYS = Object.keys(READ) as ScopeKey[];

/** The slices named, from a dictionary the server already resolved. */
export function copyScopeOf<K extends ScopeKey>(t: Dictionary, keys: readonly K[]): Pick<ScopedCopy, K> {
  const out = {} as Pick<ScopedCopy, K>;
  for (const key of keys) out[key] = READ[key](t) as Pick<ScopedCopy, K>[K];
  return out;
}
