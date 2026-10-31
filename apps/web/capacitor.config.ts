import type { CapacitorConfig } from "@capacitor/cli";
/* A value import, not a type import, because `resize` below is typed as this
   enum rather than as a string. Verified to load cleanly under plain Node,
   which is what the Capacitor CLI evaluates this file with. */
import { KeyboardResize } from "@capacitor/keyboard";

/**
 * Capacitor, configured for what this application actually is.
 *
 * READ THIS BEFORE CHANGING `webDir` OR `server`.
 *
 * Capacitor normally packages a folder of static files into the native binary.
 * Vallo cannot produce one, and that is not a gap to be closed later: about 200 files
 * declare server actions and `output: 'export'` refuses a project containing
 * one; `src/proxy.ts` (Next 16's name for middleware) is the session lock and static export runs no
 * middleware, so a static bundle would ship with no route protection at all;
 * and every route is dynamically rendered anyway because the root layout reads
 * cookies. See `docs/MOBILE_READINESS.md` section 2 for the full reasoning.
 *
 * So this is configured the other way round, which is a supported Capacitor
 * arrangement and not a workaround: the native shell loads the live origin over
 * https, and `webDir` holds a small branded shell that the binary falls back to
 * when that origin cannot be reached. That fallback is the honest answer to a
 * dead network on a metered Nigerian data bundle, and it is the reason `webDir`
 * is not empty.
 *
 * WHAT THE OWNER MUST KNOW. Apple's App Review guideline 4.2 rejects
 * applications that are only a web view around a website. Google Play is far
 * more tolerant of the same shape. The native capabilities wired in
 * `src/lib/native/` (status bar, splash, keyboard inset, hardware back button,
 * external payment and OAuth handoff) are what separate this from a bookmark,
 * and they are the argument, but they are not a guarantee. `docs/MOBILE.md`
 * prices the alternative honestly.
 */

/**
 * The live origin the shell loads.
 *
 * Read from the environment rather than hardcoded, because this repository does
 * not know the production domain: the owner sets it in Vercel and it has never
 * been visible here. The variable is `CAPACITOR_SERVER_URL`, read below, and
 * NOT `NEXT_PUBLIC_SITE_URL`, which this comment used to name by mistake.
 * They are different variables and only the first is read here.
 *
 * `cap sync` evaluates this file, so the variable has to be present in the
 * shell that runs the sync, which is exactly what `docs/MOBILE.md` says to do.
 *
 * Left unset, `server` is omitted entirely and the binary loads `webDir`, which
 * means the shell opens on its own offline card and says so in plain words.
 * That is a designed state, the same way every other integration on this
 * platform degrades when its key is absent. It is NOT a shippable state, and
 * the offline card says that too.
 */
/*
 * THE ORIGIN IS THE www HOST. Production serves `https://www.vallospaces.com`
 * and the apex answers every path with a 308 to it. A shell pointed at the apex
 * therefore starts on a cross-host redirect, and Capacitor treats a navigation
 * to a host that is not `server.url` (or listed in `allowNavigation`) as
 * external: the first launch can bounce into Safari or Chrome, or land the
 * session cookies in the wrong jar. So an apex value is rewritten to www here,
 * and both hosts are listed in `allowNavigation` below so a stray apex link or
 * redirect stays inside the web view.
 */
const CANONICAL_HOST = "www.vallospaces.com";
const APEX_HOST = "vallospaces.com";

function canonicalOrigin(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (trimmed.length === 0) return "";
  try {
    const url = new URL(trimmed);
    if (url.hostname === APEX_HOST) url.hostname = CANONICAL_HOST;
    return url.origin;
  } catch {
    /* Not a URL at all; hand it through and let the sync fail on it loudly. */
    return trimmed;
  }
}

const liveOrigin = canonicalOrigin(process.env.CAPACITOR_SERVER_URL ?? "");

function hostOf(origin: string): string | null {
  try {
    return new URL(origin).hostname;
  } catch {
    return null;
  }
}

/* Hosts the web view may navigate to without handing off to the system
   browser: the configured origin, plus both production hosts. */
const allowNavigation = Array.from(
  new Set([hostOf(liveOrigin), CANONICAL_HOST, APEX_HOST].filter((h): h is string => Boolean(h))),
);

