/**
 * THE APP OPENING: THE PRODUCT ARRIVING, NEVER A LOGO (D68c, 7 October 2026).
 *
 * The founder's rule is absolute: the logo never appears by itself on app
 * open, not as an image, not as an animation, not for 200ms. The opening is
 * the app's own first screen arriving, the way a beautifully built website
 * arrives when you click its link: real structure in frame one, content
 * rising into it, usable almost at once. The logo lockup that used to play
 * here (a glass mark rising, a wordmark following, a door opening on the page
 * at 1350ms) is retired from the startup path entirely.
 *
 * Three inline scripts, all nonce-carrying, none importing anything:
 *
 *   STARTUP_NATIVE_SCRIPT  first thing in <head>. Tells the native splash to
 *                 go through the raw bridge (`window.Capacitor.nativePromise`),
 *                 the earliest moment the document can run script, with no
 *                 import, no frame and no `load` waited for. If the bridge is
 *                 not there yet it looks again every 100ms for three seconds,
 *                 and it sends the hide twice more (400ms and 1200ms) because
 *                 a hide the plugin receives before its own launch view is
 *                 marked visible is silently dropped on iOS. A second hide is
 *                 a no-op. It also starts the BOOT TRACE (below).
 *   STARTUP_GATE_SCRIPT    at the top of <body>. Decides, before paint,
 *                 whether this load plays the opening and which one, then
 *                 runs STARTUP_SCRIPT.
 *   STARTUP_SCRIPT         the opening's controller: the native wait, a tap
 *                 or a key skipping to the settled state, and the release.
 *                 Exported alone because Settings replays the opening with
 *                 it (`MotionSettings`).
 *
 * THE OPENING. `data-splash="on"` on the root, with `data-opening`:
 *
 *   full   the first open of the day (no open recorded in the last
 *          `RETURNING_WITHIN_MS`): about 1,500ms of choreography. The header
 *          and the dock resolve into place from frame one (they are already
 *          there, dim and a few pixels off, never absent), the ground settles,
 *          and the page's own entrances rise after `--nf-splash-hold`, which
 *          is now 160ms rather than a 1,450ms logo hold.
 *   brief  a returning open: about 400ms. The page's own entrances only, at
 *          no hold at all, because a beautiful website does not replay its
 *          entrance on every visit either.
 *
 * The mark appears only where the page itself draws it, at header size,
 * arriving with everything else. Nothing is ever centred on an empty field.
 *
 * NOT AT ALL, ONE SETTLED FRAME: Off, Calm, the splash switch, data saver and
 * the platform's reduced-motion setting. Nor on the console, the auth
 * callback, the API, offline, `/open` or a shared link. Once per browser
 * session (`nf_entered` in sessionStorage), which on the native shell is once
 * per cold start; `nf_entered` in localStorage remembers the last open, which
 * is what makes the next one brief.
 *
 * INTERACTIVE FROM THE FIRST FRAME. Nothing covers the page, so a tap lands on
 * whatever is under the finger and does its job. The same tap (or a key)
 * finishes every running entrance at once (`Animation.finish()`), so the page
 * is settled under the finger rather than still travelling.
 *
 * THE NATIVE WAIT. On the shell, every animation is held at its first frame
 * (`data-startup-native="wait"`, startup.css) until the bridge answers the
 * hide, or `NATIVE_WAIT_MS` at most, so the arrival is not played out of sight
 * beneath the native splash. The splash is now a flat navy field identical to
 * the page's ground, so even a wait that runs out shows nothing but navy.
 *
 * THE RELEASE. `data-splash` moves to "done" after the opening's length and
 * `STARTUP_RELEASE_MS` more, or at once on a skip, and `data-startup` becomes
 * "open". Before it lets go, the hold is pinned on anything marked
 * `data-startup-pin` (the landing hero), whose entrance is timed from it and
 * would otherwise jump when the root's number goes. Everything is wrapped in
 * try: a failure releases the page rather than holding it.
 *
 * THE BOOT TRACE, FOR THE DEVICE WE DO NOT HAVE. The founder has watched a
 * logo for eight seconds on a build where every timer said it should be gone,
 * and nobody here holds his phone. So every stage of the path marks itself:
 * `console.info("[vallo-boot] <stage> +<ms>")`, a `performance.mark` named
 * `nf:<stage>`, and the whole run as one line in `localStorage.nf_boot_trace`
 * (also `window.__nfBoot`), on the shell only (its user agent carries
 * VALLO-NATIVE, or the bridge is there): the website keeps the stages in
 * `window.__nfBoot` and says nothing. `lib/native/boot-trace.ts` adds the stages the
 * native runtime reaches later. Read it from Safari's or Chrome's inspector,
 * or surface `nf_boot_trace` on a diagnostics row.
 */

