/**
 * THE APP OPEN LOGO (founder ruling (a), 7 November 2026, replacing D68c;
 * refs/launch-animation-reference.png).
 *
 * A dark ground, the mark's ring drawing in and its four towers rising one by
 * one, then the wordmark sliding out from behind the mark letter by letter, a
 * small version line at the foot, and a smooth hand into the page: about 2.8s
 * from the artwork's first frame. The artwork is one animated file built from
 * the exact brand paths (`public/brand/launch/vallo-launch.svg`), so a load
 * that does not play it pays nothing for it.
 *
 * Decided before the first frame by this inline script, which:
 *
 *   plays    on the website AND on the native shell. On native, the overlay
 *            waits for the Capacitor splash to hide (`window.__nfHide`) before
 *            starting its clock, so the animation is not played beneath the
 *            native splash. The native splash is flat navy, the overlay's
 *            ground is the same colour, so the transition is seamless;
 *   plays    once per browser session (once per cold start on the shell), on
 *            the front doors only, never on a deep link into the site;
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
    "if(!force){if(!/^\\/(?:home|stays|sign-in|sign-up|start|welcome)?\\/?$/.test(location.pathname))return;" +
    "try{if(sessionStorage.getItem('nf_launch'))return;sessionStorage.setItem('nf_launch','1')}catch(e){return}}" +
    "var still=false;try{still=W.matchMedia('(prefers-reduced-motion: reduce)').matches}catch(e){}" +
    "var mo=r.getAttribute('data-motion');if(mo==='calm'||mo==='off'||r.getAttribute('data-save-data')==='on')still=true;" +
    "var el=d.createElement('div');el.className='nf-launch';el.setAttribute('aria-hidden','true');el.setAttribute('data-launch',still?'still':'play');" +
    "var img=d.createElement('img');img.alt='';img.className='nf-launch__art';img.width=2154;img.height=664;" +
    "img.src='/brand/launch/'+(still?'vallo-launch-still.svg':'vallo-launch.svg');" +
    "var p=d.createElement('p');p.className='nf-launch__version';p.textContent=" + v + ";" +
    "el.appendChild(img);el.appendChild(p);(d.body||r).appendChild(el);" +
    "var gone=0,t=0;function done(){if(gone)return;gone=1;clearTimeout(t);el.setAttribute('data-launch','leave');setTimeout(function(){if(el.parentNode)el.parentNode.removeChild(el)},450)}" +
    /* The clock starts when the artwork is drawn, not when it was asked for, with a ceiling for a load that never answers. On native, the clock waits for the Capacitor splash to hide first so the animation is not played beneath it. */
    "var armed=0;function arm(){if(armed)return;armed=1;el.setAttribute('data-ready','');clearTimeout(t);t=setTimeout(done,still?1200:2800)}" +
    "var started=0;function start(){if(started)return;started=1;if(img.complete)arm();else{img.onload=arm;img.onerror=done}}" +
    /* On native: wait for the splash hide promise so the overlay plays after the native splash, not beneath it. Ceiling of 600ms if the promise never settles. */
    "var h=W.__nfHide;if(h&&h.then){h.then(start,start);setTimeout(start,600)}else start();" +
    "t=setTimeout(done,4500);" +
    "W.addEventListener('pointerdown',done,{once:true,capture:true,passive:true});W.addEventListener('keydown',done,{once:true,capture:true});" +
    "}catch(e){}})();"
  );
}
