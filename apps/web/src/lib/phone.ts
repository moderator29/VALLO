/**
 * Nigerian mobile numbers: one canonical form, one set of ranges, one place.
 *
 * Client-safe on purpose. This module is imported by a form component AND by
 * server-side validation, and a second copy of any of it would drift: the
 * booking schema and the agent application already disagreed, one accepting
 * `0` followed by ten digits regardless of what those digits were, the other
 * insisting the national number begin 7, 8 or 9. The same number was valid on
 * one screen and refused on the other.
 *
 * SHAPE. Every Nigerian mobile is ten digits after the country code and begins
 * 7, 8 or 9. That is the structural rule and it is the only thing that ever
 * REFUSES a number here.
 *
 * CARRIER. The three digits after that identify the network, from the NCC's
 * allocations. Knowing it is worth real money to a guest: a host reading
 * "MTN" beside a number can tell at a glance that the digits are plausible,
 * and somebody who typed 0813 when they meant 0803 sees the network change
 * under their thumb.
 *
 * AN UNKNOWN PREFIX IS NOT AN INVALID NUMBER, and this is the important
 * decision in this file. The NCC issues new ranges, and a shipped allow-list
 * is a dated document: hard-refusing anything outside it would reject the very
 * first customer on a range issued next year, on a booking form, with no way
 * for them to argue. So an unrecognised prefix is reported as unrecognised,
 * the number is still accepted, and the person is told plainly which of the
 * two situations they are in. Refusing a real number is a much more expensive
 * mistake than accepting a wrong one, because the wrong one is caught the
 * first time somebody rings it and the real one is a lost booking.
 */

import { formatInternational, isCountryCode, readInternational } from "./phone-intl";

export type Carrier =
  | "MTN"
  | "Glo"
  | "Airtel"
  | "9mobile"
  | "Smile"
  | "ntel";

/**
 * NCC mobile allocations, keyed by the first three digits of the NATIONAL
 * number (the number without its leading zero), so 0803 is `803`.
 */
const CARRIER_PREFIXES: Record<Carrier, readonly string[]> = {
  MTN: ["703", "704", "706", "803", "806", "810", "813", "814", "816", "903", "906", "913", "916"],
  Glo: ["705", "805", "807", "811", "815", "905", "915"],
  Airtel: ["701", "708", "802", "808", "812", "901", "902", "904", "907", "911", "912"],
  "9mobile": ["809", "817", "818", "908", "909"],
  Smile: ["702"],
  ntel: ["804"],
};

const PREFIX_TO_CARRIER: ReadonlyMap<string, Carrier> = new Map(
  (Object.entries(CARRIER_PREFIXES) as [Carrier, readonly string[]][]).flatMap(
    ([carrier, prefixes]) => prefixes.map((prefix) => [prefix, carrier] as const),
  ),
);

/** Just the digits, with any leading `+` remembered separately. */
function digitsOf(raw: string): { digits: string; plus: boolean } {
  const trimmed = raw.trim();
  return { digits: trimmed.replace(/\D/g, ""), plus: trimmed.startsWith("+") };
}

/**
 * The ten national digits behind whatever somebody typed, or null.
 *
 * People write their number six ways and every one of them is correct to the
 * person writing it: 0803 123 4567, 08031234567, +234 803 123 4567, 234 803
 * 123 4567, and the same again with dashes or brackets.
 */
/**
 * The national digits with the country code and trunk zero taken off.
 * UX-12: "+234 (0) 803 …" and "+2340803…" carry both, and read as
 * "080 312 3456" when only the country code came off.
 */
function withoutTrunkPrefix(digits: string): string {
  let national = digits.startsWith("234") ? digits.slice(3) : digits;
  if (national.startsWith("0")) national = national.slice(1);
  return national;
}

export function nationalDigits(raw: string): string | null {
  const { digits } = digitsOf(raw);
  if (digits.length === 0) return null;

  let national = digits;
  national = withoutTrunkPrefix(national);

  return /^[7-9]\d{9}$/.test(national) ? national : null;
}

/**
 * A Nigerian mobile number in one canonical form, or null when it is not one.
 *
 * E.164. This is what is stored and what a database check constraint enforces,
 * so a host reading two bookings sees the same number written the same way.
 */