import { PLATFORM_SCRIPT } from "@/lib/platform/detect";

/** The full opening: the first open of the day. */
export const OPENING_FULL_MS = 600;

/** The brief opening: any open within `RETURNING_WITHIN_MS` of the last. */
export const OPENING_BRIEF_MS = 400;

/** How recent the last open must be for this one to be brief. */
export const RETURNING_WITHIN_MS = 7 * 24 * 60 * 60 * 1000;

/** After the opening's length, the flag is released by this time at the latest. */
export const STARTUP_RELEASE_MS = 100;

/** On the native shell, the longest the opening waits, held at its first frame. */
export const NATIVE_WAIT_MS = 300;

/** Where the last run's boot trace is kept, as one line. */
export const BOOT_TRACE_KEY = "nf_boot_trace";

/* The trace, shared by all three scripts through `window.__nfMark`. */
const MARK =
  "function m(n){try{var b=W.__nfBoot||(W.__nfBoot=[]),t=Math.round(performance.now());b.push(n+'@'+t);" +
  "if(!W.__nfLoud)return;" +
  "try{console.info('[vallo-boot] '+n+' +'+t+'ms')}catch(e){}" +
  "try{performance.mark('nf:'+n)}catch(e){}" +
  "try{localStorage.setItem('" + BOOT_TRACE_KEY + "',b.join(' '))}catch(e){}}catch(e){}}";

export const STARTUP_NATIVE_SCRIPT = [
  /* Job 1 (platform layer): `data-platform` and `data-native` on <html>
     before the first frame, so platform.css paints the right platform from
     the start. Its own try, so nothing here can stop the splash's hide. */
  PLATFORM_SCRIPT,
  "(function(){var W=window;" + MARK + "W.__nfMark=m;",
  /* Loud (console, marks, storage) only on the shell: the shell's user agent
     carries VALLO-NATIVE (capacitor.config.ts). The website stays silent. */
  "try{W.__nfLoud=!!W.Capacitor||/VALLO-NATIVE/.test(navigator.userAgent)}catch(e){}m('parse');",
  "var sent=0,tries=0;",
  /* One hide through the raw bridge. Answers are traced, refusals too. */
  "function hide(why){try{var C=W.Capacitor;",
  "if(!C){m('bridge:absent:'+why);return 0}",
  "if(!(C.isNativePlatform&&C.isNativePlatform())){m('bridge:web');return -1}",
  "if(!C.nativePromise){m('bridge:no-nativePromise');return 0}",
  "var h=C.nativePromise('SplashScreen','hide',{fadeOutDuration:160});m('hide:sent:'+why);",
  "if(h&&h.then){if(!sent)W.__nfHide=h;h.then(function(){m('hide:answered:'+why)},function(e){m('hide:refused:'+why+':'+(e&&e.message||e))})}",
  "sent++;return 1}catch(e){m('hide:threw:'+why+':'+(e&&e.message));return 0}}",
  /* Now. If the bridge is not injected yet, look again until it is. */
  "var r=hide('parse');",
  "if(r===0&&W.__nfLoud){var iv=setInterval(function(){tries++;var k=hide('retry'+tries);if(k!==0||tries>=30){clearInterval(iv);if(k===1)again()}},100)}",
  "else if(r===1)again();",
  /* Belt and braces: iOS drops a hide that beats its launch view's own fade
     in. A hide after the splash is gone does nothing. */
  "function again(){setTimeout(function(){hide('t400')},400);setTimeout(function(){hide('t1200')},1200)}",
  /* Build 1.0.2 (NATIVE_BUILD_QUEUE item 7): the shell's launch mark hands
     over once this document has parsed and painted two frames, so the mark
     leaves onto a drawn page, never onto navy. An older binary has no
     ValloShell plugin; the refusal is traced and changes nothing. */
  "function handoff(){try{var C=W.Capacitor;if(!C||!C.nativePromise||!(C.isNativePlatform&&C.isNativePlatform()))return;",
  "var r=C.nativePromise('ValloShell','handoff',{});m('handoff:sent');if(r&&r.then)r.then(null,function(){m('handoff:refused')})}catch(e){}}",
  "if(W.__nfLoud){var go=function(){requestAnimationFrame(function(){requestAnimationFrame(handoff)})};",
  "if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',go,{once:true});else go()}",
  "})();",
].join("");

