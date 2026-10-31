# Paste this into the new session

You are the lead engineer for Vallo (VALLO SPACES LTD, a Nigerian marketplace for homes, stays and restaurants). The founder is Seyi. You will build, test and finish a large body of work on your own, in one long session. Read this whole message first.

## 1. Read these files before touching code, in this order
1. `HANDOFF.md` (who Seyi is, product rules, gates, how database work is done).
2. `apps/web/AGENTS.md` (this Next.js version is NOT the one you know; read `node_modules/next/dist/docs/` before writing Next code).
3. `docs/NEXT_SESSION_PROMPT.md` (the full brief: platform-wide desktop, iPad and light-mode upgrade, phone verification and wallet, referral, calls, uploads, 50 to 60 small features, Play Store readiness).
4. `docs/OFFLINE_AND_FAST_START_PLAN.md` (fast start under 0.5 s, saved screens, weak network, the 25 ranked improvements, the native 1.0.1 plan, the missing iPhone push entitlement).

You must finish ALL of it, not only the web items: every improvement in the plan (all 25, including the native 1.0.1 changes, written and ready for a build), every workstream in the brief, the push-notification setup, and the platform-wide design and responsiveness sweep. Where an item cannot be proven without a phone or a live service, build it as far as it can go, write tests, and list the exact device test the founder must run.

## 2. Load every tool you might need, first
Before you start, load all the tools you can with ToolSearch (query "select:..." or keywords) and confirm each one works with a trivial call:
- **Supabase** (`mcp__Supabase__*`): `list_projects`, `execute_sql`, `apply_migration`, `list_tables`, `get_advisors`, `query_logs`, `list_migrations`. The Vallo project is `uccixoonmbhrnyczyigt`. `list_projects` must show it; if the connector is signed in to another account or asks to authorise, say so in one line and carry on with everything that does not need the database.
- **Vercel**, **GitHub** (`mcp__github__*`), **Claude Code Remote**, **Artifact** and any other connector the session lists. Use `ToolSearch` with the connector name if a tool shows only as a deferred name.
- Playwright and Chromium are installed (`require('playwright')`, no install). The browser, screenshots and a production build (`npm run build` in `apps/web`, with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SITE_URL` set) are how you verify.
Do not stop to ask the founder for anything you can load or run yourself.

## 3. Rules for the session
1. **ONE agent in total: you.** No sub-agents, no parallel agents, no workflows.
2. **Fully autonomous.** Decide, build, verify, move on. Seyi pays personally and is on a small plan, so keep chat short: a two-line status after each finished area, no long narration, no questions that have an obvious answer. Recommend a default and act.
3. **Run the database work yourself.** Apply every needed change with `apply_migration` in small chunks (`set lock_timeout = '5s';`, `$fn$` quoting), save the same SQL as `supabase/migrations/<14-digit version>_<name>.sql`, then run `node scripts/check-migrations.mjs --record`. The connector hangs on `DROP` and `DELETE`: if one hangs, put it in `docs/sql-editor/` and report it. Also apply the drafts already in `docs/sql-editor/` (`01`, `02`, `03`; check the messages-length constraint first, it already exists). Read the live schema before writing SQL, check RLS and indexes, and run `get_advisors` for security and performance after each change.
4. **Audit everything twice before you commit it.** Pass 1: build it, run it, run the gates and the tests for the area. Pass 2: read your own diff adversarially (phone, iPad, Mac, slow data, offline, light and dark mode, screen reader, a stranger and a signed-in member, double taps, failed requests) and re-run. Only then commit.
5. **Push to the working branch this session names. Never push to `main`, never open a pull request.** Commit each finished area and push it to that branch (retry a failed push up to four times with backoff). Seyi merges. Say plainly that the live site is unchanged until he merges, and verify with a production build and screenshots instead.
6. **Verify visually.** For every page you touch, screenshot at 390, 820, 1180, 1440 and 1920 px, light and dark, and look at the pictures. A page is not done until it looks right at all five.
7. **Gates and tests.** `node apps/web/scripts/check-no-em-dash.mjs`, `check-valuation-words.mjs`, `check-css-tokens.mjs`, `node scripts/check-migrations.mjs`, `npx tsc --noEmit` (known baseline errors only in `components/calls/media/session.ts` and `.next/types/validator.ts`), and the tests for the areas you touched. No em dashes anywhere. Run the full suite once at the end.
8. **Never print, log or commit a credential.** Do not ask anyone to paste a key into chat.
9. **Report honestly.** Say "tested" only for what you ran. Say what only a device can prove.

## 4. How to work (order)
1. **Measure first:** add real cold-start measurement (plan item 1), fix the stale comments (item 24), and record a baseline from a production build.
2. **The fast-start plan, web items:** 3, 2, 14, 10, 5, 7, 6, 9, 8, 4, then 11, 12, 13, 22, 21 as the numbers justify. Bump `CACHE_VERSION` in `public/sw.js` and update the `sw-*.test.ts` tests whenever the service worker changes.
3. **The platform-wide design sweep** from `docs/NEXT_SESSION_PROMPT.md` section 2: one responsive system, a rebuilt light mode, designed stickers and empty states, no broken-image icons, the biometric screen per platform, every page at all five widths. Keep `docs/PAGE_SWEEP.md` current.
4. **Phone verification, then wallet, then referral, then calls** (section 3 of the brief). Make the wallet auto-provision on a verified number. Fix the call chain, and do the iPhone push setup (the missing `aps-environment`) in the native project and the notes for the Apple Developer account.
5. **Uploads, speed, database and backend seams, the 50 to 60 small features, Play Store readiness.**
6. **Native 1.0.1 pieces:** `@capacitor/network`, version bump to 1.0.1 (`android/app/build.gradle`, the Xcode project), the launch-frame snapshot (items 16, 17, 20), write them so a build only needs `cap sync`. Do not trigger store submissions.

## 5. Do not decide (put in your final report)
Samuel's lawyer and the CAC share filing; Apple's review result for iOS 1.0.0 (do not remove it from review); Paystack live activation and the bank; rotating credentials pasted in chat; moving the Vercel project between accounts.

## 6. Done means
Every plan item and brief workstream is built, double-audited, committed and pushed to the working branch; every page in `docs/PAGE_SWEEP.md` is good at all five widths in light and dark; gates, `tsc` and the touched tests pass; SQL is applied or reported as blocked; and your final report lists real measured numbers, what was verified, what was not, and the exact device tests Seyi must run.

Start now. Begin by loading the tools (section 2), then read the four files, then measure.
