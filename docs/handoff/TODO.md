# VALLO: Everything Not Done Yet

Updated 8 November 2026. Cross-referenced against AGENT_QUEUES.md,
FEATURE_BACKLOG.md, and every agent hand-off this session.

---

## 1. NATIVE (iOS, Android, Performance, Offline)

### Platform Layer
- [ ] 1.1 Platform-aware CSS layer: `data-platform` (ios/android/web) and `data-native` on `<html>` at boot before first paint
- [ ] 1.2 iOS press highlight and dim vs Android Material touch ripple (transform + opacity only)
- [ ] 1.3 iOS slide-from-right page transition vs Android fade-through, one shared helper, reduced motion honoured
- [ ] 1.4 Scroll edge: iOS bounce kept, Android overscroll glow left native

### iOS Shell Polish (build 1.0.2)
- [ ] 1.5 Edge swipe back in the web view (`allowsBackForwardNavigationGestures`)
- [ ] 1.6 Link preview off in WKWebView
- [ ] 1.7 App switcher privacy cover for money screens
- [ ] 1.8 Native crash capture on next launch (into `/api/client-error` with platform ios)
- [ ] 1.9 Animated launch hand-off (logo and wordmark) from web launch to native shell

### Connection Manager / Offline
- [ ] 1.10 Shared connection state: connected, slow, unstable, offline, reconnected
- [ ] 1.11 Calm Vallo strip for connection changes + banner
- [ ] 1.12 Offline screen upgrade: status, Try again, saved/recently viewed, a way home, auto recovery
- [ ] 1.13 Cached prices labelled "Saved on your device. Price and availability may have changed."
- [ ] 1.14 On reconnect: refresh, replay only safe queued actions, never payment/booking without confirmation

### Performance (remaining after NATIVE2)
- [ ] 1.15 Fix the 14 whole-dictionary props (656 KB each) by passing only the sections each component reads; sign-in/sign-up first
- [ ] 1.16 Format `counterpartPhone` on the server so InspectionSheet drops `lib/phone` (40 KB off /bookings)
- [ ] 1.17 Search scroll on budget Android: hold carousel second image and card shadows on data-motion-lite
- [ ] 1.18 Listing map tiles at the size they are drawn (350 KB per listing view)
- [ ] 1.19 Point remaining PNG references at WebPs (path-tiles.ts, lib/assistant/glyphs.ts)
- [ ] 1.20 Defer in-app banner client load to idle (`requestIdleCallback` with 2s ceiling)

### Rich Notifications (code written, needs build 1.0.2 to ship)
- [ ] 1.21 A1: iOS Notification Service Extension download photo into notification (code exists, needs device test)
- [ ] 1.22 A2: Android monochrome small icon, large icon, big picture, channels (code exists, needs device test)
- [ ] 1.23 A3: Payload carries image/category/subtitle, web push shows image (code exists, needs device test)
- [ ] 1.24 A10: Notification sound .caf on iOS, Android channel sound (code exists, needs build 1.0.2)

### Calling Native Bridge (code written, needs build 1.0.2)
- [ ] 1.25 F2: Wire CallKit on iOS and full-screen intent on Android (JS bridge spec done, native Swift/Kotlin not wired)

### Device Test Matrix
- [x] 1.26 DEVICE_TEST_MATRIX.md written (done earlier)

---

## 2. FRONTEND (Agent FE queue items 3-10)

### Light Mode
- [ ] 2.1 Light mode refinement platform wide: surfaces, edges, shadows, text contrast, cards, sheets, inputs, bottom bar, side nav
- [ ] 2.2 Tokens first (packages/design-tokens/src/tokens.css), then worst screens

### Motion
- [ ] 2.3 Motion pass beyond launch logo: tab changes, sheet open, card press, save, success animations

