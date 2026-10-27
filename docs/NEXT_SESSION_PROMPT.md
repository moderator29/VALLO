# Next session: the platform-wide polish and launch-readiness brief

Written 27 October 2026 for the next session, at the founder's request. Read `HANDOFF.md` first (who Seyi is, how he works, product rules, gates, how database work is done), then `apps/web/AGENTS.md`, then this file. Where this file and `HANDOFF.md` disagree, **this file wins for this session** (it overrides the "run agents in parallel" advice).

## Paste this to start the session

> You are the lead engineer for Vallo. Read `HANDOFF.md`, `apps/web/AGENTS.md` and `docs/NEXT_SESSION_PROMPT.md` in full, then do the work in that file from top to bottom, on your own, until it is finished. Use ONE agent in total (you). Do not start sub-agents. Apply every database change yourself through the Supabase connector. Audit every piece of work twice before you commit it. When an area is finished, double-audited and its gates pass, push it to `main` and check the production deploy. Do not stop to ask me things you can decide; give me a short status after each area. Where something cannot be tested here (no phone, no live calls), say so plainly and write down exactly what I must test.

## 0. The rules for this session (from the founder)

1. **One agent only.** No sub-agents, no parallel agents, no workflows. One engineer, working through the list in order.
2. **Fully autonomous.** Decide, build, verify, move on. Seyi pays personally and is on a small plan, so waste nothing: no long narration, no re-reading what you already know, no questions with an obvious answer. Recommend and act.
3. **Run all the database work yourself.** First check the connector is signed in to the right account (`list_projects` must show `uccixoonmbhrnyczyigt`). If it is not authorised, say so in one line and tell Seyi to re-authorise it in claude.ai connector settings, then continue with everything else. Pending SQL to apply (each is a draft in `docs/sql-editor/`):
   - `03-messages-body-length.sql` (adds a 4,000 character check on `messages.body`, `not valid`, then validate in a second step).
   - `01-cleanup-now.sql` and `02-health-check-read-only.sql` (read them first; the connector hangs on `DELETE` and `DROP`, so if one hangs, say so and keep the file for Seyi).
   - Any migration you write: small chunks, `set lock_timeout = '5s';`, `$fn$` quoting, save the same SQL as `supabase/migrations/<version>_<name>.sql`, then `node scripts/check-migrations.mjs --record`.
4. **Double audit before every commit.** Pass 1: build and run it, run the gates and the tests for the area. Pass 2: read your own diff adversarially ("what would make this wrong on a phone, an iPad, a Mac, slow data, light mode, dark mode, a screen reader?"), then re-run. Only then commit. Say "tested" only for what you ran.
5. **Verify visually.** Chromium and Playwright are installed (`require('playwright')`, no install). For every page you touch, screenshot at 390, 820, 1180, 1440 and 1920 px wide, in light and dark, and look at the pictures. A page is not done until it looks right at all five.
6. **Push to `main`** after each finished, double-audited area (the founder asked for this in his brief). No pull request unless asked. Check the production deploy on https://www.vallospaces.com after each push (the GitHub status API returns 403 here; check the live site, e.g. a changed file's content).
7. **No em dashes** anywhere. Gates (`apps/web/scripts/check-no-em-dash.mjs`, `check-valuation-words.mjs`, `check-css-tokens.mjs`, `scripts/check-migrations.mjs`) and `npx tsc --noEmit` must pass. Known baseline tsc errors only in `components/calls/media/session.ts` and `.next/types/validator.ts`.
8. **Never print, log or commit a credential.** Credentials pasted in chat earlier must be rotated by Seyi.
9. **Sandbox limits.** No real device, and MapTiler, Payluk, LiveKit and Termii are unreachable from here. Write code and tests to the best of your knowledge, and list what only a device can prove.

## 1. What is already done and live (do not redo)

State of `main` after 27 October 2026:

