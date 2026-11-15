/**
 * THE TWO STORE LISTINGS, READ FROM THEIR OWN ADDRESSES (the founder, 15
 * November 2026, when both apps went live in every country).
 *
 * The two store URLs are set once, in the deploy settings
 * (`NEXT_PUBLIC_APP_STORE_URL`, `NEXT_PUBLIC_PLAY_STORE_URL`), and everything
 * the platform says about the apps is derived from them here: the badges on
 * the website (`components/site/landing/store-badges.ts`), the banner iOS
 * Safari draws above the page, and the related application the web manifest
 * names to Chrome. Nothing types an app id or a package name a second time,
 * so there is one place to change and nothing can drift.
 *
 * THE APPLE URL MUST CARRY NO COUNTRY. `apps.apple.com/ng/app/...` pins every
 * reader to the Nigerian store, so somebody in London is sent to a store they
 * cannot buy from. The country segment is optional and Apple sends each
 * reader to their own store without it, which is why `appStoreId` reads the
 * id wherever it sits and the documented value carries no country.
 *
 * Pure and client-safe: no reads, no I/O, no copy.
 */

/** The numeric id in an App Store address, or null when it is not one. */
export function appStoreId(url: string | undefined | null): string | null {
  const text = (url ?? "").trim();
  if (!/^https:\/\/apps\.apple\.com\//.test(text)) return null;
  /* `/id6818483899`, with or without a country and with or without a name. */
  const found = /\/id(\d{4,12})(?:[/?#]|$)/.exec(text);
  return found ? found[1]! : null;
}

/** The Android package in a Play address, or null when it is not one. */
export function playPackageId(url: string | undefined | null): string | null {
  const text = (url ?? "").trim();
  if (!/^https:\/\/play\.google\.com\/store\/apps\/details\?/.test(text)) return null;
  const found = /[?&]id=([A-Za-z0-9_.]{3,120})(?:&|$)/.exec(text);
  return found ? found[1]! : null;
}

/**
 * THE BANNER iOS SAFARI DRAWS ABOVE THE PAGE (Apple's Smart App Banner): the
 * app's icon, its name, and a Get or Open button, in Safari's own chrome
 * rather than ours. It is one meta tag and Apple draws the rest from the
 * listing, so the price, the "In-App Purchases" line and the icon are always
 * what the store says today and can never be a stale copy of it.
 *
 * It appears only in Safari on iOS. The native shell runs a web view, which
 * does not draw it, so somebody already inside the app is never shown a
 * banner offering them the app they are holding.
 *
 * Null when no App Store address is set, so the tag is absent rather than
 * pointing at a listing that is not there.
 */
export function smartBannerContent(appStoreUrl: string | undefined | null): string | null {
  const id = appStoreId(appStoreUrl);
  return id ? `app-id=${id}` : null;
}

/** What the web manifest tells Chrome about the real Android app. */
export type RelatedApplication = { platform: "play"; id: string; url: string };

export function relatedApplications(playStoreUrl: string | undefined | null): RelatedApplication[] {
  const id = playPackageId(playStoreUrl);
  return id ? [{ platform: "play", id, url: (playStoreUrl ?? "").trim() }] : [];
}

/**
 * WHETHER CHROME SHOULD OFFER THE REAL APP INSTEAD OF INSTALLING THE PAGE.
 *
 * True only once the Play listing is set. The native app does what an
 * installed page cannot (notifications that arrive when it is closed, the
 * share sheet, the camera for a selfie check), so where it exists it is the
 * better offer. Until the listing is set this stays false and the installable
 * page works exactly as it did, which is what a deployment with no store
 * address should do.
 */
export function prefersNativeApp(playStoreUrl: string | undefined | null): boolean {
  return playPackageId(playStoreUrl) !== null;
}