### Privacy and Trust
- [ ] 2.4 Privacy choices screen (/settings/privacy): profile visibility, who can message, activity visibility, contact discovery, AI content use, data download, marketing, blocked people
- [ ] 2.5 Community Promise page and trust siblings (listings honesty, viewing safety, money held safely)
- [ ] 2.6 E5: Marketing email consent unticked by default (NDPR), choice also in Privacy settings

### Listing Wizard
- [ ] 2.7 Listing wizard onto StepFrame, one question per screen (WORK_QUEUE round 2, LW-01 to LW-04)

### Universal Systems
- [ ] 2.8 Bottom sheets audited onto one Sheet (drag, dismiss, keyboard, safe areas) for filters, sort, share, collections, account/booking actions
- [ ] 2.9 Saved collections: custom collections, covers, move between, sort, share, compare up to 4 side by side
- [ ] 2.10 Activity Centre (/notifications): categories, grouping, unread, mark all read, archive, rows open exact destination
- [ ] 2.11 Keyboard actions on every form: enterKeyHint Next/Done, inputMode, autoComplete, Enter moves to next field

### Round 1 Follow-ups
- [ ] 2.12 Success words for unblock, payment method remove/default, hours saved
- [ ] 2.13 ToastHost inside lib/testing/browser-root mount()
- [ ] 2.14 Book and Pay disabled on kept copy pages (with KeptPriceNote reason)
- [ ] 2.15 DiscoveryEmpty onto one glyph
- [ ] 2.16 Real pin glyph in UiIcon (inbox pin borrows bookmark today)
- [ ] 2.17 Inline errors in HostWizard and stays steps move with StepFrame

### Platform Sweep
- [ ] 2.18 E1: Remove every plate/dark box behind any logo, flag or glyph platform wide
- [ ] 2.19 A7: Rich Activity Centre cards (photo, header, time, opens exact destination)
- [ ] 2.20 C2 shared rating components: App Store style summary (big average, star bars, reviews)

### Later Rounds
- [ ] 2.21 Rounds 5, 6, 7 from WORK_QUEUE.md (round 7 SW11 includes moving English words into packages/i18n)

---

## 3. PAGES (remaining from Agent PAGES)

### Job 5 (partly done)
- [ ] 3.1 E2: Desktop and tablet layouts that use the full width (Back in header done, layouts not)
- [ ] 3.2 E3: Docs, help and guides pages upgraded (/docs, /help, /guides): searchable, clean, PageFrame, light and dark

### Recommended
- [ ] 3.3 agreements/[id] body split for a fixture view (586 lines)
- [ ] 3.4 DrawUpAgreement, PaymentGate, CautionControls onto StepFrame
- [ ] 3.5 Rewards WithdrawFlow and RewardsPayoutForm onto StepFrame
- [ ] 3.6 Wallet "pay" step review (two buttons in content, none in footer)

---

## 4. BANNER (remaining moments)