/*
 * STORE-04: WHERE THE APP OPENS. Never the marketing page. `/open` is a
 * server route that sends a signed-in person to `/home` and anybody else to
 * the public catalogue (when `VALLO_PUBLIC_CATALOGUE` is on) or to `/welcome`.
 * The same value is written into the offline card's retry target by
 * `scripts/write-shell-config.mjs`, from `native-shell/start-path.json`.
 *
 * iOS CHECKS THAT THE PATH EXISTS INSIDE `webDir` BEFORE LOADING THE SERVER
 * URL (`CAPBridgeViewController.loadWebView` → `appStartFileURL`), and calls
 * `fatalLoadError()` if it does not, so `native-shell/open/index.html` exists
 * for that check alone.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const nativeStartPath: string = require("./native-shell/start-path.json").startPath;

const config: CapacitorConfig = {
  /*
   * Reverse DNS on a domain the owner controls. This string is permanent: it is
   * the primary key for the application on both stores, it cannot be changed
   * after the first submission without shipping a different app, and it has to
   * match the bundle identifier registered in the Apple Developer portal and in
   * the Play Console. Change it now if it is going to change at all.
   */
  appId: "com.vallospaces.app",

  /* What appears under the icon on a home screen. Kept to one word for the
     same reason `short_name` in the web manifest is: a launcher truncates. */
  appName: "Vallo",

  webDir: "native-shell",

  /*
   * STORE-02 / STORE-03. Every request from the shell carries this token, so
   * the SERVER knows it is rendering for the app and can leave out a sign-in
   * door that cannot complete inside a web view (a Google or Apple redirect
   * lands in the system browser's cookie jar, not the app's), on the first
   * frame rather than drawing it and removing it on the client. Read by
   * `surfaceFromUserAgent` in `src/lib/auth/providers.ts`; keep the two equal.
   *
   * THE SAME TOKEN IS THE SHELL'S MARK FOR V-11: the landing page and
   * `/home-or-landing` read it (`SHELL_UA_MARK` in `src/lib/native/shell.ts`)
   * and send the shell to `/home`, `/welcome` or `/sign-in`, never `/`.
   * `server.url` stays the bare origin; the full reading of why is in that
   * file. One token, two readers, so the shell announces itself once.
   */
  appendUserAgent: "VALLO-NATIVE",

  android: {
    /*
     * A release build must never be debuggable, and this is the flag people
     * forget. Play rejects a debuggable release upload, and if one ever got
     * through it would expose the WebView to remote inspection on a shipped
     * device.
     */
    webContentsDebuggingEnabled: false,
  },

  ios: {
    /* The shell is dark because the brand is dark, and the default is white.
       Without this the gap above the web view flashes white on every launch
       and on every rubber band scroll past the top of a page.

       THIS VALUE HAS A HOME AND IT IS `src/lib/theme/chrome`. It is written out
       here, in three places in this file, because this config is read by the
       Capacitor CLI rather than by the app, so it cannot rely on the path alias
       that resolves `@/`. If the chrome colour moves, these three move with it,
       and that note is at the definition too. */
    backgroundColor: "#010118",
    /*
     * APP-BOUND DOMAINS, ON (8 October 2026), BECAUSE IT IS WHAT TURNS ON THE
     * SERVICE WORKER IN AN IPHONE'S WEB VIEW. WKWebView runs a service worker
     * only for an app that lists its domains (`WKAppBoundDomains` in
     * `ios/App/App/Info.plist`, which explains each entry), and Capacitor asks
     * for this flag to be true whenever that list exists. With it, the pages a
     * member has opened open again with no signal (`public/sw.js`) instead of
     * the packaged offline card.
     *
     * Links that are not ours still open in the system browser rather than
     * replacing the application: Capacitor's own navigation delegate hands any
     * host outside `allowNavigation` to the operating system before WebKit's
     * app-bound check is reached, and `src/lib/native/external-links.ts` does
     * the same in the page for payments and OAuth. What this flag adds is a
     * refusal of a top-level load to an unlisted host, which is a load that
     * delegate already never lets happen.
     *
     * NEEDS A NATIVE REBUILD to take effect; `cap sync` copies it.
     */
    limitsNavigationsToAppBoundDomains: true,
  },

  plugins: {
    SplashScreen: {
      /*
       * The splash is dismissed by the application, not by a timer.
       *
       * `launchAutoHide: false` hands the decision to `src/lib/native/boot.ts`,
       * which hides it once the web layer has actually painted. A timer either
       * uncovers a blank view on a slow connection, which is the first thing a
       * reviewer sees, or holds a static image over a page that was ready
       * seconds ago. Neither is acceptable and both are what the default does.
       */
      launchAutoHide: false,
      /* Matches `background_color` in the web manifest and the iOS shell above,
         so install, splash and first paint are one continuous colour. The
         manifest reads `CHROME_COLOUR.dark` now; see the note on the iOS
         `backgroundColor` above for why this one is still written out. */
      backgroundColor: "#010118",
      /*
       * NOTHING ON THE GROUND, on every platform (round 5). The web's first
       * frame is the startup sequence's frame one, the bare navy ground with
       * nothing on it yet (MOTION_SYSTEM.md section 3: "navy ground, matching
       * the native splash exactly so the handoff is invisible"), and the mark
       * then assembles at the optical centre. A native splash that drew the
       * glass tile handed over to that frame by taking the tile away, and a
       * smaller, flat mark appeared 120ms later somewhere else: the jump the
       * hand-off exists to avoid. So the native side draws the ground only,
       * as Android 12 and above already did (`styles.xml`): below Android 12
       * this plugin draws `splash_blank`, a transparent drawable, over
       * `backgroundColor`, and iOS draws the launch storyboard, which is now
       * the same navy view with no image. Apple's own guidance for a launch
       * screen is the same: the app's first frame, not a poster. The glass
       * tile stays what it is, the app icon.
       */
      androidSplashResourceName: "splash_blank",
      showSpinner: false,
    },
    StatusBar: {
      /* Dark is the default theme and the operating system does not override
         it. The bar is repainted at runtime by `applyThemeColour` when somebody
         chooses the paper theme; this is only the value it starts at, and it is
         `CHROME_COLOUR.dark` written out for the reason above. */
      style: "DARK",
      backgroundColor: "#010118",
      overlaysWebView: false,
    },
    PushNotifications: {
      /*
       * `presentationOptions` governs what iOS shows when a notification
       * arrives WHILE THE APPLICATION IS OPEN, which is the state every
       * person testing push is in, and the state iOS shows nothing in by
       * default.
       *
       * It is listed here for completeness and the plist is not the whole
       * story: the delegate method in `ios/App/App/AppDelegate.swift` is what
       * actually answers iOS when it asks, and without that method this
       * setting does nothing. Both are present; neither is sufficient.
       *
       * `badge` is included and is the one to watch: a badge nothing ever
       * clears is a red dot a person cannot get rid of, and clearing it is
       * the application's job, not the system's.
       */
      presentationOptions: ["badge", "sound", "alert"],
    },

    Keyboard: {
      /*
       * `resize: "native"` shrinks the web view when the keyboard opens, which
       * is what keeps a submit button reachable above it. The alternative,
       * "body", leaves the view at full height and the control sits behind the
       * keyboard, which is the mobile bug this platform has already fixed once
       * in its own sheets.
       */
      resize: KeyboardResize.Native,
      resizeOnFullScreen: true,
    },
  },

  /*
   * Only present when the origin is known. An empty `server.url` is worse than
   * no server block: Capacitor treats it as a URL and the shell loads nothing
   * at all, with no fallback to `webDir`.
   */
  ...(liveOrigin.length > 0
    ? {
        server: {
          url: liveOrigin,
          /* See `CANONICAL_HOST` above: keeps the apex-to-www redirect, and
             any link to either production host, inside the web view. */
          allowNavigation,
          /* https only. `cleartext` would permit http, and the platform sends
             HSTS with preload on the web precisely so that cannot happen. */
          androidScheme: "https",
          cleartext: false,
          /*
           * THE AIRPLANE MODE TEST, WHICH WE FAILED FOR ONE MISSING LINE.
           *
           * App Review puts the device into airplane mode and rejects an
           * application that shows a blank white view or a browser error page
           * instead of a native offline state. `native-shell/index.html`
           * carries a real offline card and, without this line, IT COULD
           * NEVER BE REACHED IN A SHIPPING BUILD: `webDir` is only what the
           * binary loads when `CAPACITOR_SERVER_URL` is unset, and in a
           * shipping build it is set, so the web view is pointed at the live
           * origin and a failed load is a blank view.
           *
           * VERIFIED AGAINST THE BRIDGE SOURCE RATHER THAN THE DOCUMENTATION,
           * because the store research could only confirm the option exists.
           * On iOS, `WebViewDelegationHandler.swift` loads
           * `bridge.config.errorPathURL` from BOTH `didFail` and
           * `didFailProvisionalNavigation`, which is exactly the failure a
           * remote origin that cannot be reached produces. On Android,
           * `BridgeWebViewClient.onReceivedError` loads the error URL whenever
           * `request.isForMainFrame()`. And `CAPInstanceConfiguration.swift`
           * resolves `errorPathURL` against `localURL`, not against
           * `server.url`, so this path is the PACKAGED shell rather than a
           * page on an origin that is by definition unreachable.
           *
           * The card itself is designed with the offline surface. This
           * line is only what makes it reachable.
           */
          errorPath: "index.html",
          appStartPath: nativeStartPath,
        },
      }
    : {}),
};

export default config;
