import { finding, type Finding } from "./signals";

/**
 * THE MACHINE-READABLE ZONE OF A PASSPORT (ICAO Doc 9303, part 4).
 *
 * The two lines of capitals, digits and chevrons along the bottom of a
 * passport's photo page, 44 characters each. They repeat what is printed above
 * them (name, passport number, nationality, date of birth, sex, expiry), and
 * five of the characters are CHECK DIGITS: each is worked out from the
 * characters before it. Somebody who edits the date of birth or the number on
 * a photo of a passport has to recompute those digits, and very often does
 * not, so a zone whose digits do not add up is one of the cheapest and best
 * signs that a page was edited.
 *
 *   line 1   P  type  issuing state (3)  SURNAME<<GIVEN<NAMES<<<...
 *   line 2   number (9) + digit   nationality (3)   birth YYMMDD + digit
 *            sex   expiry YYMMDD + digit   optional data (14) + digit
 *            one last digit over the whole of line 2's data
 *
 * THE DIGIT. Each character has a value (0 to 9 as they are, A to Z as 10 to
 * 35, the chevron as 0); the values are multiplied by 7, 3, 1, 7, 3, 1 and so
 * on; the last figure of the total is the check digit.
 *
 * WHAT A PASS MEANS. The zone is consistent with itself. A careful forger can
 * compute the digits too, so a pass is never proof; a fail on lines typed
 * correctly is a strong reason to stop.
 *
 * PURE: no I/O and no logging. It runs in the reviewer's browser, and what is
 * typed into it is sent nowhere and kept nowhere.
 */

export const MRZ_LINE_LENGTH = 44;

const WEIGHTS = [7, 3, 1] as const;

function charValue(char: string): number {
  if (char === "<") return 0;
  const code = char.charCodeAt(0);
  if (code >= 48 && code <= 57) return code - 48;
  if (code >= 65 && code <= 90) return code - 55;
  return Number.NaN;
}

/** The ICAO 9303 check digit of a run of zone characters, or null when a character is not allowed. */
export function mrzCheckDigit(data: string): number | null {
  let total = 0;
  for (let i = 0; i < data.length; i += 1) {
    const value = charValue(data[i]!);
    if (Number.isNaN(value)) return null;
    total += value * WEIGHTS[i % 3]!;
  }
  return total % 10;
}

/**
 * What a person types, made into zone characters: capitals, no spaces, and
 * the marks people use for a chevron turned into one.
 */
export function normaliseMrzLine(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[«‹〈⟨»›]/g, "<")
    .replace(/\s+/g, "");
}

export type MrzCheckKey = "document_number" | "date_of_birth" | "expiry" | "optional_data" | "composite";

export type MrzCheck = {
  key: MrzCheckKey;
  /** What the digit covers, in plain words. */
  label: string;
  /** The digit the characters work out to. */
  expected: string;
  /** The digit that is in the zone. */
  found: string;
  pass: boolean;
};

export type MrzDate = {
  /** The six characters as they stand in the zone. */
  raw: string;
  /** The date as YYYY-MM-DD, or null when the six characters are not a real date. */
  iso: string | null;
};

export type MrzFields = {
  /** "P" for a passport, with its second character when one is used. */
  documentType: string;
  issuingState: string;
  surname: string;
  givenNames: string;
  /** True when the name fills its whole space, so the end of it may be cut off. */
  nameTruncated: boolean;
  documentNumber: string;
  nationality: string;
  dateOfBirth: MrzDate;
  /** "M", "F", or "X" when the zone leaves it unstated. */
  sex: string;
  expiry: MrzDate;
  optionalData: string;
};

export type MrzResult =
  | {
      /** Still being typed: a line is short or long. Nothing is judged yet. */
      state: "incomplete";
      line1Length: number;
      line2Length: number;
    }
  | {
      /** Both lines are 44 characters and something in them cannot be a passport zone. */
      state: "invalid";
      problems: string[];
    }
  | {
      state: "parsed";
      fields: MrzFields;
      checks: MrzCheck[];
      /** How many of the five digits do not match. */
      failed: number;
      /** Things that are odd without being a failed digit (a date that is not a date). */
      problems: string[];
    };

const ALLOWED = /^[A-Z0-9<]*$/;

function clean(field: string): string {
  return field.replace(/</g, " ").replace(/\s+/g, " ").trim();
}

function isRealDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]!;
  return day <= days;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * A YYMMDD date with its century worked out.
 *
 * A date of birth cannot be in the future, so a two-figure year later than
 * this year belongs to the 1900s. An expiry is always read as 20YY: passports
 * run ten years at most, so this stays right for the rest of the century.
 */
export function mrzDate(raw: string, kind: "birth" | "expiry", now: Date): MrzDate {
  if (!/^\d{6}$/.test(raw)) return { raw, iso: null };
  const yy = Number(raw.slice(0, 2));
  const month = Number(raw.slice(2, 4));
  const day = Number(raw.slice(4, 6));
  let year = 2000 + yy;
  if (kind === "birth") {
    const today = now.toISOString().slice(0, 10);
    if (`${year}-${pad(month)}-${pad(day)}` > today) year -= 100;
  }
  if (!isRealDate(year, month, day)) return { raw, iso: null };
  return { raw, iso: `${year}-${pad(month)}-${pad(day)}` };
}

