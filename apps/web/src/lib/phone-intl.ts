import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  AsYouType,
  type CountryCode,
} from "libphonenumber-js/mobile";

/**
 * MOBILE NUMBERS FROM ANY COUNTRY (2 November 2026).
 *
 * `lib/phone.ts` knows one country: it accepts a Nigerian mobile and nothing
 * else, which is right for the places that really are Nigerian (a booking's
 * contact, an agent's line, the wallet). A code to confirm a phone is not one
 * of those: Nigerians abroad are a large part of the platform and a UK number
 * was impossible to type. This module is the international half, built on
 * `libphonenumber-js` (Google's number rules, mobile ranges only).
 *
 * Client-safe: no I/O.
 *
 * THE RULES, IN ONE PLACE
 *  - A number typed with a `+` is read on its own, whatever country is chosen.
 *  - A number without one is read in the chosen country (a leading trunk zero
 *    is dropped for you, as people write it at home).
 *  - Only a number in a mobile range is valid (the library's mobile metadata),
 *    so a landline, which cannot receive an SMS, reads as invalid.
 *  - Nigeria is not special-cased here. `lib/phone.ts` stays the home of the
 *    Nigerian carrier names and the NCC prefixes, and the send path asks it
 *    first for a Nigerian number so its rules and tests are unchanged.
 */

export type IntlReading =
  | { state: "empty" }
  | { state: "incomplete" }
  | { state: "invalid" }
  | { state: "valid"; e164: string; country: CountryCode | null; national: string };

/** Countries listed first: where Vallo's members and diaspora are. */
export const PRIORITY_COUNTRIES: readonly CountryCode[] = ["NG", "GB", "US", "CA", "IE", "DE", "FR", "NL", "AE", "ZA", "GH", "KE"];

export const DEFAULT_COUNTRY: CountryCode = "NG";

export function allCountries(): CountryCode[] {
  const rest = getCountries().filter((c) => !PRIORITY_COUNTRIES.includes(c));
  return [...PRIORITY_COUNTRIES, ...rest];
}

export function isCountryCode(value: unknown): value is CountryCode {
  return typeof value === "string" && (getCountries() as string[]).includes(value);
}

export function callingCode(country: CountryCode): string {
  return getCountryCallingCode(country);
}

/** The flag of a country, from its two letters (no image to load). */
export function flagOf(country: CountryCode): string {
  return String.fromCodePoint(...[...country].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

/** The country a browser language hints at ("en-GB" is GB), or null. */
export function guessCountry(language: string | undefined): CountryCode | null {
  const region = (language ?? "").split("-")[1]?.toUpperCase();
  return region && isCountryCode(region) ? region : null;
}

function digitsOnly(raw: string): string {
  return raw.replace(/\D/g, "");
}

export function readInternational(raw: string, country: CountryCode = DEFAULT_COUNTRY): IntlReading {
  const text = raw.trim();
  if (digitsOnly(text).length === 0) return { state: "empty" };

  const parsed = parsePhoneNumberFromString(text.startsWith("+") ? text : text, text.startsWith("+") ? undefined : country);
  if (!parsed) return digitsOnly(text).length < 6 ? { state: "incomplete" } : { state: "invalid" };
  if (!parsed.isPossible()) {
    /* Not long enough yet (or too long): tell the two apart for the person typing. */
    return digitsOnly(parsed.nationalNumber).length < 6 ? { state: "incomplete" } : { state: "invalid" };
  }
  if (!parsed.isValid()) return { state: "invalid" };
  return {
    state: "valid",
    e164: parsed.number,
    country: parsed.country ?? null,
    national: parsed.formatNational(),
  };
}

/** `+44 7911 123456`, for reading back a stored number; the input itself when it is not one. */
export function formatInternational(e164: string): string {
  const parsed = parsePhoneNumberFromString(e164);
  return parsed ? parsed.formatInternational() : e164;
}

/** Grouping as somebody types in a chosen country (`07911 123456`). */
export function maskInternational(raw: string, country: CountryCode): string {
  return new AsYouType(raw.trim().startsWith("+") ? undefined : country).input(raw);
}

/** Is this E.164 number Nigerian? The send path routes those through Termii. */
export function isNigerian(e164: string): boolean {
  return e164.startsWith("+234");
}
