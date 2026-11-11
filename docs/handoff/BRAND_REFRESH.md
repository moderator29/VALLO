BRAND REFRESH AND OPENING SCREEN

Date: 10 November 2026. Founder: "make our logo more polished, bright, clean, it looks dull; and the app opening screen, we can't see it". Before and after: docs/handoff/BRAND_REFRESH_BEFORE_AFTER.png.

WHY THE OPENING WAS BLANK (read from the filmed frames and the code; not measured on the device)

1. iOS shows its own snapshot between the tap and the first page. The app declared no apple-touch-startup-image, so that snapshot is blank navy (the manifest background colour).
2. The earlier "opening" (D68c, components/startup/startup-script.ts) is deliberately logo-free: it animates the header and dock arriving. It draws no mark, so there was nothing to see by design.
3. The website launch layer (components/motion/launch-script.ts) is created by script after the body has parsed, and its picture is invisible until a 2154 x 664 animated SVG has been fetched and starts from an empty frame. It also never plays on the native shell.
4. On an installed app the service worker opens the last screen from the phone at once and marks it data-vallo-kept. app/css/passcode.css then hides the page content (visibility hidden) until PasscodeGuard has hydrated and decided (data-guard-ready), while the header and dock are outside that wrapper and show at once. Result in the film: blank navy, then half the chrome, then the Face ID lock.
Nothing was drawn during any of those steps.

WHAT CHANGED