export function normalisePhone(raw: string, country?: string | null): string | null {
  /* EVERY COUNTRY (2 November 2026). A number written with a plus that is not
     +234, or one typed with another country chosen beside it, is read by the
     international rules (`phone-intl.ts`, mobile ranges only). Everything else
     is the Nigerian reading below, unchanged, so a Nigerian number written any
     of its six ways still becomes `+234...`. */
  const intl = foreignReading(raw, country);
  if (intl !== undefined) return intl;
  const national = nationalDigits(raw);
  return national === null ? null : `+234${national}`;
}

/**
 * The international reading when the number is not Nigerian: an E.164 string,
 * null when it is not a mobile number, or `undefined` when the Nigerian rules
 * should read it instead.
 */
function foreignReading(raw: string, country?: string | null): string | null | undefined {
  const trimmed = raw.trim();
  const plus = trimmed.startsWith("+") || trimmed.startsWith("00");
  const digits = trimmed.replace(/\D/g, "");
  const chosen = country && isCountryCode(country) && country !== "NG" ? country : null;
  if (plus) {
    const international = trimmed.startsWith("00") ? `+${digits.slice(2)}` : trimmed;
    if (international.replace(/\D/g, "").startsWith("234")) return undefined;
    const reading = readInternational(international);
    return reading.state === "valid" ? reading.e164 : null;
  }
  if (!chosen) return undefined;
  const reading = readInternational(trimmed, chosen);
  return reading.state === "valid" ? reading.e164 : null;
}

/** Which network, or null when the range is not one we know of. */
export function carrierOf(raw: string): Carrier | null {
  const national = nationalDigits(raw);
  if (national === null) return null;
  return PREFIX_TO_CARRIER.get(national.slice(0, 3)) ?? null;
}

/**
 * What to tell somebody about what they have typed so far.
 *
 * Deliberately tri-state rather than a boolean. "Not a valid number" and "a
 * valid number on a range we do not recognise" are different situations and
 * flattening them into one is what produces either a false refusal or a
 * silently wrong number.
 */
export type PhoneReading =
  | { state: "empty" }
  | { state: "incomplete"; digits: number }
  | { state: "invalid"; reason: string }
  | { state: "valid"; e164: string; carrier: Carrier | null };

/** The number of national digits a complete Nigerian mobile has. */
export const NATIONAL_LENGTH = 10;

export function readPhone(raw: string): PhoneReading {
  const { digits } = digitsOf(raw);
  if (digits.length === 0) return { state: "empty" };

  let national = digits;
  national = withoutTrunkPrefix(national);

  if (national.length < NATIONAL_LENGTH) {
    return { state: "incomplete", digits: national.length };
  }
  if (national.length > NATIONAL_LENGTH) {
    return {
      state: "invalid",
      reason: "That is too long for a Nigerian mobile number. Check the digits and try again.",
    };
  }
  if (!/^[7-9]/.test(national)) {
    return {
      state: "invalid",
      reason: "A Nigerian mobile number starts 070, 080, 081, 090 or 091. Check the first digits.",
    };
  }
  return { state: "valid", e164: `+234${national}`, carrier: carrierOf(national) };
}

/**
 * The mask: national digits grouped the way Nigerians write them, `803 123
 * 4567`, with no country code because the field states `+234` beside it.
 *
 * Grouping as somebody types is not decoration. Eleven unbroken digits cannot
 * be checked by eye, and the single most common way a booking reaches a host
 * with an unreachable number is a transposed pair nobody could see.
 */
export function maskNational(raw: string): string {
  const { digits } = digitsOf(raw);
  let national = digits;
  national = withoutTrunkPrefix(national);
  national = national.slice(0, NATIONAL_LENGTH);

  const parts = [national.slice(0, 3), national.slice(3, 6), national.slice(6, 10)];
  return parts.filter((part) => part.length > 0).join(" ");
}

/** `+234 803 123 4567`, for reading back a stored number. */
export function formatPhone(raw: string): string {
  if (/^\+(?!234)\d{7,15}$/.test(raw.trim())) return formatInternational(raw.trim());
  const national = nationalDigits(raw);
  if (national === null) return raw;
  return `+234 ${maskNational(national)}`;
}