/**
 * Read the two lines of a passport's zone.
 *
 * `now` only decides the century of the date of birth; pass the current time.
 */
export function parseMrz(rawLine1: string, rawLine2: string, now: Date = new Date()): MrzResult {
  const line1 = normaliseMrzLine(rawLine1);
  const line2 = normaliseMrzLine(rawLine2);
  if (line1.length !== MRZ_LINE_LENGTH || line2.length !== MRZ_LINE_LENGTH) {
    return { state: "incomplete", line1Length: line1.length, line2Length: line2.length };
  }

  const fatal: string[] = [];
  if (!ALLOWED.test(line1)) fatal.push("The first line has a character a passport zone never uses. Only capitals, digits and the chevron belong there.");
  if (!ALLOWED.test(line2)) fatal.push("The second line has a character a passport zone never uses. Only capitals, digits and the chevron belong there.");
  if (line1[0] !== "P") fatal.push("The first line does not start with P, so this is not a passport's zone.");
  if (fatal.length > 0) return { state: "invalid", problems: fatal };

  const nameField = line1.slice(5);
  const [surnamePart = "", ...givenParts] = nameField.split("<<");
  const documentNumber = line2.slice(0, 9);
  const birthRaw = line2.slice(13, 19);
  const expiryRaw = line2.slice(21, 27);
  const optional = line2.slice(28, 42);
  const sexChar = line2[20]!;

  const fields: MrzFields = {
    documentType: clean(line1.slice(0, 2)),
    issuingState: clean(line1.slice(2, 5)),
    surname: clean(surnamePart),
    givenNames: clean(givenParts.join(" ")),
    nameTruncated: !nameField.endsWith("<"),
    documentNumber: clean(documentNumber).replace(/\s+/g, ""),
    nationality: clean(line2.slice(10, 13)),
    dateOfBirth: mrzDate(birthRaw, "birth", now),
    sex: sexChar === "<" ? "X" : sexChar,
    expiry: mrzDate(expiryRaw, "expiry", now),
    optionalData: clean(optional).replace(/\s+/g, ""),
  };

  const digit = (data: string) => String(mrzCheckDigit(data) ?? "?");
  const check = (key: MrzCheckKey, label: string, data: string, found: string): MrzCheck => {
    const expected = digit(data);
    return { key, label, expected, found, pass: expected === found };
  };

  /* The optional data's digit may be left as a chevron when the field is empty. */
  const optionalFound = line2[42]!;
  const optionalCheck = check("optional_data", "Optional data", optional, optionalFound);
  if (optionalFound === "<" && /^<+$/.test(optional)) optionalCheck.pass = true;

  const checks: MrzCheck[] = [
    check("document_number", "Passport number", documentNumber, line2[9]!),
    check("date_of_birth", "Date of birth", birthRaw, line2[19]!),
    check("expiry", "Expiry date", expiryRaw, line2[27]!),
    optionalCheck,
    check("composite", "The whole second line", line2.slice(0, 10) + line2.slice(13, 20) + line2.slice(21, 43), line2[43]!),
  ];

  const problems: string[] = [];
  if (fields.dateOfBirth.iso === null) problems.push("The date of birth in the zone is not a real date.");
  if (fields.expiry.iso === null) problems.push("The expiry date in the zone is not a real date.");
  if (!/^[MFX<]$/.test(sexChar)) problems.push("The sex character in the zone is not M, F or a chevron.");
  if (fields.surname === "") problems.push("The zone carries no surname.");

  return { state: "parsed", fields, checks, failed: checks.filter((item) => !item.pass).length, problems };
}

/** "12 August 1974" from an ISO day, in the reviewer's words. */
export function plainDay(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number) as [number, number, number];
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${day} ${months[month - 1]} ${year}`;
}

/**
 * The zone's own findings: the check digits, and anything in it that cannot
 * be right. Whether the name and dates agree with the account is
 * `consistency.ts`'s question, not this one.
 */
export function mrzFindings(result: MrzResult): Finding[] {
  if (result.state === "incomplete") return [];
  if (result.state === "invalid") {
    return [
      finding(
        "mrz.digits",
        "look",
        "These are not a passport's bottom lines",
        `${result.problems[0]} Type the two lines again exactly as printed.`,
      ),
    ];
  }
  const out: Finding[] = [];
  const total = result.checks.length;
  if (result.failed === 0) {
    out.push(
      finding(
        "mrz.digits",
        "ok",
        `Passport check digits: all ${total} pass`,
        "The bottom lines agree with themselves. A careful forger can work the digits out too, so this is a good sign and not proof.",
      ),
    );
  } else {
    const names = result.checks.filter((item) => !item.pass).map((item) => item.label.toLowerCase());
    out.push(
      finding(
        "mrz.digits",
        "stop",
        `Passport check digits: ${result.failed} of ${total} ${result.failed === 1 ? "fails" : "fail"}`,
        `Not matching: ${names.join(", ")}. Type both lines again with care first. If a digit still fails, the page has very likely been edited: do not approve, and escalate.`,
      ),
    );
  }
  if (result.problems.length > 0) {
    out.push(
      finding(
        "mrz.shape",
        "look",
        "Something in the bottom lines cannot be right",
        `${result.problems.join(" ")} Check your typing against the page, then look closer at the page itself.`,
      ),
    );
  }
  return out;
}