- Apple 5.1.1(v) fix: the welcome screen has "Look around first" (public browsing). iOS 1.0.0 was resubmitted 25 October 2026 and is Waiting for Review. Google Play is live. Web changes go live without a store build; native changes need a build and a release.
- Search fields: no focus ring, halo or border change anywhere (`controls.css` skips `[type="search"]`, search wrappers neutralised, unlayered rule in `base.css`; tests in `src/app/css/text-field-focus.test.ts`). **Cascade rule you must know:** component CSS is in `@layer components`; the generic focus ring in `base.css` is deliberately unlayered, so it beats every layered rule. A fix must be unlayered and later in source order, or more specific in the same layer.
- Badge moment: vector `BadgeMedal`, "View on my profile" button, `#badges` anchor.
- Bottom dock: the old tab turns fully off while a new one loads (`shell-m.css`), and a tap that never lands reverts after 7 s (`AutoHideDock`).
- Map in the side drawer: the map root is `isolate` so its z-1000 layers cannot paint over the drawer.
- Uploads: one resilient uploader `apps/web/src/lib/media/upload.ts` (`uploadToStorage`: XHR with progress, 20 s stall timeout, 3 tries, offline and signed-out answers; `withTimeout` for server actions). Used by story, feed post, profile cover and avatar, host photos, listing photos, chat photos and the show-me video. Not yet used by: message documents, KYC document uploaders, `ArrivalCheckCard` photos, support photos, receipts. Move those too.
- Photo quality: `next.config.ts` `images.qualities: [75, 90]`; posts and stories serve at 90; client re-encode is 0.92 at up to 2048 px.
- Speed: service worker navigation timeout 1200 ms (was 3000), kept pages answer instantly for 7 days, `/open` and `home-or-landing` deadlines 800 ms, proxy auth deadline 1200 ms, opening animation about 600 ms. Real-device timing is unproven.
- Audit fixes: `sendOrKeep` has a 25 s deadline then keeps the tap in the outbox; push enrol fetches time out; five important forms catch dropped connections; four money paths honour the passcode lock; deposit double-tap fixed; partial chat answers kept; funnel route size check.
- 13 database migrations recorded 20261021104319 to 20261021105606; database drift reconciled.
- Open from the audit: `messageVenue` leaves an empty conversation when the first message fails (needs an RPC that creates thread and first message together); about 215 more `startTransition(async ...)` handlers have no catch (build one shared helper, for example `useAction`, and migrate them in batches); `ArrivalCheckCard` and `ShowMePanel` raw uploads partly migrated.

## 2. THE MOST IMPORTANT WORK: a platform-wide responsive and visual upgrade

The founder's words: desktop, iPad and Mac are "crappy, stupid and ugly", only phone is a bit good. He wants **every single page of the website and the app** corrected, to the highest and newest industry standard, with the flow and the look of the top platforms (Airbnb, Booking.com, X, Linear, Stripe, Apple). He will go live in a few days.

### What the screenshots he sent show (27 October 2026)

1. **A chat photo opened on desktop** shows a phone-shaped dark layout stretched across a laptop screen: a fake status bar ("10:04", signal, "LTE", battery) drawn on the page, a huge circular bell, a green glowing pill with a link icon and nothing in it, a "Featured properties" heading cut off behind the taskbar, and a tiny "You Tue, 13 Oct, 12:20" header. Find out which components draw device chrome on desktop (status bar, call pill, "2 of 2" viewer chip) and make desktop draw a proper desktop viewer: centred image, close button, arrows, keyboard (Escape, left/right), download, counter, no phone chrome.
2. **Desktop home** is a half-empty phone page: a hero, then four large tiles ("Hotels and stays", "Shortlets", "Restaurants", "Local talk") with empty space, and **a broken-image icon above "Local talk"**. On slow data the tile art is missing and the browser's broken image shows. Fix with branded illustrated stickers and fallbacks (see 2.4).
3. **Light mode** reads as "bright mode, not light mode": large flat white areas, washed-out cards on a near-white page, and the brand blue is not solid and sharp. Many areas look blank and unfinished.
4. **The unlock screen** shows "Unlock with Face ID or fingerprint" and "Use your passcode" on a desktop browser, with an avatar and a tilted card. It must be platform-specific (see 2.5).

### 2.1 Method (do this first)

1. List every route under `apps/web/src/app` (public, `(app)`, `agent`, `host`, `admin`, workspace, auth, legal, marketing, around, social, support). Make `docs/PAGE_SWEEP.md`: one row per page, with the status at 390, 820, 1180, 1440, 1920, light and dark, what was wrong, what you fixed. Work through it page by page; do not stop at the high-traffic ones.
2. Research the current best practice before designing (use web search): desktop navigation for marketplaces (left rail or top bar with search), content max-widths, 12-column grid, master-detail for messages and workspaces, side panels instead of full-screen sheets on desktop, hover, focus-visible and keyboard states, pointer-versus-touch sizing, container queries, `dvh/svh`, safe areas, iPad split view and Stage Manager, Mac trackpad behaviour.
3. Decide **one responsive system** and apply it everywhere: breakpoints (phone under 640, tablet 640 to 1023, laptop 1024 to 1439, desktop 1440 and up), a page shell with a maximum content width, a desktop top bar and left rail that replace the phone dock above 1024, `Sheet` becomes a centred dialog or side panel on desktop, lists become grids or master-detail. Put the rules in the design tokens, document them in `docs/DESIGN_DIRECTION.md`, and add a test or script that fails on a page with horizontal scroll at any of the five widths.
4. Enhance what exists. One design language, one way of doing each thing; no second version of a component.

