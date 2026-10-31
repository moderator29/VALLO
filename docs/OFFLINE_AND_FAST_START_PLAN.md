# Fast start and weak network: the plan for 1.0.1 and after

Written 31 October 2026 from a read-only audit of the repo (HEAD 221327bd0). The founder's goal: the app opens in under 0.5 s with or without network, saved screens always show something real, and the app behaves on a poor connection the way X does. This is the working plan for the next session (see `docs/NEXT_SESSION_PROMPT.md`).

## The two start paths

1. **Returning member with a kept page (fast).** The service worker (`apps/web/public/sw.js`) turns `/open` into a local redirect to the kept `/home` and answers instantly. The splash comes down at the first inline script of the head.
2. **Everything else (slow).** First install, an evicted cache, a reload, Save-Data or 2G, or a kept copy older than 7 days. This is the full network chain: `/open` (proxy, claims check, 307), then `/home` (proxy again, `shell_context` RPC, `passcode_status`, six uncached reads) before a skeleton can stream. The server region is `dub1` and nothing server-side is cached. The splash is not timer-based (`capacitor.config.ts` `launchAutoHide:false`), so splash time is network time on this path.

## Why the app is 2.7 MB

The native app is a thin Capacitor shell that loads the live site (`server.url`), plus phone features (push, Face ID, share). That is deliberate: web fixes reach every user at once with no store review. A bundled local copy of the web app is not possible without a rewrite: 206 files use `"use server"`, there are 51 API routes, the auth gate is `proxy.ts` with a per-request CSP nonce, and session cookies cannot reach a `capacitor://localhost` origin. The service worker also cannot run on a custom-scheme origin, and on iOS it works only because of app-bound domains (`Info.plist`, 7 of 10 used).

## Decision

- **1.0.1: stay remote and harden.** Web items first (no store release), plus two native changes (network detection, version bump).
- **1.1: a local launch frame, not a local app.** A packaged `native-shell/open/index.html` paints the real header and dock and a snapshot of the last Home cards, unread count, saved list and inbox rows (written by the web layer into `@capacitor/preferences`), then `location.replace` to the live origin. Build it only if the 1.0.1 numbers show first-launch and evicted-cache launches matter.
- **2.0, only if Apple's rule 4.2 or the metrics demand it:** a client-rendered core (Home, Search, Saved, Messages) as a static bundle on a token-authenticated `/api/v1`. Large, several releases.
- Do not build an Android asset interceptor first: it helps only the first launch after install, on Android only, and hashed filenames change every deploy.

## The 25 improvements, ranked

Value H/M/L, effort S/M/L, risk. "Web" = no store release. "Native" = needs a build.

