/**
 * WHICH PLATFORM IS THIS PAGE ON (Agent NATIVE, job 1, 7 November 2026).
 *
 * One codebase, two shells and a website. The page adapts its touch feedback,
 * its page changes and its scroll edges to the platform it runs on
 * (`app/css/platform.css`), and every one of those adaptations keys off two
 * attributes on <html>:
 *
 *   data-platform  "ios", "android" or "web"
 *   data-native    present ("true") only inside the iOS or Android shell
 *
 * WRITTEN BEFORE FIRST PAINT. `PLATFORM_SCRIPT` below is the opening of the
 * very first script in <head> (`STARTUP_NATIVE_SCRIPT` in
 * `components/startup/startup-script.ts`), so the first frame is already the
 * right platform's frame and nothing is drawn one way and then changed.
 *
 * TWO SIGNALS, IN ORDER OF TRUST.
 *   1. The injected bridge (`window.Capacitor.getPlatform()`). Authoritative,
 *      but on Android it can arrive after the first script has run (the
 *      bridge is injected at document start only where the web view supports
 *      it).
 *   2. The user agent. Both shells append `VALLO-NATIVE` (capacitor.config.ts
 *      `appendUserAgent`), and an Android web view always says "Android".
 *      Every other user agent of an Apple handheld (iPhone, iPad, and an iPad
 *      in desktop mode, which reports itself as a Mac) is iOS.
 *
 * `lib/native/boot.ts` asks the real `Capacitor.getPlatform()` again once the
 * native chunk has loaded and rewrites the attributes if the early answer was
 * wrong, so the user agent only has to be right for the first frame.
 *
 * THE WEBSITE PAYS NOTHING: a few bytes of inline script and two attributes.
 * No import, no listener, no global.
 */

export type Platform = "ios" | "android" | "web";

export type PlatformReading = {
  platform: Platform;
  /** True only inside the Capacitor shell. */
  native: boolean;
};

/** The token both shells append to their user agent (capacitor.config.ts). */
export const NATIVE_UA_MARK = "VALLO-NATIVE";

export const PLATFORM_ATTRIBUTE = "data-platform";
export const NATIVE_ATTRIBUTE = "data-native";

/**
 * Decide the platform from what the page can see. Fails toward "web": a
 * website marked as a shell would get the shell's behaviour, and a shell marked
 * as a website only loses its adaptations until boot.ts corrects it.
 */
export function readPlatform(signals: { bridgePlatform?: string | null; userAgent?: string | null }): PlatformReading {
  const bridge = signals.bridgePlatform ?? "";
  if (bridge === "ios" || bridge === "android") return { platform: bridge, native: true };
  const ua = signals.userAgent ?? "";
  if (!ua.includes(NATIVE_UA_MARK)) return { platform: "web", native: false };
  return { platform: /Android/i.test(ua) ? "android" : "ios", native: true };
}

/** Write a reading on the root. Idempotent; never throws. */
export function applyPlatform(root: { setAttribute(n: string, v: string): void; removeAttribute(n: string): void }, reading: PlatformReading): void {
  try {
    root.setAttribute(PLATFORM_ATTRIBUTE, reading.platform);
    if (reading.native) root.setAttribute(NATIVE_ATTRIBUTE, "true");
    else root.removeAttribute(NATIVE_ATTRIBUTE);
  } catch {
    /* A root that refuses an attribute keeps the shared behaviour. */
  }
}

/**
 * The same decision as `readPlatform`, as ES5 for the inline script that runs
 * before anything is imported. Kept beside the function it mirrors; the test
 * runs both over the same table so they cannot drift apart.
 */
export const PLATFORM_SCRIPT =
  "try{(function(){var d=document.documentElement,p='web',n=false,b='';" +
  "try{var C=window.Capacitor;b=C&&C.getPlatform?String(C.getPlatform()):''}catch(e){}" +
  "if(b==='ios'||b==='android'){p=b;n=true}" +
  "else{var u=navigator.userAgent||'';if(u.indexOf('" +
  NATIVE_UA_MARK +
  "')!==-1){n=true;p=/Android/i.test(u)?'android':'ios'}}" +
  "d.setAttribute('" +
  PLATFORM_ATTRIBUTE +
  "',p);if(n)d.setAttribute('" +
  NATIVE_ATTRIBUTE +
  "','true')})()}catch(e){}";
