/**
 * THE OPENING SCREEN'S CONTROLLER (10 November 2026). One inline script, first in
 * the head after the platform script, deciding BEFORE the first frame and lifting
 * the screen when the page is ready. The picture itself is `OpeningScreen.tsx`
 * (inline SVG in the first HTML) and `open.css` (first paint, no script).
 *
 * WHAT IT DECIDES. `data-open` on the root:
 *   on     an installed app (display-mode standalone, or iOS `navigator.standalone`)
 *          opened cold: the first load of this browser session (`nf_open` in
 *          sessionStorage; an installed app that was closed starts a new one).
 *   off    a browser tab, the native shell (its own launch plays there), a warm
 *          open in the same session, or storage that refuses (no flag could be
 *          kept, so it would replay on every load).
 *   leave  the 320ms crossfade into the page.
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
 * A tap during the opening is not swallowed by the page underneath: the layer
 * takes it, and the opening is at most OPEN_CAP_MS long.
 */

/** Shortest time the mark is seen once its animation has begun. */
export const OPEN_MIN_MS = 1100;

/** The same, where nothing moves (reduced motion, Calm, Off): the still mark. */
export const OPEN_MIN_STILL_MS = 900;

/** Longest, from the first frame, before the crossfade starts whatever is not ready. */
export const OPEN_CAP_MS = 2200;

/** The crossfade (matches open.css). */
export const OPEN_FADE_MS = 320;

/** The stylesheet's own backstop when no script runs: it starts lifting at this time. */
export const OPEN_CSS_CAP_MS = 2200;

/** sessionStorage key marking this session's opening as shown. */
export const OPEN_SESSION_KEY = "nf_open";

export const OPEN_SCRIPT =
  "(function(){var W=window,D=document,r=D.documentElement;try{" +
  "var sa=false;try{sa=!!(W.matchMedia&&W.matchMedia('(display-mode: standalone)').matches)||navigator.standalone===true}catch(e){}" +
  "if(!sa||r.hasAttribute('data-native')||/VALLO-NATIVE/.test(navigator.userAgent)||(W.Capacitor&&W.Capacitor.isNativePlatform&&W.Capacitor.isNativePlatform())){r.setAttribute('data-open','off');return}" +
  "var warm=true;try{warm=!!sessionStorage.getItem('" + OPEN_SESSION_KEY + "');if(!warm)sessionStorage.setItem('" + OPEN_SESSION_KEY + "','1')}catch(e){}" +
  "if(warm){r.setAttribute('data-open','off');return}" +
  "r.setAttribute('data-open','on');" +
  "var still=false;try{still=W.matchMedia('(prefers-reduced-motion: reduce)').matches}catch(e){}" +
  "var mo=r.getAttribute('data-motion');if(mo==='calm'||mo==='off')still=true;" +
  "var min=still?" + OPEN_MIN_STILL_MS + ":" + OPEN_MIN_MS + ",cap=" + OPEN_CAP_MS + ",t0=0,gone=0;" +
  "function ready(){if(!W.__nfOpenReady)return false;" +
  "if(D.querySelector('[data-passcode-guarded]')&&!r.hasAttribute('data-guard-ready')&&!D.querySelector('.nf-passcode'))return false;return true}" +
  "function leave(){if(gone)return;gone=1;r.setAttribute('data-open','leave');setTimeout(function(){r.setAttribute('data-open','off')}," + (OPEN_FADE_MS + 40) + ")}" +
  "function tick(){var age=performance.now()-t0;if(age>=cap||(age>=min&&ready()))leave();else setTimeout(tick,40)}" +
  "function start(){if(t0)return;t0=performance.now();tick()}" +
  "D.addEventListener('animationstart',function(e){if(e.animationName==='nf-open-in')start()},true);" +
  "function arm(){requestAnimationFrame(function(){requestAnimationFrame(start)})}" +
  "if(D.readyState==='loading')D.addEventListener('DOMContentLoaded',arm,{once:true});else arm();" +
  "}catch(e){try{r.setAttribute('data-open','off')}catch(x){}}})();";
