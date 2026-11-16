/**
 * VALLO INTELLIGENCE: THE WORDS, CLEANED.
 *
 * Every entry point (suggest, search, the event beacon, the recent-search
 * store) reads the typed words through `cleanQuery`, so a control character,
 * a zero-width joiner or a 4,000 character paste never reaches a parser, a
 * database or a model. Pure, no imports: the client may use it too.
 */

/** The longest query any route accepts, after cleaning. */
export const MAX_QUERY_LENGTH = 120;

/* Control and format characters (zero-width joiners, bidi overrides, NUL...). */
const CONTROL = /[\p{Cc}\p{Cf}\p{Co}\p{Cn}]/gu;

/**
 * The words as a person meant them: compatibility-normalised (full-width
 * letters fold), control characters out, runs of space collapsed, trimmed and
 * capped. Never throws; anything that is not a string is the empty query.
 */
export function cleanQuery(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw
    .normalize("NFKC")
    .replace(CONTROL, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_QUERY_LENGTH)
    .trim();
}

/**
 * The comparison form: lower case, accents off ("Ikoyí" meets "Ikoyi"),
 * dots between letters dropped ("V.I." meets "vi"), every other run of
 * punctuation a single space. The naira sign, digits, commas inside numbers
 * and the slash survive, because the money and area readers need them.
 */
export function foldKey(text: string): string {
  return cleanQuery(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .replace(/(?<=[a-z])\.(?=[a-z])/g, "")
    .replace(/(?<=\b[a-z])\.(?=\s|$)/g, "")
    .replace(/[^a-z0-9₦,./+\-' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * A run of ten or more digits, spaces and dashes allowed between them: a
 * phone number, an account number or an ID. The analytics store never keeps
 * the text of a query that carries one (the database refuses it as well).
 */
export function hasLongDigitRun(text: string): boolean {
  return /(?:\d[\s\-.]?){9,}\d/.test(text);
}

/** Lower-case words of letters and digits, for matching. */
export function tokens(text: string): string[] {
  return foldKey(text)
    .split(/[^a-z0-9₦]+/)
    .filter(Boolean);
}

/** "lekki phase 1" -> "Lekki Phase 1": for a line rebuilt from words. */
export function titleCase(text: string): string {
  return text.replace(/\b([a-z])/g, (m) => m.toUpperCase());
}
