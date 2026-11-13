/**
 * THE OPENING SCREEN'S CONTROLLER (10 November 2026). One inline script, first in
 * the head after the platform script, deciding BEFORE the first frame and lifting
 * the screen when the page is ready. The picture itself is `OpeningScreen.tsx`
 * (inline SVG in the first HTML) and `open.css` (first paint, no script).
 *
 * WHAT IT DECIDES. `data-open` on the root:
 *   on     any surface opened cold: the first load of this browser session
 *          (`nf_open` in sessionStorage; an installed app that was closed
 *          starts a new one). The website, the installed app and the native
 *          shell all play it (the founder, 11 November 2026: the opening was
 *          refused to a browser tab outright, which is why the site showed
 *          nothing at all).
 *   off    inside an app binary that draws its own opening (below), a warm
 *          open in the same session, or storage that refuses (no flag
 *          could be kept, so it would replay on every load).
 *   leave  the 320ms crossfade into the page.
 *
 * NOT IN AN APP THAT DRAWS ITS OWN (13 November 2026). A 1.0.2 or later
 * binary plays the drawn opening natively (`LaunchMark`), so this layer is
 * turned off there before the first frame: one opening, never two. It is
 * known by `ValloShell.handoff` in `Capacitor.PluginHeaders`, which the
 * bridge injects at document start. What follows applies only to an older
 * binary, which has no opening of its own.
 *
 * ON THE NATIVE SHELL (founder, 10 November 2026: the centred logo, slower).
 * The opening plays there too, but it must NOT begin while the Capacitor
 * splash is still covering the screen. This script runs before the first
 * paint; the splash is taken down by the React layer, which on a cold start
 * over a slow connection is seconds later. The earlier attempt waited on a
 * `window.__nfHide` that nothing ever produced, so the animation ran its full
 * length beneath a navy splash and only its last frame was ever seen.
 *
 * So on the shell the screen is held hidden (`data-open` unset, and open.css
 * keeps `[data-native]` hidden until it is "on") until `splash.ts` says the
 * splash is down, by the flag `__nfSplashDown` for a late listener or the
 * `nf:splash-down` event for one already waiting. `OPEN_NATIVE_WAIT_MS` is the
 * ceiling: if the signal never comes the opening plays anyway rather than
 * being lost. Because the mark is `display:none` until "on", its CSS animation
 * begins when the attribute is set, so the clock and the picture start
 * together.
 *
 * WHEN IT LEAVES, FROM THE FIRST FRAME OF THE ANIMATION (`animationstart`; the
 * next frame after the DOM is parsed where animation is off):
 *   not before OPEN_MIN_MS (OPEN_MIN_STILL_MS under reduced motion, Calm or Off),
 *   so the mark is seen; then as soon as the page is ready, which means the
 *   client has hydrated (OpenReady) AND, on a page behind the passcode guard,
 *   the guard has decided (`data-guard-ready` on the root, or the lock is drawn),
 *   so the page never shows half-built chrome or an unlocked frame before the
 *   Face ID lock; and never later than OPEN_CAP_MS. The stylesheet lifts it by
 *   itself at 2,500ms if this script never runs.
 * A TOUCH OR A KEY DURING THE OPENING ENDS IT AT ONCE: the layer starts its
 * crossfade on the first `pointerdown` or `keydown` and stops taking input that
 * instant. (It used to hold every tap for its whole hold and say otherwise.)
 * Untouched, the opening is at most OPEN_CAP_MS long.
 */

/** Shortest time the mark is seen once its animation has begun. */
export const OPEN_MIN_MS = 3500;

/** The same, where nothing moves (reduced motion, Calm, Off): the still mark. */
export const OPEN_MIN_STILL_MS = 900;

/** Longest, from the first frame, before the crossfade starts whatever is not ready. */
export const OPEN_CAP_MS = 4200;

/** The crossfade (matches open.css). */
export const OPEN_FADE_MS = 320;

/** The stylesheet's own backstop when no script runs: it starts lifting at this time. */
export const OPEN_CSS_CAP_MS = 4200;

/** Longest the shell waits for the splash to come down before playing anyway. */
export const OPEN_NATIVE_WAIT_MS = 6000;

/**
 * The shell plugin, and its method, that only a binary drawing its own opening
 * registers (build 1.0.2 and later: `ValloShell.handoff`, ValloShell.swift and
 * ValloShellPlugin.java). Their presence in `Capacitor.PluginHeaders` is what
 * turns this layer off inside the app.
 */
export const OPEN_NATIVE_PLUGIN = "ValloShell";
export const OPEN_NATIVE_METHOD = "handoff";

/** sessionStorage key marking this session's opening as shown. */
export const OPEN_SESSION_KEY = "nf_open";

