import "server-only";

import { createHash } from "node:crypto";
import { consentFromCookieHeader } from "@/lib/consent/consent";

/**
 * LISTING VIEWS, THE RULES THE SERVER APPLIES BEFORE COUNTING (founder,
 * 13 November 2026). Pure, so every rule is tested.
 *
 * WHAT A VIEW IS. One person opening one real, live listing on one Lagos day,
 * reported by the page itself after it has been on screen for a second
 * (`ListingViewBeacon`). The database (`public.record_listing_view`) keeps
 * the "once per viewer per listing per day" and leaves out the lister, staff,
 * internal accounts and examples. This module turns away what should never
 * reach it:
 *
 *   - a request that is not from a Vallo page (its Origin is not this host,
 *     or the browser says it came from another site), so another website
 *     cannot make its visitors count views here;
 *   - anything that is not a browser: no user agent, or one that names a
 *     crawler, a link preview, a headless browser or an HTTP library;
 *   - a browser that said no to usage counts on the cookie notice, or that
 *     sends Global Privacy Control (`Sec-GPC: 1`). No choice yet is not a no:
 *     counting a guest stores nothing on their device (see `guestKey`).
 *
 * THE GUEST KEY. A guest is keyed by a SHA-256 of the network address and the
 * user agent, worked out here so the raw address never leaves this server.
 * The database never stores even that: it keeps an HMAC of it under a salt
 * that lives one Lagos day and is deleted, with every mark, within the hour
 * after the day ends. No cookie, no device storage, nothing to list on the
 * Cookies page. Two guests on one network with the same browser build count
 * once a day, which undercounts and never overcounts.
 */

export type ViewRequest = {
  userAgent: string | null;
  origin: string | null;
  host: string | null;
  /** `Sec-Fetch-Site`, when the browser sends it. */
  fetchSite: string | null;
  cookie: string | null;
  /** `Sec-GPC`. */
  gpc: string | null;
};

export type ViewRefusal = "foreign" | "bot" | "declined";

/** User agents that are not a person reading a page. */
export const BOT_AGENT =
  /bot\b|bot\/|crawl|spider|slurp|preview|facebookexternalhit|embedly|headless|lighthouse|pagespeed|gtmetrix|pingdom|uptime|monitor|curl\/|wget|python|aiohttp|httpx|go-http-client|java\/|okhttp|axios|node-fetch|undici|postman|insomnia|phantomjs|selenium|puppeteer|playwright|scrapy|ahrefs|semrush|mj12|petalsearch|yandex|baidu|bytespider|applebot|googleother|google-inspectiontool/i;

export function isBotAgent(userAgent: string | null | undefined): boolean {
  const ua = (userAgent ?? "").trim();
  /* Every browser, and the app's web view, still opens with "Mozilla/". */
  if (ua.length < 20 || !ua.startsWith("Mozilla/")) return true;
  return BOT_AGENT.test(ua);
}

function hostOf(origin: string): string | null {
  try {
    return new URL(origin).host.toLowerCase();
  } catch {
    return null;
  }
}

/** Why this request must not be counted, or null when it may go to the database. */
export function viewRefusal(request: ViewRequest): ViewRefusal | null {
  if (request.fetchSite && request.fetchSite !== "same-origin") return "foreign";
  const host = (request.host ?? "").toLowerCase();
  if (!request.origin || !host || hostOf(request.origin) !== host) return "foreign";
  if (isBotAgent(request.userAgent)) return "bot";
  if (request.gpc?.trim() === "1") return "declined";
  const consent = consentFromCookieHeader(request.cookie);
  if (consent && !consent.analytics) return "declined";
  return null;
}

/** The guest's daily key input: 64 hex characters, never the address itself. */
export function guestKey(address: string, userAgent: string): string {
  return createHash("sha256").update(`vallo-listing-view\u0000${address}\u0000${userAgent}`, "utf8").digest("hex");
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The listing id from a beacon body, or null. The body is tiny JSON: `{ "id": "<uuid>" }`. */
export function listingIdFrom(text: string): string | null {
  if (text.length > 256) return null;
  try {
    const id = (JSON.parse(text) as { id?: unknown } | null)?.id;
    return typeof id === "string" && UUID.test(id) ? id.toLowerCase() : null;
  } catch {
    return null;
  }
}

/** A PostgREST answer that means "this function is not installed yet". */
export function isMissingFunction(error: unknown): boolean {
  const e = error as { code?: unknown; message?: unknown } | null;
  return e?.code === "PGRST202" || e?.code === "42883" || /could not find the function/i.test(String(e?.message ?? ""));
}
