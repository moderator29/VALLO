import { finding, type Finding } from "./signals";

/**
 * DOES A TYPED ID NUMBER HAVE THE RIGHT SHAPE FOR ITS DOCUMENT? (15 Nov 2026.)
 *
 * Only the shape: how many characters, and which kind. A right shape proves
 * nothing, because anybody can type eleven digits, and the words say so every
 * time. What the shape does catch is a number that could never be real: a NIN
 * with a letter in it, a passport number with nine digits, a voter's number
 * half the usual length. Those are forgeries made by people who never held
 * the real document, or typing slips, and either way the reviewer looks again.
 *
 * There is no free public place to look a NIN or a BVN up, and this module
 * does not pretend to be one: it never says "valid".
 *
 * PURE: no I/O, no logging. The number is never kept. The NIN rule is the one
 * in `lib/identity/nin.ts` (`isNin`); it is repeated here as a pattern so this
 * file can run in the browser, where that module's keyed hashing cannot, and
 * `formats.test.ts` holds the two to the same answer.
 */

export const ID_NUMBER_KINDS = ["nin", "bvn", "passport", "drivers_licence", "voters_card"] as const;
export type IdNumberKind = (typeof ID_NUMBER_KINDS)[number];

export function isIdNumberKind(value: unknown): value is IdNumberKind {
  return typeof value === "string" && (ID_NUMBER_KINDS as readonly string[]).includes(value);
}

export const ID_NUMBER_KIND_LABEL: Record<IdNumberKind, string> = {
  nin: "NIN",
  bvn: "BVN",
  passport: "Nigerian passport number",
  drivers_licence: "Driver's licence number",
  voters_card: "Voter's card number (VIN)",
};

/** What the genuine number looks like, in words a reviewer can hold a card against. */
export const ID_NUMBER_KIND_SHAPE: Record<IdNumberKind, string> = {
  nin: "11 digits, no letters",
  bvn: "11 digits, no letters",
  passport: "one letter followed by 8 digits",
  drivers_licence: "letters and digits together, 10 to 13 characters",
  voters_card: "letters and digits, usually 19 characters",
};

/** The number kind a document subtype carries, or null when we know no shape for it. */
export function idNumberKindFor(subtype: string | null | undefined, issuingCountry?: string | null): IdNumberKind | null {
  /* The shapes here are Nigeria's. Another country's document has its own. */
  if (issuingCountry && issuingCountry.toUpperCase() !== "NG") return null;
  if (subtype === "nin_card") return "nin";
  if (subtype === "passport") return "passport";
  if (subtype === "drivers_licence") return "drivers_licence";
  if (subtype === "voters_card") return "voters_card";
  return null;
}

/** Spaces, hyphens, dots and slashes out; letters to capitals. */
export function normaliseIdNumber(raw: string): string {
  return raw.replace(/[\s./-]+/g, "").toUpperCase();
}

export type IdNumberShape = {
  kind: IdNumberKind;
  /** The number with separators removed, as it would be compared. */
  normalised: string;
  /** `empty` when nothing was typed; otherwise whether the shape fits. */
  shape: "right" | "unusual" | "empty";
  /** Why, in a few plain words. Never repeats the number. */
  reason: string;
};

const ELEVEN_DIGITS = /^\d{11}$/;

function oneDigitRepeated(value: string): boolean {
  return /^(\d)\1+$/.test(value);
}

function digitsRule(value: string, name: string): { ok: boolean; reason: string } {
  if (/[^0-9]/.test(value)) return { ok: false, reason: `a ${name} is digits only, and this has other characters` };
  if (value.length !== 11) return { ok: false, reason: `a ${name} is 11 digits, and this has ${value.length}` };
  if (oneDigitRepeated(value)) return { ok: false, reason: "it is one digit repeated eleven times" };
  return { ok: ELEVEN_DIGITS.test(value), reason: "11 digits" };
}

function rule(kind: IdNumberKind, value: string): { ok: boolean; reason: string } {
  if (kind === "nin") return digitsRule(value, "NIN");
  if (kind === "bvn") return digitsRule(value, "BVN");
  if (kind === "passport") {
    if (/^[A-Z]\d{8}$/.test(value)) return { ok: true, reason: "one letter followed by 8 digits" };
    if (value.length !== 9) return { ok: false, reason: `a Nigerian passport number is 9 characters, and this has ${value.length}` };
    return { ok: false, reason: "a Nigerian passport number is one letter followed by 8 digits" };
  }
  if (/[^A-Z0-9]/.test(value)) return { ok: false, reason: "it has characters that are not letters or digits" };
  if (kind === "drivers_licence") {
    if (value.length < 10 || value.length > 13) return { ok: false, reason: `it has ${value.length} characters, where 10 to 13 is usual` };
    if (!/[A-Z]/.test(value) || !/\d/.test(value)) return { ok: false, reason: "a licence number mixes letters and digits, and this has only one kind" };
    return { ok: true, reason: "letters and digits together, of the usual length" };
  }
  /* voters_card */
  if (value.length !== 19) return { ok: false, reason: `it has ${value.length} characters, where 19 is usual` };
  if (!/\d/.test(value)) return { ok: false, reason: "a voter's number carries digits, and this has none" };
  return { ok: true, reason: "letters and digits, of the usual length" };
}

/** The shape of a typed number for one kind of document. */
export function idNumberShape(kind: IdNumberKind, raw: string): IdNumberShape {
  const normalised = normaliseIdNumber(raw);
  if (normalised === "") return { kind, normalised, shape: "empty", reason: "nothing typed" };
  const verdict = rule(kind, normalised);
  return { kind, normalised, shape: verdict.ok ? "right" : "unusual", reason: verdict.reason };
}

/** The same answer as a finding for the panel, or null when nothing was typed. */
export function idNumberShapeFinding(kind: IdNumberKind, raw: string): Finding | null {
  const result = idNumberShape(kind, raw);
  if (result.shape === "empty") return null;
  const name = ID_NUMBER_KIND_LABEL[kind];
  if (result.shape === "right") {
    return finding(
      "id_number.shape",
      "ok",
      `${name}: the shape looks right`,
      `It is ${result.reason}. A right shape proves nothing: anybody can type a number of the right length.`,
    );
  }
  return finding(
    "id_number.shape",
    "look",
    `${name}: the shape is unusual`,
    `The genuine number is ${ID_NUMBER_KIND_SHAPE[kind]}; here ${result.reason}. Read the document again and retype it before you decide.`,
  );
}