Logo and icons (same identity, bars-and-city mark, higher-luminance blues, stronger gloss, lighter shaded face):
- scripts/brand/logo-art.mjs: palette lifted (low blue was #1238C8, now #2455F2; cyan #5BE7FF; orange #FFB25E to #F96B28; sheen 0.22 to 0.34).
- scripts/build-brand-logo.mjs: icon ground is the brand navy (this line said "bright" between 10 and 11 November; see the reversal below). Run with BRAND_SKIP_NATIVE=1 to leave the store binaries' icons alone (that is how this was run; the Android notification vector ic_stat_vallo.xml was still rewritten, the app icons in android/ and ios/ and assets/ were not).
- Rewritten at the SAME paths: public/brand/vallo-mark(.svg/.png), vallo-wordmark, the -light copies, vallo-logo.png, vallo-icon.png (1024 master), vallo-email-lockup.png, startup/*.webp, session-b/signin/lockup.webp, welcome coin face, launch/*.svg (palette lifted), favicon.ico (16, 32, 48), pwa/icon-16/32/48/64/192/512, apple-touch-icon.png (180), icon-maskable-512.png, native-shell/vallo-mark.svg, src/lib/brand/logo-geometry.ts and og-logo.ts (generated).
- src/app/offline/SystemFrame.tsx: SVG wordmark and the small plate (weight, see below).
- Not rerun: scripts/build-og-image.mjs (needs the next package on its path); the share card og image still has the old palette.

ICON CHOICE: REVERSED ON 11 NOVEMBER 2026 BY THE FOUNDER. See docs/handoff/NATIVE_ICONS.md.

The choice made here was the full-colour mark on a near-white tile (white to pale blue), reasoning that a navy tile sinks into a dark home screen and reads dim next to WhatsApp, Gmail and Instagram. That reasoning was not the founder's to assume: Vallo is dark first, the launch field, the splash and the app's own background are all #010118, and the white tile broke that line the moment it reached TestFlight (build 10002418). The icon is the full-colour mark on the brand navy, lifted by a soft radial toward #0B1C5C so the tile has depth rather than reading flat black. The maskable icon uses that same tile with the mark inside the 80 per cent safe circle (tested by pixel).

The bright ground is GONE from scripts/build-brand-logo.mjs, not merely unused: the flag, both constants and the branch were deleted, so a future regeneration cannot bring it back by accident. The one surface still bright is the Open Graph share card, on purpose, because an unfurled link sits on a white chat or timeline rather than a home screen.

Cache busting: src/lib/theme/brand-assets.ts (ICON_VERSION 20261111 after the 11 November reversal, 20261110 before it) adds ?v= to the manifest icons, favicon and touch icon links and the launch images; public/sw.js CACHE_VERSION v8 to v9, then v10 on 11 November so an installed PWA drops the cached white icon (tests updated).

Opening screen (this REVERSES D68c, the rule that the logo never appears alone on open; the founder asked for it on 10 November):
- src/components/startup/open.css (render-blocking stylesheet, tokens only), OpeningScreen.tsx (inline SVG mark in the first HTML, first in body), open-script.ts (controller, in the head), OpenReady.tsx (hydration flag), open-mark.generated.ts (generated mark), wired in app/layout.tsx.
- Shows only in an installed app (display-mode standalone, or iOS navigator.standalone) opened cold (first load of the session); never in a browser tab, never on the native shell, not on a warm open.
- The mark is on screen from the first frame (no script, no image request). Entrance 520ms (scale 0.96 to 1, opacity 0.82 to 1), then a slow drift to 1.04.
- Timing: at least 1,100ms from the first animation frame (900ms under reduced motion, Calm, Off); then it lifts as soon as the client has hydrated and, on a page behind the passcode guard, the guard has decided or the lock is drawn; never later than 2,200ms; crossfade 320ms. With no script at all the stylesheet lifts it by 2,500ms.
- Reduced motion and the in-app Calm and Off settings: no movement, the still mark for 900ms, then a fade.
- The older website launch layer does not play under it (launch-script.ts checks data-open).
- Deviation from the brief: the first-paint CSS is an external render-blocking stylesheet, not an inline style element, because the Content Security Policy allows no style element and a test holds it there.
- iOS launch images: public/pwa/launch/launch-<w>x<h>.png (1170x2532, 1179x2556, 1206x2622, 1290x2796, 1320x2868), linked through metadata appleWebApp.startupImage (src/lib/brand/launch-images.ts, generated by scripts/build-brand-launch.mjs). Same ground, mark at 36 per cent of the width centred at 46 per cent of the height, as the page paints, so the hand-over does not move.

WEIGHT (public routes, cold 390x844, scripts/check-weight.mjs, local production build). Root cause of the red gate: the offline/system frame (SystemFrame.tsx) is mounted in every page's DOM and drew a 43 KB PNG wordmark, a 25 KB wave plate and the 192 icon; it now draws the SVG wordmark, the 7 KB plate and a palette-coded 4 KB icon. The opening itself adds about 1.5 KB gzipped (4 KB inline SVG, once in the HTML and once in the flight data, plus about 1 KB of CSS and a 1.4 KB script); the launch images are 5 link tags and are fetched by iOS only. After: / 522, /welcome 478, /sign-in 434, /sign-up/email 431, /check 418, /move-in-cost 440, /for-agents 436, /guides/avoiding-rental-scams 437, all ok; /docs/quick-start 453 against 435 is still over (its own client chunks FeeCalculator, DocHelpful, DocToc and DocsSidebar are about 19 KB; not the brand work).

TESTS: open-script.test.ts, open-css.test.ts, OpeningScreen.dom.test.tsx (Chromium: mark in first paint, minimum visibility, cap, reduced motion, guard), src/lib/brand/icons.test.ts (every icon exists at its stated size from the PNG header, favicon.ico, launch images, maskable safe zone, bright ground).

WHAT THE FOUNDER MUST DO: an installed web app keeps its old home-screen icon and its old launch image until it is deleted and added again from Safari (Share, Add to Home Screen). iOS caches both per install. The new in-page opening screen arrives with the next deployment without re-adding.

NOT VERIFIED WITHOUT A DEVICE: how iOS picks and shows the launch image (it can ignore it on a first launch after install and when the media query does not match exactly), real hydration time on the founder's phone, and the standalone display-mode detection inside a home-screen app (covered in Chromium with an emulated media query only).