### 2.2 Light mode

Rebuild the light theme properly in `packages/design-tokens/src/tokens.css`: real surface layers (page, raised, sunken), borders and shadows that separate cards from the page, solid brand blue for primary actions, text contrast checked (WCAG AA at least), no large blank white areas, no "bright" glare, no dark-only assets left behind (logos, illustrations, glows, glass fills, map and video overlays). Check every page in light and in dark. Remember the founder removed a light mode on 23 September 2026 and later asked for one: read `docs/DESIGN_DIRECTION.md` and `docs/RULINGS.md` before changing themes, and keep one source of truth for tokens.

### 2.3 Stickers, icons, empty states (the "bot-built" look)

The founder says the icons and stickers are not working well and the platform looks like a bot built it. When there is little data, the screen must show a designed sticker or illustration with a clear line and a next action, not a blank area. Audit every empty state, every skeleton, every tile and every icon plate. Build or finish one consistent set (see `docs/ICON_SYSTEM.md`, `docs/IMAGERY.md`, `docs/BRAND_MARKS.md`, `docs/SUCCESS_MOMENTS.md`), with branded sticker fallbacks for each category (stays, shortlets, restaurants, local talk, messages, wallet, notifications, saved, search with no results, offline). Icons must be one family, one stroke weight, consistent sizes, aligned to text.

### 2.4 Slow data and missing images

On a weak connection the home shows broken-image icons. Fix across the platform: every `<Image>` and `<img>` has a fixed aspect-ratio box, a blurred or colour placeholder, an `onError` fallback to the branded sticker (never a broken icon), lazy loading below the fold, and a cheap low-quality first paint. Skeletons for lists. Keep the offline and weak-network rules from the earlier brief (saved screens, one calm connection indicator, cached-first, optimistic queued writes).

### 2.5 The unlock screen

Make the biometric and passcode screen platform-aware, in the manner of the system's own patterns:

- iPhone with Face ID: "Unlock with Face ID" and a face icon only. iPhone or iPad with Touch ID (home button): "Unlock with Touch ID" and a fingerprint icon. Android: "Unlock with fingerprint" or "face unlock" using what the device reports. Mac and Windows desktops: the platform's own passkey or Touch ID or Windows Hello wording, or just the passcode and password if no authenticator exists. Never offer a method the device lacks.
- On desktop and iPad the card is centred with a proper layout, aligned, with consistent spacing; no tilt, no mobile-only gestures.
- Look at `docs/PASSCODE.md` and the passcode screens first. Detect the capability via WebAuthn and the Capacitor biometric plugin's reported biometry type. Native changes need a new build; say so.

### 2.6 Containers, buttons, UX

Audit every container, card, button, form and sheet for alignment, spacing, hit targets, states (hover, focus-visible, pressed, disabled, loading), and consistent radius and elevation. The logo sits wrongly or shows where it should not in many places: audit each use against `docs/BRAND_MARKS.md`. Redesign the landing page to the same standard (hero, proof, how it works, lists for owners and agents, footer), fast and clean. Remove anything that is backend-only from the front end (internal ids, raw statuses, debug labels, provider names where the law does not require them).

## 3. Phone verification, wallet, referral, calls

### 3.1 Phone number verification and the wallet

- Build the front end for number verification to industry standard: country code picker (Nigeria first), clean number field, a six-digit code screen with auto-advance, paste and SMS autofill (`autocomplete="one-time-code"`), a resend timer, clear errors, success state. The logic lives in `apps/web/src/lib/phone-otp/` (`core.ts`, `actions.ts`, `gate.ts`, `send.ts`, `termii.ts`); read `docs/PHONE_SIGNIN.md` first.
- **When a number is verified, the Payluk wallet must be provisioned automatically** (no extra button), and the wallet screen must show a real balance and its actions cleanly. Stop showing "verify your number" once verified. Remove options that should be backend-only. Do not fabricate balances or references. Read `docs/MONEY_ARCHITECTURE.md` and the money code under `src/lib/money`, `src/lib/payments`, `src/lib/payouts` first. Payluk is unreachable from the sandbox, so write the trigger idempotently, with a retry and a visible "setting up your wallet" state, and list what must be tested live.
- Leave for later (founder: "what should be left"): sub-accounts, referral top-up of the balance, and the escrow flows. Do not build these, but do not break them.

