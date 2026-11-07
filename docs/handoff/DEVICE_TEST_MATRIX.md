# DEVICE TEST MATRIX (brief section 11, "Cross-Platform Testing")

Written 7 November 2026 by Agent NATIVE for build 1.0.2. Every check the
founder's brief lists in section 11, once per platform, marked by HOW it is
known today:

- **AUTOMATED HERE**: a test in this repository proves it on every run (the
  test is named). Source-level for native code: there is no Xcode and no
  Android SDK here, so Swift and Java are held to the installed Capacitor
  source, never compiled.
- **SIMULATED HERE**: run in Playwright's Chromium with a phone's viewport,
  user agent, touch, and CPU and network throttling, the native bridge
  stubbed. Chromium is close to Android's web view and NOT WebKit: an iPhone
  result is never claimed from it.
- **NEEDS A REAL DEVICE**: nothing here can tell. Steps for the founder's
  iPhone are at the foot; the Android steps are the same unless written.

The older 34-row matrix (`docs/VALLO_NATIVE_TEST_MATRIX.md`) keeps the
Observed and Result columns; the row numbers below (M1 to M34) point into it.
Nothing in this file has been run on a device.

## The matrix

| # | Check (brief section 11) | iOS | Android | What proves it now |
|---|---|---|---|---|
| 1 | Launch and splash screens | NEEDS A DEVICE (1.0.2: the ring draws in, the towers rise, the letters slide out, the version line, over by about 2.2 s) | NEEDS A DEVICE (1.0.2: the mark still on the system splash, then the letters slide out from behind it) | AUTOMATED: `lib/native/launch-sequence.test.ts` (layers, timings, ceilings, touch-transparent, Reduce Motion and animations off), `native-splash.test.ts`, `splash-hang.test.ts`, `shell-plugin.test.ts` (`handoff` asked for by the first script). SIMULATED: `handoff` is sent two frames after the document parses (job 2 check) |
| 2 | Navigation and bottom tabs | SIMULATED (the iOS push: in from the right, back slides off) | SIMULATED (fade-through about the tapped point) | AUTOMATED: `lib/platform/detect.test.ts` (platform marked before first paint, platform.css keyed on the shell only), `lib/motion/nav-direction.test.ts` (which way a move goes). SIMULATED: job 1 check reads the running animation names per platform, and Calm and reduced motion fall back. A device must judge the feel |
| 3 | Back-button behaviour | NEEDS A DEVICE: edge swipe back (1.0.2, `allowsBackForwardNavigationGestures`), M24 | NEEDS A DEVICE: hardware and predictive back, M23 | AUTOMATED: `lib/native/back-button.test.ts` (sheet first, step back, parent, exit only at a root), `native-back-event.test.ts`, `shell-plugin.test.ts` (swipe wired) |
| 4 | Safe areas and system bars | NEEDS A DEVICE (notch, home indicator, status bar glyphs per screen), M26, M27 | NEEDS A DEVICE (edge to edge on Android 15, SystemBars insets, light mode glyphs), NATIVE_BUILD_QUEUE item 2 | AUTOMATED: `status-bar-hold.test.ts`. SIMULATED: 390x844 and 360x800 screenshots with `viewport-fit=cover`, which Chromium does not inset, so only the layout is checked |
| 5 | Keyboard behaviour | NEEDS A DEVICE: composer on the keys, accessory bar, M22 | NEEDS A DEVICE: SystemBars pads for the IME (no adjustResize), budget phone, M22 | AUTOMATED: `lib/native/keyboard.test.ts` (the inset is the keyboard's height, the last event wins, a teardown never leaves the dock hidden). Keyboard sounds are the operating system's own: nothing in Vallo plays a sound per key (checked by reading `lib/native/keyboard.ts` and searching for audio) |
| 6 | Search and filters | SIMULATED | SIMULATED | SIMULATED: the performance audit loads live `/search` and `/stays/search` on both profiles and scrolls `/search` (PERFORMANCE_REPORT.md) |
| 7 | Property and accommodation browsing | SIMULATED | SIMULATED | SIMULATED: live `/listing/<id>` loads, the search to listing to search loop of 60 navigations with memory read every 10 (PERFORMANCE_REPORT.md) |
| 8 | Booking flows | NEEDS A DEVICE, TEST keys only (M21) | NEEDS A DEVICE, TEST keys only (M21) | AUTOMATED: the booking and money unit tests. A payment is never replayed by the outbox (`lib/offline/outbox.ts` kinds) |
| 9 | Deep links | NEEDS A DEVICE (Universal Links from Notes and WhatsApp, M10, M4) | NEEDS A DEVICE (App Links `verified`, M34) | AUTOMATED: `deep-links.test.ts`, `deep-link-readiness.test.ts` (association files, paths) |
| 10 | Push notifications | NEEDS A DEVICE (M11 to M13) | NEEDS A DEVICE (channels, small icon, M11 to M13) | AUTOMATED: `push-taps.test.ts` (a tap opens the exact screen) |
| 11 | Camera and location permissions | NEEDS A DEVICE (in context only, M14, M18, M19) | NEEDS A DEVICE (M14 to M19) | AUTOMATED: `ios-project.test.ts` (usage strings), `privacy-manifest.test.ts` |
| 12 | Scrolling and animations | NEEDS A DEVICE for feel; ProMotion 120 Hz cannot be simulated | SIMULATED on a 4x and 6x CPU throttle (dropped frames on `/search` and the feed) | SIMULATED: PERFORMANCE_REPORT.md scroll section; the ripple and press feedback (job 1 check) |
| 13 | Performance and application stability | NEEDS A DEVICE for WKWebView; the iPhone numbers here are Chromium's | SIMULATED (budget profile: 6x CPU and Fast 3G, 4x CPU and Slow 4G) | SIMULATED: PERFORMANCE_REPORT.md. AUTOMATED: native crash capture (`shell-plugin.test.ts`), the crash log's own tests |
| 14 | App switcher privacy (1.0.2) | NEEDS A DEVICE | NEEDS A DEVICE (Android 13+) | AUTOMATED: `shell-plugin.test.ts` (which screens are private, the shell told only on a change, no FLAG_SECURE) |
| 15 | Connection states (brief section 4) | SIMULATED | SIMULATED | AUTOMATED: `lib/offline/connection.test.ts` (connected, slow, unstable, offline, reconnected; the probe), `recent-kept.test.ts`. NEEDS A DEVICE: airplane mode and a dead data session (M2, M25) |

## The founder's iPhone, step by step (build 1.0.2 from TestFlight)

Allow about 40 minutes. Write what you saw beside each step; a screenshot or a
screen recording is the best evidence. Use Wi-Fi first, then mobile data for
steps 10 and 11.

1. **Launch.** Delete any older Vallo, install 1.0.2, open it. Expected: navy,
   then the Vallo ring draws itself round, the four towers rise one after
   another, the letters V A L L O slide down out from under the mark, a small
   "Version 1.0.2" appears at the foot, and the page arrives in its place with
   no white flash, all inside about two seconds. With Settings,
   Accessibility, Motion, Reduce Motion on, the finished logo only fades in
   and out. Tap the screen while the logo is showing: the tap reaches the
   page.
2. **Tabs and pages.** Tap each bottom tab: the page changes in a short fade.
   Tap a listing card in search: the card grows into the listing (that move
   is the same on both phones). Now tap a small link or an icon that opens a
   new page (a place name, the bell): the new page slides in from the right
   over the old one, which moves a little to the left and dims. Tap the
   round Back arrow: it slides off to the right.
3. **Edge swipe back.** On a listing, put a thumb on the left edge and drag
   right slowly: the page under it shows as you drag; let go past a third and
   you are back; let go early and you stay. It must not animate a second time.
4. **Press feel.** Press and hold a round icon button (search, menu): it dims
   while held. Press a settings row: it lights grey while held. Nothing ripples
   on an iPhone.
5. **Long press.** Long press any link or photo: no Safari preview card, no
   "Open in Safari" sheet. Text in a message can still be selected and copied.
6. **Bounce.** Pull a long page down past the top and up past the bottom: it
   rubber bands like any iPhone app, and nothing under the header shows a gap.
7. **App switcher cover.** Open the wallet (or a checkout), swipe up and hold
   to see the app switcher: Vallo's card shows the navy ground and the mark,
   not your balance. Go back to Home and do it again: the card shows Home.
8. **Status bar and safe areas.** In light and dark theme, on Home, a listing
   photo, the message viewer and a sheet: the time and battery are always
   readable, and nothing sits under the notch or the home indicator.
9. **Keyboard.** In a message thread, type, send, then swipe the keyboard
   down: the composer rides on the keys and the thread does not jump. In the
   listing form, Next moves to the next field.
10. **Weak signal.** On mobile data, open search, then turn on Airplane Mode
    and open a listing you have seen before: it opens from the phone with the
    line "Saved on your device. Price and availability may have changed." Open
    one you have never seen: the offline screen, with Recently viewed and your
    saved places. Turn Airplane Mode off: the screen comes back by itself
    within about 30 seconds without a tap.
11. **Deep links and push.** From Notes, tap a vallospaces.com listing link:
    it opens inside Vallo on that listing. Send yourself a message from a
    second account with Vallo closed: tap the notification and land in that
    thread.
12. **A crash is heard.** Only on a debug build from the lead: tap the hidden
    crash button once, reopen Vallo, then open `/admin/crashes` on the
    website: one row, platform ios, kind native.crash.

The Android steps are the same, with these differences: step 1 is the
mark, still, on the system splash, then the letters slide out from behind it
and the page arrives about a second after it is ready; step 2 is a quick
fade-through instead of a slide; step 3 is the system back gesture or button
(sheet closes first, then the page, and only the Home tab exits); step 4 is an
ink ripple spreading from under the finger on rows, buttons and icon buttons;
step 5 has no preview to check; step 6 is Android's own stretch at the edges;
step 7 needs Android 13 or later and shows a blank Recents thumbnail.
