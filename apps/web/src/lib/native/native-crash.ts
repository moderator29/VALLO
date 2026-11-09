import type { NativeCrash } from "./shell-plugin";

/**
 * A CRASH OF THE SHELL ITSELF, INTO VALLO'S OWN CRASH LOG (NATIVE_BUILD_QUEUE
 * item 6; founder, 7 November 2026: "Vallo's own crash log, read in the admin
 * panel. No paid service").
 *
 * The crash log already hears every web page. What it cannot hear is the
 * Swift or Kotlin shell dying under the page (an exception in a plugin, a
 * signal, Android killing the web view's renderer for memory). The shell
 * writes that one record to its own storage on the way down, and on the next
 * launch this sends it to `/api/client-error` like any other report, with
 * platform `ios` or `android` and kind `native.crash`. The route scrubs,
 * rate limits and counts it, exactly as it does a web crash.
 *
 * NOTHING THAT NAMES A PERSON: the record carries a type, a message and a
 * stack of the shell's own frames, written by native code that never sees
 * page content. The route's scrubber runs over it anyway.
 */

export const NATIVE_CRASH_KIND = "native.crash";
const CLIENT_ERROR_PATH = "/api/client-error";
const MAX_STACK = 4_000;

/** The body the client-error route reads (its five bounded fields plus platform and release). */
export function crashBody(report: NativeCrash, platform: "ios" | "android"): string {
  return JSON.stringify({
    kind: NATIVE_CRASH_KIND,
    name: String(report.name || "NativeCrash").slice(0, 80),
    message: String(report.message || "").slice(0, 1_000),
    stack: String(report.stack || "").slice(0, MAX_STACK),
    area: "/native",
    platform,
    release: String(report.release || "").slice(0, 40) || undefined,
  });
}

/** Send one report. Best effort: a failure is simply the report not arriving. */
export async function sendNativeCrash(report: NativeCrash, platform: "ios" | "android", send: typeof fetch = fetch): Promise<boolean> {
  try {
    const res = await send(CLIENT_ERROR_PATH, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: crashBody(report, platform),
      keepalive: true,
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}