### 3.2 Referral, end to end

Make referral logical and working from invite to reward, as agreed: invite link and code, attribution at sign-up, the qualifying event and its rule, reward ledger, what the invitee and inviter see, payout. Code is in `apps/web/src/lib/referral` and `docs/referral/`. Read the existing rules and the tests (`requirements.ts`, `lifecycle.ts`, `rewards.ts`), find every gap between what was agreed and what runs, fix it, and write `docs/referral/END_TO_END.md` with the final flow.

### 3.3 Audio and video calls (broken on Android and iOS, including TestFlight)

Calls do not ring or connect even with notifications on. Audit the whole chain and fix what you can find: the call UI in `apps/web/src/components/calls`, signalling and token creation (LiveKit server side), push delivery for an incoming call (Android: high-priority FCM data message and a notification channel with call importance, full-screen intent, battery optimisation; iOS: PushKit and CallKit are not available in a plain WebView shell, so use an alert push with the right category and a deep link that opens the call), microphone and camera permissions in `Info.plist` and `AndroidManifest.xml`, the Capacitor shell's WebView permissions, TURN and ICE configuration, codecs and bitrates (Opus for voice, simulcast and adaptive video), echo cancellation and noise suppression, and the way the call layer mounts. Add structured logging so a failed call says why. Because LiveKit is unreachable here, write unit tests for the parts that can be tested, and give Seyi a short, exact device test script. Do not claim calls work until a device proves it.

## 4. Quality bar for everything else

- **Uploads and video:** test every upload path end to end (post, story, workspace and listing photos, avatar, cover, chat photo and video, documents). Finish moving the remaining raw uploaders to `uploadToStorage`. Fast, with progress, resumable video (`lib/agent/resumable-upload.ts`), compression that keeps photos sharp.
- **Speed:** the app must open in about 0.5 s with or without network. Measure with the service worker's kept page, `/open`, the proxy and the opening animation. Report real numbers from a production build.
- **Android, iOS, Mac, Windows, Linux:** the same layout, flows and quality. Test the layouts in Chromium at the five widths and with touch and pointer emulation.
- **Database and backend:** keep auditing the seams between the front end and the backend: RLS, indexes, foreign keys, search paths, storage policies, schema-versus-code column names, server actions that can fail silently. Fix the remaining audit items in section 1.
- **Recommend and build 50 to 60 small features and tools** that fit the platform and the market (for example: share-to-WhatsApp everywhere, saved searches with alerts, price-drop alerts, compare listings, recently viewed, map-and-list sync, quick filters, skeleton states, pull to refresh, copy address, calendar add for viewings, report problem, undo toasts, keyboard shortcuts on desktop, command palette, dark and light auto, language, data saver, offline pack, QR for listings, listing completeness meter, host response time, verified-by-mechanism badges, and so on). Write the list in `docs/FEATURE_BACKLOG.md` with value, effort and a priority, then build the cheap, high-value ones, one at a time, to the same bar.
- **Play Store readiness:** walk `docs/VALLO_ANDROID_RELEASE_CHECKLIST.md`, `docs/MOBILE_READINESS.md` and `docs/STORE_SUBMISSION_NOTES.md`, and close every gap that web or repo changes can close. List what needs a native build.

## 5. Founder items you must not decide (put them in your final report)

- Kareem's name order (Kareem and "Kida" and "Tunde" appear for the 20% holder in different messages; confirm they are one person before any document uses a name).
- Apple's review result for iOS 1.0.0 (a status inquiry is due after 48 hours, from Wednesday 28 October 2026 around 10:00).
- CAC share-transfer filing: Samuel asked his lawyer to halt the update; the signed transfer agreement of 23 October 2026 is with the lawyers. Do not draft anything that changes shares.
- Paystack live activation needs a corporate bank account (Providus, Akure branch, in progress); SCUML next steps; rotating credentials pasted in chat.
- Moving the Vercel project between accounts (project transfer between teams; check the domain and the GitHub app after).

## 6. Done means

Every page in `docs/PAGE_SWEEP.md` is marked good at all five widths in light and dark; gates, `tsc` and the touched tests pass; the SQL drafts are applied (or reported as blocked with the reason); each area is on `main` and the live site shows it; and a final report says plainly what was verified, what was not, and the exact device tests Seyi must run.