export const STARTUP_SCRIPT = [
  "(function(){var D=document,W=window,d=D.documentElement,P='--nf-startup-door',N='startupNative',A='addEventListener',R='removeEventListener',T=setTimeout,X=clearTimeout,gone=0;",
  "var m=W.__nfMark||function(){};",
  "try{if(d.dataset.splash!=='on')return;",
  "var o=d.dataset.opening==='brief'?'brief':'full';d.dataset.opening=o;",
  "var len=o==='brief'?" + OPENING_BRIEF_MS + ":" + OPENING_FULL_MS + ";",
  "function on(f){var k=f?A:R;D[k]('pointerdown',skip,!0);D[k]('keydown',key,!0)}",
  "function soon(){X(gone);gone=T(free,len+" + STARTUP_RELEASE_MS + ")}",
  "function wake(){if(d.dataset[N]){delete d.dataset[N];m('wait:lifted');soon()}}",
  /* Release: lift the wait, pin the hold on what is timed from it, let go. */
  "function free(){X(gone);on();delete d.dataset[N];if(d.dataset.splash!=='on')return;",
  "var v=getComputedStyle(d).getPropertyValue(P).trim();",
  "D.querySelectorAll('[data-startup-pin]').forEach(function(n){n.style.setProperty(P,v||'0ms')});",
  "d.dataset.startup='open';d.dataset.splash='done';m('opening:done')}",
  /* A tap or a key: every running entrance to its end, then release. The tap
     itself is never swallowed; nothing covers what it lands on. */
  "function skip(){m('opening:skipped');delete d.dataset[N];try{D.getAnimations().forEach(function(a){try{var e=a.effect,t=e&&e.getTiming();if(t&&t.iterations!==Infinity)a.finish()}catch(x){}})}catch(x){}free()}",
  "function key(e){if(e.metaKey||e.ctrlKey||e.altKey||/^(Shift|Control|Alt|Meta|CapsLock|Fn)$/.test(e.key))return;skip()}",
  "on(1);m('opening:'+o);",
  /* On the shell, the arrival starts when the native splash is going. */
  "var h=W.__nfHide;if(h&&h.then){d.dataset[N]='wait';h.then(wake,wake);T(wake," + NATIVE_WAIT_MS + ")}else soon()",
  "}catch(e){try{delete d.dataset[N];d.dataset.startup='open';d.dataset.splash='done'}catch(x){}}})();",
].join("");

/**
 * THE GATE, DECIDED BEFORE PAINT, then the controller. The session mark is
 * written first and the opening switched on only once that write has
 * succeeded (audit A5): where storage refuses (a private window, blocked site
 * data) the opening does not play at all, rather than on every load.
 */
export const STARTUP_GATE_SCRIPT =
  "(function(){var W=window,d=document.documentElement,m=W.__nfMark||function(){};try{if(!sessionStorage.getItem('nf_entered')){sessionStorage.setItem('nf_entered','1');" +
  "var full=true;try{var l=+localStorage.getItem('nf_entered')||0;full=!(Date.now()-l<" + RETURNING_WITHIN_MS + ");localStorage.setItem('nf_entered',String(Date.now()))}catch(e){}" +
  /* Item 14 of the fast-start plan (2 November 2026): the app and a page the
     phone kept always get the brief opening. The full one is 600ms, longer
     than the half-second the app is meant to open in. The attribute is
     KEPT_MARK_ATTRIBUTE in lib/offline/page-cache.ts, written out because this
     script is a string run before anything is imported. */
  "try{if(/VALLO-NATIVE/.test(navigator.userAgent)||d.hasAttribute('data-vallo-kept'))full=false}catch(e){}" +
  "var still=false;try{still=W.matchMedia('(prefers-reduced-motion: reduce)').matches}catch(e){}" +
  "if(!still&&d.dataset.saveData!=='on'&&d.dataset.motionSplash!=='off'&&d.dataset.motion!=='calm'&&d.dataset.motion!=='off'&&!/^\\/(admin|auth|api|offline|open|s|r)(\\/|$)/.test(location.pathname)){d.dataset.splash='on';d.dataset.opening=full?'full':'brief'}" +
  "else m('opening:settled')}}catch(e){}})();" +
  STARTUP_SCRIPT;
