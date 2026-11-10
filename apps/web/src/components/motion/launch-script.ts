/**
 * THE APP OPEN LOGO ON THE WEBSITE (founder ruling (a), 7 November 2026,
 * replacing D68c; refs/launch-animation-reference.png).
 *
 * A dark ground, the mark's ring drawing in and its four towers rising one by
 * one, then the wordmark sliding out from behind the mark letter by letter, a
 * small version line at the foot, and a smooth hand into the page: about 2s
 * from the artwork's first frame. The artwork is one animated file built from
 * the exact brand paths (`public/brand/launch/vallo-launch.svg`), so a load
 * that does not play it pays nothing for it.
 *
 * Decided before the first frame by this inline script, which:
 *
 *   never plays on the native shell (`data-native`, a native Capacitor, or
 *            the shell's user agent): Agent NATIVE's launch hand-off plays
 *            there, and the logo must never play twice;
 *   plays    once per browser session, on the website's front doors only
 *            (the home pages and the sign-in and sign-up screens), never on a
 *            shared link deep into the site;
 *   fades    instead of moving when the system asks for less motion, or the
 *            in-app Motion setting is Calm or Off, or data saving is on: the
 *            still lockup, faded in and out (`vallo-launch-still.svg`);
 *   never blocks a tap: the layer takes no pointer events, and the first
 *            touch or key sends it away at once.
 *
 * `?launch=1` forces it on any page, for the preview harness.
 */
export function launchScript(version: string): string {
  const v = JSON.stringify(`Version ${version}`);
  return (
    "(function(){try{var d=document,r=d.documentElement,W=window;" +
    "var force=/[?&]launch=1(?:&|$)/.test(location.search);" +
    "if(r.getAttribute('data-open')==='on'||r.hasAttribute('data-native')||(W.Capacitor&&W.Capacitor.isNativePlatform&&W.Capacitor.isNativePlatform())||/VALLO-NATIVE/.test(navigator.userAgent))return;" +
    "if(!force){if(!/^\\/(?:home|stays|sign-in|sign-up|start|welcome)?\\/?$/.test(location.pathname))return;" +
    "try{if(sessionStorage.getItem('nf_launch'))return;sessionStorage.setItem('nf_launch','1')}catch(e){return}}" +
    "var still=false;try{still=W.matchMedia('(prefers-reduced-motion: reduce)').matches}catch(e){}" +
    "var mo=r.getAttribute('data-motion');if(mo==='calm'||mo==='off'||r.getAttribute('data-save-data')==='on')still=true;" +
    "var el=d.createElement('div');el.className='nf-launch';el.setAttribute('aria-hidden','true');el.setAttribute('data-launch',still?'still':'play');" +
    "var img=d.createElement('img');img.alt='';img.className='nf-launch__art';img.width=2154;img.height=664;" +
    "img.src='/brand/launch/'+(still?'vallo-launch-still.svg':'vallo-launch.svg');" +
    "var p=d.createElement('p');p.className='nf-launch__version';p.textContent=" + v + ";" +
    "el.appendChild(img);el.appendChild(p);(d.body||r).appendChild(el);" +
    "var gone=0,t=0;function done(){if(gone)return;gone=1;clearTimeout(t);el.setAttribute('data-launch','leave');setTimeout(function(){if(el.parentNode)el.parentNode.removeChild(el)},320)}" +
    /* The clock starts when the artwork is drawn, not when it was asked for, with a ceiling for a load that never answers. */
    "function arm(){el.setAttribute('data-ready','');clearTimeout(t);t=setTimeout(done,still?900:1700)}" +
    "if(img.complete)arm();else{img.onload=arm;img.onerror=done}t=setTimeout(done,3200);" +
    "W.addEventListener('pointerdown',done,{once:true,capture:true,passive:true});W.addEventListener('keydown',done,{once:true,capture:true});" +
    "}catch(e){}})();"
  );
}