export const OPEN_SCRIPT =
  "(function(){var W=window,D=document,r=D.documentElement;try{" +
  "var nat=false;try{nat=r.hasAttribute('data-native')||/VALLO-NATIVE/.test(navigator.userAgent)||!!(W.Capacitor&&W.Capacitor.isNativePlatform&&W.Capacitor.isNativePlatform())}catch(e){}" +
  /* A browser tab plays it too (the founder, 11 November 2026). This read
     `if(!sa&&!nat){off;return}`, so the website turned the opening off before
     it could draw a frame and only an installed app ever saw it. `sa` and `nat`
     still decide how the layer is TIMED below (the shell waits for its splash),
     but no surface is refused the opening now. A cold open in this browser
     session is still the only one that plays: the warm check is next. */
  /* ONE OPENING IN THE APP (13 November 2026, the founder: "two openings, and
     not even consistently"). A 1.0.2 or later binary draws its own opening
     over the launch ground (`LaunchMark` in ValloShell.swift and
     LaunchMark.java: the ring, the towers, the letters, the version line)
     and hands over to the page. This layer then played AGAIN on top of the
     page once the splash plugin said it was down, so a cold start showed
     two. Whether it read as two depended on a race nobody chose: on a slow
     first launch the native mark left at its 1.95s ceiling, the page showed,
     and this one arrived over it seconds later; on a fast, cached launch this
     one began beneath the native mark and the two blurred into one. So where
     the binary carries that opening, this one stays off. The binary says so
     itself, at document start, before this script runs: Capacitor injects
     every registered plugin's header (`window.Capacitor.PluginHeaders`), and
     only a binary with the drawn opening registers `ValloShell` with a
     `handoff` method. An older binary has none, and there this layer is
     still the one opening, timed after the splash as below. */
  "if(nat){var own=false;try{var H=W.Capacitor&&W.Capacitor.PluginHeaders;if(H&&H.length)for(var i=0;i<H.length;i++){var h=H[i];if(h&&h.name==='" + OPEN_NATIVE_PLUGIN + "'&&h.methods)for(var j=0;j<h.methods.length;j++)if(h.methods[j]&&h.methods[j].name==='" + OPEN_NATIVE_METHOD + "')own=true}}catch(e){}" +
  "if(own){r.setAttribute('data-open','off');return}}" +
  "var warm=true;try{warm=!!sessionStorage.getItem('" + OPEN_SESSION_KEY + "');if(!warm)sessionStorage.setItem('" + OPEN_SESSION_KEY + "','1')}catch(e){}" +
  "if(warm){r.setAttribute('data-open','off');return}" +
  /* LIT ONCE, NEVER AFTER IT HAS GONE, AND TIMED FROM WHEN IT IS SHOWN (13
     November 2026, measured by Agent FEEL on production with the shell's user
     agent and no splash signal: the hold was armed at DOMContentLoaded whether
     or not the layer was lit, so it "left" a layer nobody saw, and then the
     6s fallback lit it AGAIN over the page, where nothing would ever send it
     away, and it took every tap). The clock now starts only from light(), and
     light() refuses once the layer has gone. */
  "var lit=0,gone=0;function light(){if(lit||gone)return;lit=1;r.setAttribute('data-open','on');if(D.readyState==='loading')D.addEventListener('DOMContentLoaded',arm,{once:true});else arm()}" +
  /* The shell waits for the splash to be down; the website lights up at once. */
  "if(nat){if(W.__nfSplashDown)light();else{try{W.addEventListener('nf:splash-down',light,{once:true})}catch(e){}setTimeout(light," + OPEN_NATIVE_WAIT_MS + ")}}else light();" +
  "var still=false;try{still=W.matchMedia('(prefers-reduced-motion: reduce)').matches}catch(e){}" +
  "var mo=r.getAttribute('data-motion');if(mo==='calm'||mo==='off')still=true;" +
  "var min=still?" + OPEN_MIN_STILL_MS + ":" + OPEN_MIN_MS + ",cap=" + OPEN_CAP_MS + ",t0=0;" +
  "function ready(){if(!W.__nfOpenReady)return false;" +
  "if(D.querySelector('[data-passcode-guarded]')&&!r.hasAttribute('data-guard-ready')&&!D.querySelector('.nf-passcode'))return false;return true}" +
  "function leave(){if(gone)return;gone=1;try{D.removeEventListener('pointerdown',skip,true);D.removeEventListener('keydown',skip,true)}catch(e){}r.setAttribute('data-open','leave');setTimeout(function(){r.setAttribute('data-open','off')}," + (OPEN_FADE_MS + 40) + ")}" +
  /* A TOUCH OR A KEY ENDS IT AT ONCE (13 November 2026). The layer covers the
     page and takes every tap while it is up, and it used to keep them all for
     its whole hold, three and a half to four seconds: a person who tapped got
     nothing and read the app as frozen. Now the first touch or key starts the
     crossfade there and then. The touch itself does nothing else: the layer
     stops taking input the moment it leaves, so the release lands on the
     page, but a click needs its press and release on the same element, and
     that tap was never meant for a button the person could not yet see. */
  "function skip(){if(r.getAttribute('data-open')==='on')leave()}" +
  "try{D.addEventListener('pointerdown',skip,true);D.addEventListener('keydown',skip,true)}catch(e){}" +
  "function tick(){var age=performance.now()-t0;if(age>=cap||(age>=min&&ready()))leave();else setTimeout(tick,40)}" +
  "function start(){if(t0||!lit)return;t0=performance.now();tick()}" +
  "D.addEventListener('animationstart',function(e){if(e.animationName==='nf-open-in')start()},true);" +
  "function arm(){requestAnimationFrame(function(){requestAnimationFrame(start)})}" +
  "}catch(e){try{r.setAttribute('data-open','off')}catch(x){}}})();";
