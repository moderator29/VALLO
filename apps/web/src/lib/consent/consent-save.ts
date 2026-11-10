import { CONSENT_EVENT, CONSENT_VERSION, consentCookieString, type Consent } from "./consent";
import { STORAGE_INVENTORY, nameMatches, type StorageCategory } from "./inventory";

/**
 * SAVING A COOKIE CHOICE, AND CLEARING WHAT A WITHDRAWN CHOICE HAD STORED.
 * Kept apart from `consent.ts` because it reads the whole inventory, and
 * `consent.ts` is imported by small client code on the front-door routes
 * (the writers ask `consentAllows`); only the choice sheet, which loads
 * lazily, needs this.
 */

/** Remove what a withdrawn category had stored. Never touches necessary items. */
export function clearCategory(category: Exclude<StorageCategory, "necessary">): void {
  if (typeof document === "undefined") return;
  for (const item of STORAGE_INVENTORY) {
    if (item.category !== category || item.name.endsWith("*")) continue;
    try {
      if (item.kind === "cookie") {
        document.cookie = `${item.name}=; path=/; max-age=0; samesite=lax`;
      } else if (item.kind === "localStorage") {
        window.localStorage.removeItem(item.name);
      } else if (item.kind === "sessionStorage") {
        window.sessionStorage.removeItem(item.name);
      }
    } catch {
      /* Storage can be refused; there is then nothing to clear. */
    }
  }
}

/** Save a choice: write the cookie, clear what was switched off, tell the page. */
export function saveConsent(choice: Pick<Consent, "preferences" | "analytics">): Consent {
  const consent: Consent = { version: CONSENT_VERSION, preferences: choice.preferences, analytics: choice.analytics };
  if (typeof document === "undefined") return consent;
  try {
    document.cookie = consentCookieString(consent, window.location.protocol === "https:");
  } catch {
    /* Cookies refused: the choice cannot be kept, and nothing non-essential is written either. */
  }
  if (!consent.preferences) clearCategory("preferences");
  if (!consent.analytics) clearCategory("analytics");
  try {
    window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: consent }));
  } catch {
    /* Old WebViews without CustomEvent: nothing was listening that mattered. */
  }
  return consent;
}

/** Which inventory item does a stored name belong to? Used by the drift test. */
export function inventoryCovers(name: string): boolean {
  return STORAGE_INVENTORY.some((item) => nameMatches(item, name));
}