- [ ] 4.1 ListingWizard D18-D20 (step, photo, publish notices)
- [ ] 4.2 Convert 3 TO CONVERT NEXT rows: PhoneField, SupportChat, VninPanel
- [ ] 4.3 Tick audit round 2 rows (323 rows) against the code, build what remains
- [ ] 4.4 Optional: avatar on banner items for outcomes that name another person
- [ ] 4.5 Fix css-tokens failures in calls.css (2 unresolved vars, 2 #fff, 1 grey hairline)

---

## 5. FEATURES (new features end to end)

### Notifications
- [ ] 5.1 A4: Lock screen words with a header in one voice ("Booking confirmed" / place and dates)
- [ ] 5.2 A8: Email headers in high end style (logo lockup, header line, photo)
- [ ] 5.3 A9: Live in-app notification banner subscription wiring (FE built the banner; FEATURES owns the realtime subscription)

### Vallo Circle
- [ ] 5.4 B2: Finish Circle v3 build (SQL live, /circle route built; needs: invites, shared shortlists, plans, vouches, notifications, privacy)

### Ratings
- [ ] 5.5 C1: Rate a person after a real deal (stars + review, both sides, released together or after 14 days, reply, report)
- [ ] 5.6 C2: App Store style rating summary on profiles and listing host card (FEATURES logic + FE components)

### Area Tools (section D)
- [ ] 5.7 Home: continue where you left off, next booking/viewing card, "new near you" rail, quick Rent/Stays/Eat switch
- [ ] 5.8 Search: saved searches with alerts, draw area on map, commute time, recent searches, sort by move-in cost
- [ ] 5.9 Listings: gallery with rooms labelled, "ask the host", availability calendar, neighbourhood facts, share as card, similar places
- [ ] 5.10 Stays: date/guest sheets, price for your dates, house rules, check-in guide, split the bill
- [ ] 5.11 Restaurants: reserve a table, menus with photos, deposits, group size, reminders, "book again"
- [ ] 5.12 Messages: scheduled messages, saved replies for hosts, translate, shared media tab, block/report from chat
- [ ] 5.13 Profile: rating summary, badges, verified marks, "what I'm looking for", shareable profile card
- [ ] 5.14 Admin: calmer overview, user lookup with timeline, bulk actions with undo, saved filters, audit trail

---

## 6. CALLS (remaining)

- [x] 6.1 F1: In-app incoming call banner -- DONE
- [x] 6.2 F2: Native bridge spec written -- DONE (native wiring is item 1.25)
- [x] 6.3 F3: Missed call push with Message/Call back -- DONE
- [x] 6.4 F4: Upgraded audio call screens with glass control sheet -- DONE
- [x] 6.5 F5: Upgraded video call screens -- DONE
- [x] 6.6 F6: Calling recommendations -- DONE
- [ ] 6.7 Recommendations to build: end-to-end encryption indicator, call quality adaptive UI (switch to voice on poor connection), PiP mode, call waiting/hold, voice message fallback, haptic feedback on controls, connection quality sparkline on ended screen

---

## 7. MESSAGES (Agent MSG queue finished, lead keeps)

- [x] All 10 jobs done (voice notes, reactions, media viewer, thread polish, inbox polish, offline voice, URL refresh, support chip, pin/mute, support thread)

---

## 8. BUILD AND DEPLOY

- [ ] 8.1 Build 1.0.2: ship all native items (rich push, notification sound, CallKit, iOS shell polish, Android renderer recovery)
- [ ] 8.2 Run all GitHub Actions workflows (CI, iOS compile, Android compile) -- founder must trigger manually from Actions UI
- [ ] 8.3 Full tsc --noEmit clean pass on the entire tree
- [ ] 8.4 Full vitest run, fix remaining test failures (no-hardcoded-copy, one-light circle.css, calls.dom.test)

---

## 9. FOUNDER DECISIONS STILL PENDING

- [ ] 9.1 Portrait lock: recommended yes, awaiting founder answer
- [ ] 9.2 Wallet "pay" step layout review (two buttons in content, none in footer)

---

## Summary

| Category | Done | Remaining |
|---|---|---|
| Calls (F1-F6) | 6/6 | 0 (recommendations are ideas, not tasks) |
| Messages (MSG 1-10) | 10/10 | 0 |
| Banner moments | ~190/561 | ~371 moments from audit round 2 |
| Pages (PAGES 1-5) | 4.5/5 | Desktop layouts, docs/help |
| Frontend (FE 1-10) | 2/10 | Light mode, privacy, listing wizard, universal systems, E1, A7, C2, rounds 5-7 |
| Native (NATIVE 1-8) | 4-6/8 | Platform layer, iOS shell, offline, perf fixes, build 1.0.2 |
| Features (FEATURES) | 2/many | Circle finish, ratings, lock screen words, emails, area tools |
| Build/Deploy | 0/4 | Build 1.0.2, workflows, clean gates |
