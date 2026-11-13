import { bootMark } from "./boot-trace";
import { nativePlatform } from "./platform";

/**
 * CAN THIS DEVICE ASK FOR FACE ID OR A FINGERPRINT? ONE ANSWER, FOR EVERY
 * SCREEN (13 November 2026, the founder, inside the iPhone app: "This browser
 * cannot reach this device's Face ID or fingerprint. The Vallo app and most
 * phone browsers can.").
 *
 * WHAT VALLO'S FACE ID IS. Not a native plugin: there is none in the build
 * (no biometric package in package.json, `ios/App/CapApp-SPM/Package.swift` or
 * `android/capacitor.settings.gradle`). It is a WebAuthn platform key, made by
 * the money lock's enrolment and checked by the SERVER on every unlock
 * (`lib/passcode/passkey-unlock.ts`), because a device saying "the face
 * matched" is not a proof (`lib/passcode/native-unlock.ts`). So the question
 * is always whether the web view can run that ceremony.
 *
 * WHY THE APP SAID IT COULD NOT. Every screen asked
 * `PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()` and
 * believed it. Inside the iPhone app the page runs in WKWebView, where a
 * passkey for www.vallospaces.com goes through the system's own passkey sheet
 * on the strength of the app's `webcredentials` association (App.entitlements,
 * checked by the build workflow; the site's apple-app-site-association lists
 * X74KD52994.com.vallospaces.app), not through the browser's own authenticator
 * that the question is about. An app's web view can therefore answer "no" to
 * the question while the ceremony itself is available. Believing the "no"
 * meant the app never even tried, and told the member to use the app they
 * were in.
 *
 * SO, INSIDE THE iPHONE APP, a web view that has WebAuthn at all
 * (`window.PublicKeyCredential`) is let try: the ceremony is the real test.
 * A phone where it then fails is remembered by `lib/platform/device-keys.ts`
 * (two failures and it is "none"), which every caller already reads, so a
 * button that can only fail is offered at most twice and never again. On the
 * website, and in the Android app (whose web view runs WebAuthn because
 * MainActivity turns it on with `setWebAuthenticationSupport`, and answers the
 * question for itself, with `get_login_creds` in assetlinks.json), the answer
 * stays the web view's own.
 *
 * WHAT ONLY A PHONE CAN PROVE: that the iPhone app's ceremony then succeeds.
 * Every answer is written to the boot trace (`bio:` stages,
 * `localStorage.nf_boot_trace`), so a phone on Safari's inspector shows which
 * branch it took and what WebKit said.
 */
export type BiometricReading = {
  /** Offer Face ID or fingerprint on this device. */
  available: boolean;
  /** Where the page is running. */
  surface: "web" | "ios-app" | "android-app";
  /** WebAuthn exists in this web view at all. */
  webauthn: boolean;
  /** What `isUserVerifyingPlatformAuthenticatorAvailable()` said (null: not asked). */
  platformAnswer: boolean | null;
};

type Env = {
  hasPublicKeyCredential: boolean;
  askPlatform: () => Promise<boolean>;
  surface: BiometricReading["surface"];
};

/** The decision itself, with the browser passed in so every branch is a plain test. */
export async function decideBiometric(env: Env): Promise<BiometricReading> {
  if (!env.hasPublicKeyCredential) {
    return { available: false, surface: env.surface, webauthn: false, platformAnswer: null };
  }
  let answer = false;
  try {
    answer = await env.askPlatform();
  } catch {
    answer = false;
  }
  const available = answer || env.surface === "ios-app";
  return { available, surface: env.surface, webauthn: true, platformAnswer: answer };
}

function currentSurface(): BiometricReading["surface"] {
  const platform = nativePlatform();
  if (platform === "ios") return "ios-app";
  if (platform === "android") return "android-app";
  return "web";
}

let cached: Promise<BiometricReading> | null = null;

/** This device's answer, asked once per page. */
export function readBiometric(): Promise<BiometricReading> {
  if (typeof window === "undefined") {
    return Promise.resolve({ available: false, surface: "web", webauthn: false, platformAnswer: null });
  }
  cached ??= decideBiometric({
    hasPublicKeyCredential: typeof window.PublicKeyCredential === "function" || typeof window.PublicKeyCredential === "object",
    askPlatform: () => window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(),
    surface: currentSurface(),
  }).then((reading) => {
    bootMark(`bio:${reading.surface}:webauthn=${reading.webauthn ? 1 : 0}:platform=${reading.platformAnswer === null ? "-" : reading.platformAnswer ? 1 : 0}:offer=${reading.available ? 1 : 0}`);
    return reading;
  });
  return cached;
}

/** Test seam: forget the page's answer. */
export function forgetBiometricReading(): void {
  cached = null;
}