| # | What | Val | Eff | Risk | Main files | Ship |
|---|---|---|---|---|---|---|
| 1 | **Measure real cold start**: a `cold` flag, native start to splash hidden, first paint, into the vitals beacon. No number exists today | H | S | low | `components/startup/startup-script.ts`, `lib/native/boot-trace.ts`, `components/app/VitalsReporter.tsx`, `/api/vitals` | Web |
| 2 | **Allow the instant answer on weak, 2G and Save-Data links** (today those people wait up to 1200 ms): skip only the background refresh | H | M | med | `public/sw.js:316,943-956`, `ConnectionLine.tsx` | Web |
| 3 | **Close the first-install gap**: warm `/home`, `/search`, `/messages`, `/profile` and the third tab into the service worker right after the first `controllerchange` | H | S | low | `KeepWarm.tsx`, `lib/nav/tab-warm.ts`, `ServiceWorkerRegistrar.tsx` | Web |
| 4 | **Unblock `/home`'s first byte**: stream every shelf behind Suspense; cache non-personal catalogue reads with a short TTL | H | M | med | `app/(app)/home/page.tsx`, `HomeStreams.tsx`, `lib/app/home-queries.ts` | Web |
| 5 | **Take database work off the document path**: skip `detailIsMissing` for warm requests and signed-in users; run it beside the render | M | S | low | `proxy.ts:836,959,975` | Web |
| 6 | **Queue the remaining cheap writes** (like, repost, follow, story mark, mark-read) as new idempotent outbox kinds; remove the per-like `router.refresh()`; wrap calls in try/catch | H | M | low-med | `lib/offline/outbox.ts`, `OfflineTray.tsx`, `Feed.tsx`, `FollowButton.tsx`, `StoryViewer.tsx` | Web |
| 7 | **One action wrapper with a deadline** (`callAction`) built on `withTimeout`, with an honest "could not reach Vallo, retry" state; migrate the remaining no-catch `startTransition(async ...)` handlers in batches | H | M | low | `lib/media/upload.ts`, new `lib/actions/call.ts` | Web |
| 8 | **Stop paying twice**: drop or make conditional the post-navigation document warm, cap the 5-tab prefetch, delay the instant-open `router.refresh` | H | M | med | `ServiceWorkerRegistrar.tsx`, `sw.js:1212`, `KeepWarm.tsx`, `ConnectionLine.tsx` | Web |
| 9 | **Say how old a saved screen is** ("Saved 2 h ago"), with tap and pull to refresh | M | S-M | low | `sw.js`, `page-cache.ts`, `ConnectionLine.tsx` | Web |
| 10 | **Fix the start chain**: `home-or-landing` to local claims check; consider rewriting `/open` for signed-in sessions to save a round trip | M | S/M | low/med | `app/home-or-landing/route.ts:54`, `app/open/route.ts` | Web |
| 11 | **Asset cache hygiene**: byte cap, prune unreferenced chunks, `navigator.storage.persist()` | M | S-M | low | `sw.js:1078-1094,850-882` | Web |
| 12 | **Images**: blur or dominant-colour placeholders (none exist across 71 `next/image` and 49 `<img>`), byte-capped LRU, keep the first photo of saved listings offline | M | M | low | `CardPhotos.tsx`, `lib/offline/shelf.ts`, `sw.js:1132` | Web |
| 13 | **Weigh and cut CSS** (849 KB of source imports on every route) and fill the null signed-in weight budgets | H | M-L | med | `app/globals.css`, `perf-budget.json`, `scripts/check-weight.mjs` | Web |
| 14 | **Trim the opening**: always the 400 ms brief opening in the shell and on kept copies (the 600 ms full opening already exceeds the target) | M | S | low | `startup-script.ts`, `startup.css` | Web |
| 15 | **Offline unlock** for passcode members (today an offline cold start shows the lock screen with no way in); needs a security review | M | M-L | high | `PasscodeGuard.tsx`, `docs/PASSCODE.md:160` | Native + web |
| 16 | **True connectivity** with `@capacitor/network` (`navigator.onLine` lies behind captive portals) | M | S-M | low | `lib/native/boot.ts`, `lib/offline/use-offline.ts` | Native |
| 17 | **Snapshot and outbox in native storage** (`@capacitor/preferences`) and a packaged launch frame (the 1.1 plan) | H | M-L | med | new `lib/native/snapshot.ts`, `native-shell/open/index.html` | Native |
| 18 | **Device-verify the service-worker instant path** on iOS and Android (including whether the SW `fetch` fires for the main document on Android Capacitor); add it to the test matrix | H | S | low | `docs/VALLO_NATIVE_TEST_MATRIX.md` | Native test |
| 19 | **WebView warm-up experiments** after item 1 shows the native share of launch time | M | M | med | `MainActivity.java`, `AppDelegate.swift` | Native |
| 20 | **Release plumbing**: bump to 1.0.1 (`android/app/build.gradle`, Xcode project), `cap sync`, airplane-mode cold start on both checklists | M | S | low | `docs/VALLO_*_RELEASE_CHECKLIST.md` | Native |
| 21 | **Static-ish public pages** (`/welcome`, sign-in, landing): move cookie and nonce reads out of the root layout or use PPR | M | L | high | `app/layout.tsx:310-320`, `proxy.ts` | Web |
| 22 | **A closer edge**: region is `dub1`; check where `proxy.ts` runs; cache public HTML at the CDN | M | M | med | `vercel.json`, `proxy.ts` | Web |
| 23 | **Android bundled-asset interceptor prototype**, only if item 1 data shows first-launch pain | L-M | L | high | `MainActivity.java` | Native |
| 24 | **Fix stale comments** (`capacitor.config.ts` says 40 server-action files, it is 206; `lib/offline/shelf.ts` says the SW does not cache images; middleware vs `proxy.ts`) | L | S | none | those files | Web |
| 25 | **Client-rendered core on token auth** (the 2.0 option); decide after 1, 17 and 18 | H long | L | high | `proxy.ts`, new `/api/v1` | Native |

Anything that changes `public/sw.js` must bump `CACHE_VERSION` (currently `v6`) and update `src/lib/offline/sw-*.test.ts`.

## Suggested order for the next session

1. **Measure first** (item 1) and fix the stale comments (24).
2. **Web wave 1:** 3, 2, 14, 10, 5, 7, 6, 9, then 8 and 4.
3. **Web wave 2:** 11, 12, 13, then 22 and 21 if the numbers justify them.
4. **Native 1.0.1 (once 1.0.0 is approved):** 16, 20, the push-notification setup below, and item 18 as the gate for the launch frame (17).
5. Report real cold-start numbers (P50 and P90, kept versus network, per OS) and what could only be proven on a device.

## Native 1.0.1 must also fix: push notifications on iPhone

The App Store Connect build page for 1.0.0 lists these entitlements only: `application-identifier`, `get-task-allow:false`, `beta-reports-active:true`, `com.apple.developer.team-identifier`. There is **no `aps-environment`**, which is what lets an iPhone receive push (and so incoming-call alerts). Enable **Push Notifications** on the App ID `com.vallospaces.app` in the Apple Developer account, regenerate the provisioning profile, rebuild, and confirm `aps-environment` appears in the build's entitlements. This cannot go into 1.0.0 while it is in review.

## Unverified (needs a device or a build)

- Whether the SW `fetch` event fires for the main document in Android Capacitor.
- Whether a thrown server-action network error reaches the error boundary.
- Whether Next 16 `proxy.ts` runs at the edge or in `dub1`.
- Real shipped CSS and JS sizes (run `npm run check:weight`).
- Whether the iOS build now on the store includes app-bound domains (changed 8 October 2026; needs a native rebuild).
