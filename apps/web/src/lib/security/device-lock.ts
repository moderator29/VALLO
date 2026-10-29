/**
 * WHICH LOCK THIS DEVICE REALLY HAS (27 October 2026, founder: the unlock
 * screen said "Face ID or fingerprint" on a desktop browser).
 *
 * A web page cannot ask which biometric a phone holds; it can ask only
 * whether the browser can reach a platform authenticator
 * (`platformLockAvailable`). So the WORDS are chosen from what the device
 * announces about itself, and chosen to be true on every device of that
 * family. Where the family has several lock types and the page cannot tell
 * which (iPad, Mac), the label names the device rather than a method the
 * person may not have.
 *
 *   face-id          iPhone without a home button
 *   touch-id         iPhone with a home button (the older 4.7 and 5.5 inch
 *                    and the 4 inch screens)
 *   fingerprint      Android (fingerprint or the phone's face unlock; the
 *                    phone decides, the label says what is common to both)
 *   windows-hello    Windows
 *   this-device      iPad, Mac, Linux, ChromeOS and anything unknown
 *
 * Pure: the caller hands in what it read, so it is tested without a browser.
 */
export type DeviceLock = "face-id" | "touch-id" | "fingerprint" | "windows-hello" | "this-device";

export type DeviceFacts = {
  userAgent: string;
  platform?: string;
  maxTouchPoints?: number;
  /** CSS pixels of the screen, portrait or landscape. */
  screenWidth?: number;
  screenHeight?: number;
};

/** Screens (short side x long side, CSS px) of iPhones that have a home button. */
const HOME_BUTTON_IPHONES: ReadonlyArray<readonly [number, number]> = [
  [320, 568], // 5, 5s, SE (1st gen)
  [375, 667], // 6, 6s, 7, 8, SE (2nd and 3rd gen)
  [414, 736], // 6 Plus, 7 Plus, 8 Plus
];

export function classifyDeviceLock(facts: DeviceFacts): DeviceLock {
  const ua = facts.userAgent;
  const iPad =
    /iPad/i.test(ua) || (/Macintosh/i.test(ua) && (facts.maxTouchPoints ?? 0) > 1) /* iPadOS asks for the desktop site */;
  if (iPad) return "this-device";
  if (/iPhone|iPod/i.test(ua)) {
    const w = facts.screenWidth ?? 0;
    const h = facts.screenHeight ?? 0;
    const short = Math.min(w, h);
    const long = Math.max(w, h);
    if (short > 0 && HOME_BUTTON_IPHONES.some(([a, b]) => a === short && b === long)) return "touch-id";
    return "face-id";
  }
  if (/Android/i.test(ua)) return "fingerprint";
  if (/Windows/i.test(ua) || /^Win/i.test(facts.platform ?? "")) return "windows-hello";
  return "this-device";
}

/** The facts of this browser; "this-device" on the server, where there is none. */
export function readDeviceLock(): DeviceLock {
  if (typeof navigator === "undefined") return "this-device";
  return classifyDeviceLock({
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    maxTouchPoints: navigator.maxTouchPoints,
    screenWidth: typeof screen === "undefined" ? undefined : screen.width,
    screenHeight: typeof screen === "undefined" ? undefined : screen.height,
  });
}
