import { intlTag, type Locale } from "@vallo/i18n/core";

/**
 * "YOUR TIME" BESIDE LAGOS TIME, FOR SOMEBODY ABROAD BOOKING A VIEWING. Pure.
 *
 * Lagos time is the time of record: the lister keeps it, the visit happens
 * on it, every screen prints it (`components/app/inspections/visit/format.ts`).
 * A renter in London or Toronto then has to do the sum in their head, and an
 * hour's error is a missed viewing. So, beside the Lagos time, the same
 * instant on the reader's own clock, ONLY when that clock differs from Lagos
 * at that instant (a phone in Douala or Kinshasa reads the same hour and gets
 * nothing extra).
 *
 * The reader's zone comes from the device (`Intl`), so this is known only in
 * the browser; the server prints Lagos time alone and the line is added after
 * hydration (`components/your-time/YourTime.tsx`), never swapped.
 */

export const LAGOS_ZONE = "Africa/Lagos";

export type YourTime = {
  /** "09:00", the instant on the reader's clock. */
  time: string;
  /** "Fri", only when the reader's calendar day differs from Lagos's. */
  day: string | null;
  /** The device's zone, e.g. "Europe/London". */
  zone: string;
};

/** A zone name the runtime accepts, or null. */
export function validZone(zone: string | null | undefined): string | null {
  if (!zone || zone.length > 64) return null;
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone });
    return zone;
  } catch {
    return null;
  }
}

function parts(at: Date, zone: string, locale: Locale): { ymd: string; hm: string; weekday: string } {
  const tag = intlTag[locale];
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
  const hm = new Intl.DateTimeFormat(tag, { timeZone: zone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(at);
  const weekday = new Intl.DateTimeFormat(tag, { timeZone: zone, weekday: "short" }).format(at);
  return { ymd, hm, weekday };
}

/**
 * The instant `at` on the reader's clock, or null when there is nothing to
 * add: the same wall time as Lagos, an unreadable instant or an unknown zone.
 */
export function yourTimeAt(at: string | Date, deviceZone: string | null | undefined, locale: Locale): YourTime | null {
  const zone = validZone(deviceZone);
  if (!zone) return null;
  const instant = at instanceof Date ? at : new Date(at);
  if (Number.isNaN(instant.getTime())) return null;
  const lagos = parts(instant, LAGOS_ZONE, locale);
  const local = parts(instant, zone, locale);
  if (lagos.ymd === local.ymd && lagos.hm === local.hm) return null;
  return { time: local.hm, day: lagos.ymd === local.ymd ? null : local.weekday, zone };
}

/** The device's zone, in a browser; null on the server or when unreadable. */
export function deviceZone(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return validZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  } catch {
    return null;
  }
}
