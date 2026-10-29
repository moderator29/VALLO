import { DEFAULT_LOCALE, formatNumber, plural, type Locale, type PluralForms } from "@vallo/i18n/core";

/**
 * "SHOW ME" (V-69): a renter asks the lister for one specific clip in the
 * thread, and the clip arrives with the time it was sent.
 *
 * The clip is an UPLOAD from the lister's phone: there is no in-app camera
 * on this branch, and nothing here says "captured in Vallo". What is shown
 * is true: when it was asked, and how long after that the clip arrived.
 * Pure and tested.
 */

export const SHOW_ME_ITEMS = ["tap", "bathroom", "meter", "window", "road", "generator", "other"] as const;
export type ShowMeItem = (typeof SHOW_ME_ITEMS)[number];

export function isShowMeItem(value: unknown): value is ShowMeItem {
  return typeof value === "string" && (SHOW_ME_ITEMS as readonly string[]).includes(value);
}

/** The words the database may answer with; each one is said in full. */
export const SHOW_ME_RESULTS = [
  "ok",
  "off",
  "signed-out",
  "not-yours",
  "example",
  "blocked",
  "bad-item",
  "too-many",
  "already",
  "expired",
  "bad-path",
  "too-long",
  "too-big",
  "failed",
] as const;
export type ShowMeResult = (typeof SHOW_ME_RESULTS)[number];

export function readShowMeResult(value: unknown): ShowMeResult {
  return typeof value === "string" && (SHOW_ME_RESULTS as readonly string[]).includes(value)
    ? (value as ShowMeResult)
    : "failed";
}

/** The longest clip the thread takes, in seconds. */
export const SHOW_ME_MAX_SECONDS = 30;

/** The most a clip may weigh: the `show-me-clips` bucket refuses more, and a late refusal after a long upload helps nobody. */
export const SHOW_ME_MAX_BYTES = 25 * 1024 * 1024;

export type ShowMeRequest = {
  id: string;
  item: ShowMeItem;
  note: string | null;
  status: "open" | "answered";
  createdAt: string;
  expiresAt: string;
  answeredAt: string | null;
  clipSeconds: number | null;
  /** A short-lived signed URL for the clip, when answered and readable. */
  clipUrl: string | null;
  /** The clip's size in bytes, when storage says, for the data saver's tap-to-play line. */
  clipBytes: number | null;
};

/** "2.4 MB", "640 KB": a clip's weight, for the data saver line. */
export function sizeText(bytes: number, locale: Locale = DEFAULT_LOCALE): string {
  const kb = Math.max(1, Math.round(bytes / 1000));
  /* 999,999 bytes rounds to 1000 KB; say it in MB instead (review). */
  if (kb >= 1000) {
    return `${formatNumber(bytes / 1_000_000, locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MB`;
  }
  return `${formatNumber(kb, locale)} KB`;
}

/**
 * The data saver's play label, from parts: the size only when storage says
 * it, and never the length, which is the uploader's claim and not proven
 * (review). "Play the clip, 2.4 MB", or just "Play the clip".
 */
export function playLabel(
  bytes: number | null,
  copy: { play: string; playWithSize: string },
  locale: Locale = DEFAULT_LOCALE,
): string {
  return bytes && bytes > 0 ? copy.playWithSize.replace("{size}", sizeText(bytes, locale)) : copy.play;
}

/** What a request is now, at `now`: waiting, answered, or expired unanswered. */
export function showMeState(request: Pick<ShowMeRequest, "status" | "expiresAt">, now: Date): "open" | "answered" | "expired" {
  if (request.status === "answered") return "answered";
  return Date.parse(request.expiresAt) > now.getTime() ? "open" : "expired";
}

/** "25 minutes", "1 hour", "2 days": how long after the ask a clip came, pluralised per locale. */
export function elapsedText(
  fromIso: string,
  toIso: string,
  forms: { minutes: PluralForms; hours: PluralForms; days: PluralForms },
  locale: Locale,
): string {
  const minutes = Math.max(1, Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 60_000));
  if (minutes < 60) return plural(minutes, forms.minutes, locale);
  const hours = Math.round(minutes / 60);
  if (hours < 48) return plural(hours, forms.hours, locale);
  return plural(Math.round(hours / 24), forms.days, locale);
}

/** A clip's storage path: inside the request's own folder, which the database checks. */
export function clipPath(requestId: string, fileId: string, fileName: string): string {
  const ext = /\.(mp4|mov|webm)$/i.exec(fileName)?.[1]?.toLowerCase() ?? "mp4";
  return `${requestId}/${fileId}.${ext}`;
}
