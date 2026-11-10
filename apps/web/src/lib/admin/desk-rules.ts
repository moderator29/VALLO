/**
 * SMALL RULES THE STAFF DESKS SHARE (marketing, content, technical, support
 * lead; 10 November 2026). Pure and client-safe: the server actions validate
 * with these before any write, and the tests pin them.
 */

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/** A trimmed string cut to `max`, or null when nothing is left. */
export function trimmedOrNull(value: string | null | undefined, max: number): string | null {
  const text = (value ?? "").trim();
  return text ? text.slice(0, max) : null;
}

/** A trimmed string cut to `max` ("" when empty). */
export function trimmed(value: string | null | undefined, max: number): string {
  return (value ?? "").trim().slice(0, max);
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A real calendar date written YYYY-MM-DD (2026-02-31 is not one). */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !DATE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** An http or https link with a host, and no credentials in it. */
export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && url.hostname.length > 0 && !url.username && !url.password;
  } catch {
    return false;
  }
}

/** The reason a decision must carry: at least five characters once trimmed. */
export const REASON_MIN = 5;
export function reasonProblem(reason: string | null | undefined): string | null {
  return trimmed(reason, 2000).length >= REASON_MIN ? null : "Give a reason of at least five characters.";
}

/** Whole days from `from` to `to` (both YYYY-MM-DD), negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** Today's date in Lagos (UTC+1, no daylight saving), YYYY-MM-DD. */
export function lagosToday(now: number = Date.now()): string {
  return new Date(now + 3_600_000).toISOString().slice(0, 10);
}

/** Monday of the Lagos week holding `date`, YYYY-MM-DD. */
export function mondayOfIso(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + (day === 0 ? -6 : 1 - day));
  return d.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The median of a list of numbers, or null when there are none. */
export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Naira from kobo for display, e.g. 1250000 -> "NGN 12,500". */
export function nairaFromKobo(kobo: number): string {
  const naira = kobo / 100;
  return `NGN ${naira.toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;
}

/** Whole kobo from a naira amount the person typed ("12,500.50"), or null when it is not a non-negative amount. */
export function koboFromNairaInput(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  const text = String(input).replace(/[,\s]/g, "").replace(/^NGN/i, "");
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  return Math.round(Number(text) * 100);
}
