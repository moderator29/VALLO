import type { StorageCategory } from "./inventory";

/**
 * THE COOKIE CHOICE (founder, 10 November 2026): what a person agreed to, in
 * one first-party cookie with a version.
 *
 *   vallo_consent = <version>.<preferences><analytics>     e.g. "1.10"
 *
 * Necessary storage is always on and is not in the cookie. A missing,
 * malformed or older-version cookie means NO CHOICE YET: preferences and
 * analytics stay off and the notice is shown. Bump `CONSENT_VERSION` when the
 * categories or what they cover change in a way that matters, and everyone is
 * asked again (as `TERMS_VERSION` does for the Terms).
 *
 * NOTHING NON-ESSENTIAL IS WRITTEN BEFORE CONSENT. Every writer of a
 * preferences or analytics item asks `consentAllows` first; `inventory.test.ts`
 * holds the list of writers. Withdrawing a category clears the items it names.
 *
 * Pure parts are client-safe and server-safe; the `document` parts guard.
 */

export const CONSENT_COOKIE = "vallo_consent";
export const CONSENT_VERSION = 1;
/** Twelve months: the notice is shown again after a year. */
export const CONSENT_MAX_AGE_S = 60 * 60 * 24 * 365;
/** Fired on `window` when a choice is saved; `detail` is the `Consent`. */
export const CONSENT_EVENT = "vallo:consent";
/** Fired on `window` to open the settings sheet. */
export const CONSENT_OPEN_EVENT = "vallo:cookie-settings";

export type Consent = { version: number; preferences: boolean; analytics: boolean };

export const NO_CONSENT: Consent = { version: CONSENT_VERSION, preferences: false, analytics: false };

/** The value to store. */
export function serialiseConsent(consent: Pick<Consent, "preferences" | "analytics">): string {
  return `${CONSENT_VERSION}.${consent.preferences ? "1" : "0"}${consent.analytics ? "1" : "0"}`;
}

/** The choice in a cookie value, or null when there is none for THIS version. */
export function parseConsent(value: string | null | undefined): Consent | null {
  if (!value) return null;
  const match = /^(\d{1,3})\.([01])([01])$/.exec(value);
  if (!match) return null;
  if (Number(match[1]) !== CONSENT_VERSION) return null;
  return { version: CONSENT_VERSION, preferences: match[2] === "1", analytics: match[3] === "1" };
}

/** The cookie string for `document.cookie`. */
export function consentCookieString(consent: Pick<Consent, "preferences" | "analytics">, secure: boolean): string {
  return `${CONSENT_COOKIE}=${serialiseConsent(consent)}; path=/; max-age=${CONSENT_MAX_AGE_S}; samesite=lax${secure ? "; secure" : ""}`;
}

/** The choice from a `Cookie` header or `document.cookie` string. */
export function consentFromCookieHeader(header: string | null | undefined): Consent | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(`${CONSENT_COOKIE}=`)) return parseConsent(trimmed.slice(CONSENT_COOKIE.length + 1));
  }
  return null;
}

/** The saved choice in this browser, or null (none yet, older version, or no document). */
export function readConsent(): Consent | null {
  if (typeof document === "undefined") return null;
  try {
    return consentFromCookieHeader(document.cookie);
  } catch {
    return null;
  }
}

/** May Vallo write storage of this kind right now? Necessary always; the rest only after a yes. */
export function consentAllows(category: StorageCategory): boolean {
  if (category === "necessary") return true;
  const saved = readConsent();
  return saved ? saved[category] : false;
}
