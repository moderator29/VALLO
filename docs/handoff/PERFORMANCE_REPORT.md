# PERFORMANCE REPORT: iOS AND ANDROID (Agent NATIVE, job 4)

Written 7 November 2026 for the founder's brief section 12 ("Deep
performance audit: iOS WKWebView and Android WebView").

## Read this first: every number here is SIMULATED

- No iPhone, no Android phone and no WebKit browser exist in this
  environment. Every number below comes from Playwright's desktop Chromium
  with Chrome DevTools Protocol CPU throttling and network shaping, a phone
  viewport, a phone user agent (with the shell's `VALLO-NATIVE` token) and
  touch.
- **Android**: Chromium is the same engine family as Android WebView, so the
  Android numbers are a fair simulation of the web layer. They are still not
  the hardware: GPU, thermal throttling, memory pressure and the system's own
  load are not modelled.
- **iOS**: WKWebView is WebKit, a different engine. The iPhone profile below is
  Chromium at iPhone size and speed. It says how much work the page asks for,
  not how WebKit does it. A real iPhone run (DEVICE_TEST_MATRIX.md) is the only
  iOS measurement that counts.
- The container's CPU was shared with other agents' production builds while
  these ran. Repeated readings of the same thing varied by up to about a fifth
  (the scroll test from 52 to 82 percent dropped frames on identical code), so
  only differences much larger than that are called findings.
- CPU calibration of this container: a fixed 30 million step loop took 257 ms.

## The instrument

Scripts are in the session scratchpad, CommonJS, run with node:

- `perf.js`: cold and warm loads, long tasks, bytes by type, scroll frames,
  and a 60-navigation memory loop.
- `bundle.js`: first-load JavaScript per route, from the build's client
  manifests.
- `flight.py`: the size of each route's server payload and its largest props.
- `trace-scroll.js` and `profile-scroll.js`: a main thread trace and a CPU
  profile during a scroll.
- `boot-waterfall.js`: the native runtime's start-up, with the bridge stubbed.

Copy them into `apps/web/scripts/` if they should become a gate.

Profiles:

| Profile | Stands for | Viewport | CPU | Network |
|---|---|---|---|---|
| android-budget-6x-fast3g | A 2 GB, 4-core phone on a poor signal | 360x800 at 2x | 6x slowdown | Fast 3G: 562.5 ms latency, 1.44 Mbps down, 675 kbps up |
| android-budget-4x-slow4g | The same phone on ordinary Lagos 4G | 360x800 at 2x | 4x slowdown | Slow 4G: 150 ms, 1.6 Mbps down, 750 kbps up |
| iphone-1x-slow4g | A recent iPhone size, Chromium engine | 390x844 at 3x | none | Slow 4G |

Routes:

- `local:` routes are this branch's production build (`.next-native`, port
  3200, no real Supabase key, so they render empty catalogues or the preview
  harness's fixtures).
- `live:` routes are www.vallospaces.com, which is main with real data and
  includes the proxy's round trip.

Definitions:

- Cold: a fresh context with no cache.
- Warm: the same context reloaded, so the HTTP cache is warm. A reload skips
  the service worker's instant answer by design, so warm here is the slow
  side of warm.
- First usable: first contentful paint, extended to the end of the last long
  task that starts before the main thread has been free for 3 seconds (a TTI
  in Lighthouse's spirit, from long tasks only).
- TBT: total blocking time.

## ANDROID (simulated)

### 1. Baseline

Budget phone, 6x CPU and Fast 3G. Times in ms, sizes in KB transferred.

| Route | FCP | LCP | First usable | TBT | Long tasks (longest) | JS | Images | Document | Total | Warm FCP | Warm usable |
|---|---|---|---|---|---|---|---|---|---|---|---|
| local /welcome | 3376 | 4844 | 6831 | 781 | 12 (487) | 250 | 64 | **224** | 678 | 1316 | 2508 |
| local / (the shell's front door) | 4200 | 4976 | 7220 | 430 | 7 (243) | 250 | 64 | 224 | 678 | 1256 | 2318 |
| local feed (fixtures) | 4716 | 6788 | 9500 | 1206 | 12 (475) | 379 | 112 | 237 | 981 | 1364 | 3152 |
| local home (fixtures) | 4424 | 6520 | 10644 | 1141 | 16 (421) | 357 | 320 | 239 | 1152 | 1360 | 3800 |
| local /offline | 2408 | none | 4254 | 300 | 5 (331) | 218 | 3 | 20 | 371 | 1108 | 1174 |
| live /search | 4756 | 7120 | 11379 | 866 | 9 (476) | 453 | 110 | 56 | 860 | 2272 | 4980 |
| live /listing | 4080 | 5608 | 13576 | 772 | 10 (372) | 529 | 139 | 44 | 945 | 1540 | 3691 |
| live /stays/search | 4548 | 6476 | 6374 | 315 | 10 (226) | 421 | 161 | 44 | 874 | 1540 | 6781 |

The same phone on Slow 4G (4x CPU):

| Route | FCP | LCP | First usable | TBT | Warm FCP | Warm usable |
|---|---|---|---|---|---|---|
| local /welcome | 1876 | 2280 | 3930 | 196 | 508 | 1429 |
| local feed (fixtures) | 2232 | 3740 | 5770 | 565 | 620 | 1837 |
| live /search | 3052 | 4244 | 6941 | 451 | 1416 | 3452 |
| live /listing | 2332 | 3464 | 6288 | 342 | 1252 | 2562 |
| live /stays/search | 2580 | 3508 | 5345 | 457 | 1568 | 2058 |

Scrolling. The mouse-wheel scroll gesture ran over 4,000 px (the touch-wheel
variant does not scroll in headless Chromium, so it was not used). The figure
is main-thread frames, from requestAnimationFrame, so it is the page's own
work. Chromium may still move the compositor's layer smoothly while the main
thread is late, so this is the pessimistic side.

| Page | 6x CPU: frames dropped | worst frame | long tasks during | 4x CPU: frames dropped | worst frame |
|---|---|---|---|---|---|
| live /search | **81 %** | 350 ms | 39 | **75 %** | 317 ms |
| local feed (fixtures) | 19 % | 150 ms | 4 | 14 % | 67 ms |

Memory. 60 navigations on live, search to a listing and back (in-app
navigation), 2x CPU, garbage collected before each reading:

| Navigations | 0 | 10 | 20 | 30 | 40 | 50 | 60 |
|---|---|---|---|---|---|---|---|
| JS heap (MB) | 9.3 | 12.6 | 14.4 | 14.6 | 14.8 | 14.9 | 15.0 |
| DOM nodes (all, live plus detached) | 2426 | 5243 | 7298 | 7287 | 7245 | 7288 | 7287 |
| Event listeners | 960 | 1516 | 1725 | 1733 | 1733 | 1733 | 1733 |

The heap and the node count rise for the first 20 navigations, while the
router's cache fills with the pages it keeps for Back, and then stay flat for
40 more: **no leak was found**. About 5,300 nodes are held outside the
document. That is the router keeping the previous pages, not orphans, since
the count stops growing.

JavaScript on first load, gzipped, from the build manifests:

| Route | Chunks | Raw KB | Gzip KB |
|---|---|---|---|
| /stay/[id] | 32 | 1143 | 346 |
| /listing/[id] | 31 | 1120 | 339 |
| /wallet | 27 | 1012 | 301 |
| /messages/[id] | 29 | 938 | 292 |
| /search | 28 | 865 | 271 |
| /around (the feed) | 27 | 834 | 262 |
| /home | 25 | 809 | 252 |
| /stays/search | 25 | 782 | 243 |
| /messages | 25 | 730 | 225 |
| /restaurants | 23 | 703 | 215 |
| /welcome | 13 | 318 | 101 |
| / | 13 | 250 | 81 |
| /offline | 11 | 232 | 72 |

The median route is 128 KB gzipped. The member layout alone, `(app)/layout`,
is 191 KB gzipped and is paid on every member page.

### 2. Bottlenecks found

1. **/welcome ships the whole dictionary to the browser: 202 KB gzipped of
   its 222 KB document** (674 KB raw). `app/welcome/page.tsx` passes `t` (every
   section of `@vallo/i18n`, admin and host desks included) to the client
   component `FirstRun`. FirstRun and its children read 5 sections, which are
   7 KB gzipped. This is the shell's front door for anybody signed out (`/` and
   `/open` land there), so on Fast 3G it costs about 1.1 s of download before
   the page is whole, plus parsing 674 KB of JSON on a slow CPU. It is the
   same on live: 220 KB gzipped document.
2. **/search scrolls at about a fifth of its frames on a budget phone.** The
   trace shows what the main thread does during the scroll (4x CPU):
   - commit 581 ms;
   - image decode about 1,040 ms in total (ImageDecodeTask, LazyPixelRef, Decode Image);
   - paint 367 ms;
   - style 203 ms;
   - layerize 198 ms;
   - layout 178 ms;
   - IntersectionObserver 165 ms.

   Turning off backdrop blur, the grain, the ambient layer, animations or
   shadows one at a time moved it by less than the noise. Hiding images moved
   it most (to about 56 to 61 percent). It is the sum of a long page (9,000 px,
   1,940 nodes, 48 images) more than one bad rule. Images are correctly sized
   (none over 1.3x the screen's density) and lazy.
   `content-visibility: auto` on the result rows was tried and made it worse.
3. **The Supabase browser client, 65 KB gzipped, is in the first load of 188
   routes** through the member layout, before any realtime is needed.
4. **libphonenumber with its full metadata, 39 KB gzipped, is in the first
   load of /listing/[id], /stay/[id], /bookings and the wallet pages.**
   ReservePanel imports `PhoneField` for the "booking for someone else" phone,
   a field most guests never open.
5. **A listing's map fetches tiles at four times the pixels it shows.**
   MapTiler `@2x` 512 px tiles are drawn at 256 CSS px, 1024x1024 each, about
   470 KB for four tiles. The free provider swap (founder ruling) is the moment
   to fix the tile size.
6. **A 56 KB PNG glyph** (`/brand/glyphs/empty-reviews.png`, 249 px, drawn at
   88 px) is on /search and every listing.
7. **The native runtime started its features one chunk at a time.** About
   fifteen dynamic imports awaited in series, so on the budget profile the
   last feature (deep links, with the hardware back button before it) was
   wired 0.7 to 1.0 s after the core had loaded, and up to 1.6 s after the
   page's load event.

### 3. Optimisations implemented (in Agent NATIVE's files)

- **The native runtime asks for every module at once**
  (`lib/native/boot.ts`). Each feature still starts in the same order (the
  splash first) and waits only for its own module, and a failure still costs
  only that feature. A `runtime:ready` boot mark now says when everything is
  wired.
- The platform layer (job 1) chose the cheaper transitions for Android:
  fade-through, transform and opacity only, about 330 ms in all. The ripple
  costs one rect, one style read and two compositor animations per press, and
  nothing while scrolling.
- The connection manager (job 3) probes only while the connection is bad and
  the page is visible, and reads request timing from a passive
  PerformanceObserver: no polling on a healthy connection.

Everything else in the list above is in a component or a page, and is sent to
the lead as a request with its measurement (section 5).

### 4. Final measurements (after)

| Native start-up, bridge stubbed, 6x CPU, Fast 3G | Before | After |
|---|---|---|
| Core loaded to every feature wired | 0.7 to 1.0 s (last runtime chunk, 2 runs) | 63 to 76 ms on /offline, 180 to 240 ms on a harness page (`runtime:ready`, 5 runs) |
| Every feature wired, relative to the page's load event | 1.3 to 1.6 s after load | before load on /offline (3.6 to 3.8 s against 4.3 s) |

The page loads are unchanged by this job's edits, and they are not repeated
here. The bottlenecks that would move them are the requests in section 5;
their numbers will be measured with the same instrument when the lead lands
them.

**Memory before and after**: unchanged, and stable (above).

**Startup before and after**: the shell's own start-up as in the table; the
first screen is the request list.

### 5. Requests to the lead (component files), with the measurement

1. `app/welcome/page.tsx` and `components/app/welcome/FirstRun.tsx`,
   `InterestChoices`, `ArrivalAsks`: pass only the sections they read
   (`common`, `interests`, `onboardingMotion`, `shape`, `welcomeCards`, plus
   whatever the two children read) instead of `t`. This saves about 195 KB
   gzipped (667 KB raw) on the shell's front door (bottleneck 1). Grep the
   other `t={t}` props into client components the same way.
2. `app/(app)/listing/[id]/ReservePanel.tsx` (and the stay panel): load
   `PhoneField` with `next/dynamic` only when "booking for someone else" is
   chosen. This saves 39 KB gzipped of first load on listing, stay, bookings
   and wallet (bottleneck 4).
3. The member layout's realtime: import `@/lib/supabase/client` inside the
   effects that open channels, after first paint, not at module top. This
   saves 65 KB gzipped of first load on 188 routes (bottleneck 3).
4. The listing map: tiles at the size they are drawn (bottleneck 5),
   about 350 KB per listing view.
5. `public/brand/glyphs/empty-reviews.png`: an SVG, or a 176 px WebP, about
   50 KB saved on search and every listing (bottleneck 6).
6. Search scrolling (bottleneck 2): the next measurements should be a lighter
   card on budget Android (`data-motion-lite` already marks phones with 2 GB
   or 2 cores; the card's shadows and the photo carousel's second image could
   wait for the row to settle), each measured with `trace-scroll.js` before it
   is kept.

### 6. Devices and environments

Playwright Chromium (headless), Linux container, CDP throttling as in the
profile table. No Android device and no Android WebView build were used.

### 7. Remaining limitations

- Real WebView start (the process, the bridge, the first navigation from the
  native side) cannot be measured here at all.
- GPU raster, thermal state and memory pressure are not modelled.
- The 6x CPU figure stands for a slower phone than the container. It is a
  ratio, not a named device.
- Live numbers include this environment's proxy.

## iOS (simulated, and much less faithful)

### 1. Baseline

Chromium at iPhone size, no CPU throttle, Slow 4G.

| Route | FCP | LCP | First usable | TBT | JS | Images | Document | Total | Warm FCP | Warm usable |
|---|---|---|---|---|---|---|---|---|---|---|
| local /welcome | 1596 | 2352 | 3539 | 19 | 250 | 99 | **224** | 713 | 356 | 1286 |
| local feed (fixtures) | 2216 | 3816 | 5038 | 14 | 379 | 119 | 237 | 1000 | 568 | 1401 |
| local home (fixtures) | 2216 | 8544 | 8188 | 491 | 357 | 365 | 239 | 1227 | 760 | 1628 |
| local /offline | 1180 | none | 2377 | 1 | 218 | 3 | 20 | 371 | 444 | 444 |
| live /search | 3332 | 4712 | 6679 | 87 | 453 | 234 | 56 | 982 | 1228 | 1773 |
| live /listing | 2440 | 3420 | 4264 | 49 | 571 | 241 | 44 | 1100 | 1200 | 2312 |
| live /stays/search | 2532 | 4080 | 4012 | 16 | 522 | 208 | 44 | 1019 | 1516 | 1812 |

Image bytes are higher than Android's because the iPhone profile is 3x
density: the image optimiser rightly serves larger widths.

Scrolling, main-thread frames (no CPU throttle):

| Page | Frames dropped | Worst frame |
|---|---|---|
| live /search | 37 % | 183 ms |
| local feed (fixtures) | 7 % | 100 ms |

Memory over 60 navigations: 9.2 MB to 15.4 MB, nodes 2,426 to about 9,100.
It is flat after 20 navigations apart from one reading at 50 (10,861 nodes)
that fell back by 60. No leak was found; WKWebView's own memory accounting is
not visible here.

### 2. Bottlenecks found

The page-side bottlenecks are the Android list, which is the same web layer,
in the same order of size. Two of them matter more on an iPhone:

- **The /welcome dictionary** (202 KB gzipped). An iPhone's CPU parses it
  quickly, but on Slow 4G it is still about 1 s of download on the first
  screen.
- **The listing map tiles at 4x.** On a 3x screen the same 1024 px tiles are
  still at least twice what is drawn.

Specific to the shell:

- **The launch.** Before 1.0.2 the iPhone shows a flat navy field until the
  first page has painted. 1.0.2 draws the exact mark and wordmark during that
  wait (job 2) and never holds the screen past 3 s. It does not make the page
  arrive sooner; it makes the wait Vallo's.

### 3. Optimisations implemented

- **The native runtime's parallel start-up** (`lib/native/boot.ts`), as on
  Android. On iOS it means the status bar, the keyboard foot, the push taps
  and the deep links are wired sooner after launch.
- **Edge swipe back** (job 2, build 1.0.2). It is WebKit's own snapshot, so
  it costs the page nothing, and the App Router runs no second animation on
  the `popstate`.
- **The iOS push transition** (job 1): two full-screen snapshots on the
  compositor, transform and opacity only.

### 4. Final measurements

The same start-up table as Android applies to the web layer's side. There
are no WKWebView measurements: none are possible here.

### 5. Requests

The same five requests as Android. They are web-layer savings on both phones.

### 6. Devices and environments

Chromium only. No iPhone, no Simulator, no WKWebView.

### 7. Remaining limitations

Everything WebKit-specific is unmeasured:

- WKWebView's process start;
- its own image decoding and memory limits (the web content process can be
  ended under pressure; Capacitor reloads it);
- ProMotion's 120 Hz;
- Safari's scroll anchoring.

The founder's iPhone run in DEVICE_TEST_MATRIX.md (steps 1, 2 and 6) is the
first real iOS measurement this project will have.
