# VALLO GRADE 1: UX RECOMMENDATIONS (AGENT 1)

Written 7 November 2026 by Agent 1 (UX research and design quality) on `platform-grade-1-readiness`, from the founder's brief, `AUDIT_2026-11.md`, `REFERENCE_PATTERNS.md` (R1 to R15), the readiness handoff (sections 4, 4B, 5) and a read of the code.
Every item names a real Vallo screen, component or table. It is an upgrade list, not a rebuild: Capacitor, the backend and every working feature stay, real data only, no new paid service without the founder.
Items marked **(decided)** are already being built by the lead; the entry only adds the detail Agent 1 will check at review. Button rulings hold everywhere: text buttons are soft-cornered rectangles (10 / 12 / 14px on 44 / 48 / 56px), never pills; blue leads, orange spark only in the closed list of `docs/design/CLEAN_UNIFIED_DIRECTION.md` section 18.
Paths are under `apps/web/src/` unless they start with `apps/web/`, `docs/` or `supabase/`.

---

## TOP 30

Ordered by member impact and business value, biased to launch readiness and to making every page feel like one product.

| # | ID | What | Why it matters to a member | Effort | Layer |
|---|---|---|---|---|---|
| 1 | FB1 | Every action reports through the one FeedbackBanner, with a census of 40 named actions | They always know a tap worked, or exactly why it did not | M | frontend |
| 2 | N1 | Five-tab dock with Messages promoted to the bar and the "More" grid retired | Their conversations are one tap away, with a live unread badge | M | frontend |
| 3 | VIS1 | Page sweep on PageFrame: one surface, radius and spacing scale, busiest 30 routes first | Every screen looks like the same calm, expensive product | L | frontend |
| 4 | VIS2 | Thin chrome icons in one family, active state as fill (decided) | The shell stops looking heavy and cartoonish | M | frontend |
| 5 | IOS1 | Status bar style follows each screen | No dark text on the navy header, the clearest "website" tell | S | frontend, Capacitor |
| 6 | AND6 | Light render profile on budget Android (no blur, fewer animations) | Smooth scrolling on the 2 to 3 GB phones most Nigerians carry | S | frontend |
| 7 | ONB6 | One "1 thing to fix" deal gate (phone, then verification) that returns to the deal | Nothing blocks sign-up, and the check appears only when it matters | M | frontend, backend |
| 8 | PUB3 | "Check your listing" review with Change buttons and a things-to-fix list | Listers submit once, correctly, instead of being refused at admin | M | frontend |
| 9 | PUB1 | Split the 4,733-line ListingWizard into one-question StepFrame pages (decided) | Listing feels short and guided; drafts never lost | L | frontend |
| 10 | MSG1 | Composer rebuilt: growing field, attach menu, mic that turns into send | Typing and sending feel like a real chat app | M | frontend |
| 11 | MSG5 | Pinned "Vallo Assistant" first in the inbox with "Talk to a person" inside (decided) | Help is always in the place they already look | M | frontend, backend |
| 12 | OFF1 | "Saved on your device. Price and availability may have changed." stamp on kept pages | They are never misled by an old price | M | frontend, service worker |
| 13 | OFF2 | Offline screen with recently viewed, saved and their next plan | A dead signal still shows what they need | M | frontend |
| 14 | N5 | Workspace switch row in the side nav, instant and working offline (decided) | Agents and hosts switch sides without hunting or waiting | M | frontend, service worker |
| 15 | SEC1 | Expired session asks to sign in on a sheet, keeps drafts, returns to the same screen | No lost message or form, no confusing bounce to the front door | M | frontend |
| 16 | BK1 | One booking pass page with a status timeline and every action | "Where is my booking?" answered in one place | M | frontend |
| 17 | ST1 | Stays date range sheet with blocked nights, nights count and total | Choosing dates feels like a premium travel app | M | frontend, API |
| 18 | RS1 | Reserve a table in one sheet: day, party size, real time slots | Booking dinner takes three taps | M | frontend |
| 19 | SRC1 | Search opening state: Rent / Buy / Stays / Tables, recent, saved, popular areas | Search starts useful before they type | M | frontend, API |
| 20 | SRC2 | Live "Show 48 places" count on the filter drawer | No dead-end filters with zero results | M | frontend, API |
| 21 | PD1 | Listing hero gallery: glass controls, counter, pinch zoom, blurred placeholder | The listing feels like a native photo experience | M | frontend, backend |
| 22 | SAV1 | Save heart: instant fill, haptic, banner with "Add to a list" | Saving is satisfying and organised | S | frontend |
| 23 | IOS7 | App resume refresh of counts, status and session | Returning to the app shows today, not an hour ago | S | frontend, Capacitor |
| 24 | IOS4 | Sheet upgrade: page recedes, drag-to-dismiss, springs (decided Sheet) | Every overlay feels native and consistent | M | frontend |
| 25 | FB2 | One top lane for feedback, incoming notifications, connection and the passcode alert | Banners never pile up under the status bar | M | frontend |
| 26 | N8 | Deep links for bookings, messages and notifications open the right screen | Links from email, WhatsApp and push land where promised | M | frontend, native build |
| 27 | PERF1 | Measured baseline and budgets on a budget Android and an older iPhone | Speed work is real, not guessed | M | frontend |
| 28 | PERF2 | Skeletons shaped like the real content on every loading screen | The app feels instant, with no spinner-only screens | M | frontend |
| 29 | MSG2 | Voice notes end to end: hold to record, slide to cancel, waveform, speed (decided) | The way Nigerians actually message, inside Vallo | L | frontend, backend |
| 30 | IOS6 | Keyboard: fields scroll into view, composer rides the keyboard, dock hides | Typing never covers what they are typing into | S | frontend, Capacitor |

---

## 1. Navigation and application structure

**N1. Five-tab dock with Messages promoted**
- What: The dock becomes Home (Stays on the Stays side), Search, Messages, Feed (Agreements when social is off), Profile. The centre `DockMore` grid is retired; its 8 rows already live in the side drawer.
- Why: Messages is the screen people return to most and today it is two taps deep inside "More", which also duplicates the drawer (audit section 1).
- Where: `components/app/MobileTabBar.tsx` (slots around lines 344 to 423), `components/app/DockMore.tsx`, `components/app/ShellDock.tsx`.
- How: Messages carries the live count from `lib/messages/unread-live.ts` as the spark badge (allowed by ruling 18). Active tab per ruling 17. Show the founder icon-only and labelled inactive tabs side by side before shipping (see "Needs the founder").
- Layer: frontend. Priority: P0. Effort: M.

**N2. One create entry, not two**
- What: Remove the round "+" `CreateDock` that still renders although `AppShell.tsx:403` says it is gone; the create sheet opens from a first drawer row "List or post" and a 44px round button in the Feed header.
- Why: Two triggers for one sheet is the kind of duplicate that makes the shell feel unplanned.
- Where: `components/app/AppShell.tsx`, `components/app/CreateDock.tsx`, `components/app/NavTree.tsx`.
- How: Keep the existing sheet; move only its openers. Correct the stale comments at `AppShell.tsx:403`, `MobileTabBar.tsx:308`, `nav-model.ts:27`.
- Layer: frontend. Priority: P0. Effort: S.

**N3. Bell on every root screen**
- What: The header bell shows on every dock root and on Profile, not only the five `BELL_PATHS`.
- Why: A member on Messages, Plans or Profile cannot see a new notification without going home.
- Where: `components/app/AppShell.tsx:71`.
- How: Derive visibility from `showsTabBar(active)`; hide only on `/notifications` and immersive screens (thread, gallery, checkout).
- Layer: frontend. Priority: P1. Effort: S.

**N4. Side nav regrouped to about 12 rows**
- What: Three groups (You: Plans, Saved, Notifications, Passport; Money: Balance, Rewards; Workspaces: the switch from N5), Help and Settings in the tail; Agreements once.
- Why: 18 signed-in rows today and Agreements in up to three places (audit section 1).
- Where: `components/app/nav-model.ts`, `components/app/NavTree.tsx`, `app/side-nav.css` (906 lines, much dead).
- How: Rows show grey counts (unread, plans today); delete dead CSS guarded by `components/app/nav-island.test.ts`.
- Layer: frontend. Priority: P1. Effort: M.

**N5. Workspace switch row in the side nav (decided)**
- What: "Switch to agent tools / Exit agent tools" as the first row of Workspaces, with the workspace name and avatar, replacing `ProfileSwitcher`, `ModeSwitcher` and `components/roles/RoleSwitcher.tsx` as one control.
- Why: Three mechanisms for one idea; Agent Mode is just a link today.
- Where: `components/app/nav-model.ts`, `app/(app)/profile/SwitchRoleRow.tsx`, cookies `nf_mode` and `nf_workspace`.
- How: Flip the cookie locally, navigate to `/agent/dashboard` served from the kept shell (OFF4), confirm with the server after; a floating soft-cornered "Switch to agent tools" button on mobile Profile (R10, as a rectangle per ruling 19) opens the same control. Check it works in airplane mode.
- Layer: frontend, service worker. Priority: P0. Effort: M.

**N6. Inner tabs on one route instead of sibling pages**
- What: Use the PageFrame tab row for Saved (Places, Lists, Searches), Plans (All, Property, Stays), Notifications (families) and Settings areas.
- Why: Fewer dead-end pages and one header pattern, with no duplicate routes.
- Where: `app/(app)/saved/page.tsx` and `saved/searches`, `app/(app)/bookings/page.tsx`, `app/(app)/notifications/family.ts`, `components/ui/UnderlineTabs.tsx`, `components/ui/InnerNav.tsx`.
- How: Tabs are a query parameter; counts in grey, the active count in the accent (R14); scroll kept per tab.
- Layer: frontend. Priority: P1. Effort: M.

**N7. Tabs keep their place**
- What: Returning to a dock tab restores its scroll and sub-tab; tapping the active tab scrolls to top; a second tap on Search focuses the field.
- Why: Native tab bars remember where you were; `RouteTransition` re-mounts every page at the top.
- Where: `components/app/MobileTabBar.tsx` (active check near line 482), `components/motion/RouteTransition.tsx`, `lib/ui/history.ts`.
- How: Store scroll per pathname in sessionStorage on tab tap and pagehide; restore after first paint.
- Layer: frontend. Priority: P1. Effort: S.

**N8. Deep links to own-data screens**
- What: Bookings, reservations, a message thread and a notification target open inside the app, with a sign-in sheet that returns to the target.
- Why: The brief names bookings and notification destinations; the AASA excludes `/bookings` and `/trips`, and Android App Links list only public paths.
- Where: `apps/web/public/.well-known/apple-app-site-association`, `apps/web/android/app/src/main/AndroidManifest.xml` (pathPrefix list), `lib/native/deep-links.ts`, `lib/native/deep-link-readiness.ts`.
- How: iOS paths change in the AASA file only (no build). Android needs new `pathPrefix` entries (native build queue). The target rides in `next=` through SEC1's sign-in sheet.
- Layer: frontend, native build (Android). Priority: P0. Effort: M.

**N9. One page map for "up"**
- What: A typed map of every member route and its parent, used by back buttons and Android back when there is no history (a deep link).
- Why: `PageHeader`, `SiteBackBar`, `AuthBackBar` and `WorkspaceHeader` each guess; a deep-linked page today has nowhere sensible to go back to.
- Where: `lib/nav/` (new `page-map.ts`), `components/app/PageHeader.tsx`, `lib/native/back-button.ts`.
- How: Back pops history when it exists, else goes to the mapped parent; the same map feeds the docs page map (readiness P2.7).
- Layer: frontend. Priority: P1. Effort: M.

## 2. Native iOS interactions

**IOS1. Status bar follows the screen**
- What: Light status text on the navy header and photo heroes, dark text on paper screens and full-height sheets.
- Why: The audit found the style follows the theme only; mismatched status text is the most visible web-view tell.
- Where: `lib/native/status-bar.ts` (`startStatusBar`), `components/app/AppShell.tsx`, listing and stay heroes.
- How: Top surfaces carry `data-status-bar="light|dark"`; on route change and sheet open, call `StatusBar.setStyle` (plugin installed, no build).
- Layer: frontend, Capacitor. Priority: P0. Effort: S.

**IOS2. Edge swipe back**
- What: A left-edge swipe drags the page right with the previous one sliding in, commit past 35 percent or a fast flick.
- Why: iPhone users go back with the thumb; the shell offers no back gesture today.
- Where: `components/motion/RouteTransition.tsx`, `lib/motion/nav-direction.ts`.
- How: A 20px edge pan recogniser in the web layer calls `router.back()` with the reverse slide; off on the map and edge carousels; no native change.
- Layer: frontend. Priority: P1. Effort: M.

**IOS3. Haptic grammar completed**
- What: Select on tabs and chips, confirm on save, success with success banners, warning on a validation stop, error on failure.
- Why: `warning` is never used and `nativeHaptic` in `lib/native/device.ts` is dead code (audit section 6).
- Where: `lib/ui/feedback.ts`, `components/ui/Segmented.tsx`, `components/ui/Chip.tsx`, `components/app/SaveControl.tsx`.
- How: FeedbackBanner calls `feedback(kind)` itself, so every migrated action gets haptics; extend `lib/ui/haptic-census.test.ts`; delete `nativeHaptic`.
- Layer: frontend, Capacitor. Priority: P0. Effort: S.

**IOS4. Sheets that behave like iOS (decided Sheet upgrade)**
- What: Drag down from anywhere when scrolled to top, rubber-band at the top detent, the page behind scales to 0.94 with rounded corners at full height.
- Why: Hauslet's stacked sheets (R4, R5, R7) feel native because the page recedes.
- Where: `components/ui/Sheet.tsx` (679 lines, about 85 users), `lib/ui/use-swipe-to-close.ts`, `lib/ui/use-sheet-history.ts`.
- How: Transform-only springs from the ease tokens; a plain fade under Calm and Off motion; solid scrim on the light device profile (AND6).
- Layer: frontend. Priority: P0. Effort: M.

**IOS5. Long-press context menus**
- What: Long-press a listing card, a conversation or a saved item for a sheet: Save to a list, Share, Compare, Hide, Report.
- Why: iOS users expect long-press; today card actions hide behind `CardMenu` taps.
- Where: `components/app/ListingCard.tsx`, `components/app/listing/CardMenu.tsx`, `lib/ui/use-long-press.ts`, `app/(app)/messages/Inbox.tsx`.
- How: Reuse the Sheet and `use-long-press`; suppress the system callout on cards only; select haptic on open.
- Layer: frontend. Priority: P1. Effort: M.

**IOS6. Keyboard that never covers the field**
- What: Focused fields scroll above the keyboard, the composer and sticky bars ride on it, the dock hides while typing, the accessory bar shows on forms only.
- Why: Founder section 3; the inset variable exists but the dock and sticky bars ignore it.
- Where: `lib/native/keyboard.ts`, `components/app/ShellDock.tsx`, `components/app/AutoHideDock.tsx`, `components/app/listing/ListingStickyBar.tsx`.
- How: Hide on `keyboardWillShow`, not on resize; `Keyboard.setAccessoryBarVisible` per screen. System keyboard sounds stay untouched: no custom audio.
- Layer: frontend, Capacitor. Priority: P0. Effort: S.

**IOS7. Refresh on resume**
- What: After more than 60 seconds in the background, quietly refresh unread counts, notifications, the open booking and thread, and re-check the session.
- Why: No lifecycle listener exists outside calls (`components/calls/CallStage.tsx`).
- Where: `lib/native/boot.ts`, `components/app/KeepWarm.tsx`, `lib/messages/unread-live.ts`.
- How: `App.addListener("appStateChange")`; `router.refresh()` on dock roots only, never over an open form; resubscribe Realtime with `ownChannelName()`. Same listener on Android.
- Layer: frontend, Capacitor. Priority: P0. Effort: S.

## 3. Native Android interactions

**AND1. Predictive back**
- What: Opt in to Android 14+ predictive back so a root screen previews home before exit.
- Why: The brief asks for it; the manifest has no `enableOnBackInvokedCallback`.
- Where: `apps/web/android/app/src/main/AndroidManifest.xml`, `lib/native/back-button.ts`.
- How: Set the flag; keep the existing order (close overlay, pop a step, exit on a root); test sheets close first.
- Layer: native build. Priority: P1. Effort: S.

**AND2. Edge-to-edge with correct bars**
- What: Transparent status and navigation bars, icons light or dark per screen (the IOS1 attribute), content inset correctly with gesture and 3-button navigation.
- Why: Android 15 forces edge-to-edge for apps targeting SDK 35; the gesture bar must not sit on the dock.
- Where: `lib/native/status-bar.ts`, the 150 `safe-area-inset` uses, Android styles.
- How: Confirm the WebView reports `env(safe-area-inset-*)`; if not, set `--nf-inset-*` from the native insets at boot.
- Layer: Capacitor, native build. Priority: P0. Effort: M.

**AND3. Ripple on Android, press scale on iOS**
- What: A soft ink ripple from the touch point on rows, cards and icon buttons on Android only.
- Why: The brief asks for Material-inspired feedback; Android users read the ripple as "registered".
- Where: `app/css/press-motion.css`, `lib/native/platform.ts`, `components/ui/ListGroup.tsx`.
- How: `html[data-platform="android"]` enables a CSS pseudo-element on `:active`; no JavaScript per tap; off under reduced motion.
- Layer: frontend. Priority: P2. Effort: S.

**AND4. Window resizing with the keyboard**
- What: The WebView resizes (not pans) so composer and sticky bars sit above the keyboard without jumps.
- Why: Budget phones jump today; no `windowSoftInputMode` is set in the manifest.
- Where: `apps/web/android/app/src/main/AndroidManifest.xml`, `apps/web/capacitor.config.ts` (Keyboard resize Native), `lib/native/keyboard.ts`.
- How: Set `adjustResize` on the main activity; test on a 2 GB phone with the thread and the listing description step.
- Layer: native build. Priority: P1. Effort: S.

**AND5. Share parity**
- What: Long-press menus (IOS5) and listing share cards (PD6) behave the same on Android; "Share to Vallo" from another app opens a chooser sheet (send in a chat, save a link).
- Why: Do not ship Android as the lesser version.
- Where: `lib/native/share-bridge.ts`, `components/app/messages/ShareSheet.tsx`, `app/(app)/messages/share`.
- How: One component tree; only the system share call differs.
- Layer: frontend, Capacitor. Priority: P2. Effort: S.

**AND6. Light render profile for budget phones**
- What: Automatically drop backdrop blur, staggered lists and large image widths on phones with 3 GB RAM or less, or a slow first paint.
- Why: Blur is the costliest effect in Android WebView and the brief insists on budget Android.
- Where: `lib/ui/lite.ts`, `lib/ui/data-saver.ts`, `app/css/data-saver.css`.
- How: At boot set `html[data-lite-device]` from `navigator.deviceMemory` and `hardwareConcurrency`; glass tokens resolve to solid surfaces; Settings, Appearance can override.
- Layer: frontend. Priority: P0. Effort: S.

**AND7. Named notification channels**
- What: Add channels for Messages, Bookings and payments, Reminders and Vallo news beside today's `vallo_default`, `vallo_calls` and `vallo_missed`.
- Why: Muting news in Android settings mutes messages too today.
- Where: `lib/push/transport/fcm.ts:248`, `components/app/push/enrol.ts`, `lib/push/preferences.ts`.
- How: `PushNotifications.createChannel` at enrol (installed plugin, no build); the drain picks `channel_id` from the notification family.
- Layer: Capacitor, backend. Priority: P1. Effort: S.

## 4. Notifications and feedback

**FB1. Every action reports through FeedbackBanner (decided system, the migration)**
- What: Save and unsave, list created, message failed, booking confirmed, table reserved, profile updated, password and passcode changed, listing submitted, photos uploaded, review sent, preferences saved, report received, and the rest of a 40-row census.
- Why: Most actions show nothing or an inline sentence today (audit section 4); the founder's top priority.
- Where: `lib/ui/toast.ts` (15 call sites), `components/ui/Toast.tsx` (`useToast`, 4 files, to delete), `components/ui/ToastHost.tsx`, `components/ui/DetailsHost.tsx`.
- How: A census test in the style of `lib/ui/success-wiring-census.test.ts`, one row per action with its exact copy; failures say what to do ("Message couldn't be sent. Check your connection and try again.") with Retry.
- Layer: frontend. Priority: P0. Effort: M.

**FB2. One top lane for every banner**
- What: FeedbackBanner, `NotifyBanner` (incoming notifications), `ConnectionLine` and `PasscodeOffer` share one lane and queue: error over success over incoming over connection.
- Why: Four independent top surfaces will overlap under the status bar.
- Where: `components/app/notify/NotifyBanner.tsx`, `components/ui/ConnectionLine.tsx`, `components/passcode/PasscodeOffer.tsx`, `components/ui/DetailsHost.tsx`.
- How: A single lane store; replace, never stack; `ConnectionLine` stays brief and in place (founder ruling) and yields while a banner shows.
- Layer: frontend. Priority: P0. Effort: M.

**FB3. Undo on reversible actions**
- What: "Removed from Saved. Undo" for 5 seconds after removing a saved item, archiving a chat, deleting a list or hiding a listing.
- Why: People act faster when mistakes are cheap; `lib/ui/undo-window.ts` already exists.
- Where: `app/(app)/saved/SwipeToRemove.tsx`, `lib/messages/archive.ts`, `app/(app)/saved/Collections.tsx`, `lib/ui/hidden-listings.ts`.
- How: The banner action runs the inverse server action; non-idempotent deletes wait for the window.
- Layer: frontend. Priority: P1. Effort: S.

**FB4. Queued is never shown as sent**
- What: "Kept on this phone. It will send when you are back online", then one grouped "3 changes sent" when the outbox drains.
- Why: The brief forbids claiming delivery for a local queue.
- Where: `lib/offline/send-or-keep.ts`, `lib/offline/outbox.ts`, `components/app/OfflineTray.tsx`.
- How: Outbox events feed the banner lane; failures stay in `OfflineTray` with Retry.
- Layer: frontend. Priority: P0. Effort: S.

**FB5. Actionable notification rows**
- What: Request rows get inline buttons: Accept or Decline a viewing, Pay a deposit, Reply.
- Why: Resolve a request in one tap from the centre instead of opening three screens.
- Where: `app/(app)/notifications/LiveNotifications.tsx`, `lib/notify/inbox-actions.ts`, `lib/notify/links.ts`.
- How: Needs the object type and id on `public.notifications` (requests W5-1 and W5-2 noted in `family.ts`): one migration, then actions only for known kinds.
- Layer: frontend, backend. Priority: P1. Effort: M.

**FB6. Push copy that names the thing**
- What: "Tolu replied about 2-bed in Yaba", with the listing photo as Android big picture now and iOS later.
- Why: Specific pushes get opened; generic ones get muted.
- Where: `lib/push/copy.ts`, `lib/push/drain.ts`, `lib/notify/templates.ts`.
- How: Android image field is web-side; iOS images need a Notification Service Extension (native build queue).
- Layer: backend, native build (iOS image). Priority: P2. Effort: M.

**FB7. Notification offer polished (P0.4b)**
- What: The `notify` beat gets a bell tile, the exact list of what Vallo sends, the "you choose on the next screen" line, topic switches and a "Notifications are on" banner.
- Why: R9 shows the standard; the beat reuses the stock card today.
- Where: `components/app/welcome/FirstRun.tsx`, `components/app/push/PushPrompt.tsx`, `components/app/push/push-prompt.css`, `lib/funnel`.
- How: Topics write `lib/push/preferences.ts`; Android 13 wording branch; yes and no recorded to the funnel.
- Layer: frontend. Priority: P0. Effort: S.

**FB8. Four celebrated moments, the rest calm**
- What: Listing submitted, booking confirmed, verification sent and first table reserved use `SuccessSheet` with the Vallo mark drawing in; everything else is banner only.
- Why: Celebrate what matters; animation everywhere cheapens it.
- Where: `components/ui/SuccessSheet.tsx`, `app/css/success.css`, `docs/SUCCESS_MOMENTS.md`.
- How: SVG stroke animation on the cinematic token with three sparks (ruling 18 allows them round the object); skipped under reduced motion.
- Layer: frontend. Priority: P1. Effort: M.

## 5. Offline experiences

**OFF1. Freshness stamp on kept pages**
- What: A listing, stay or restaurant page served from cache shows "Saved on your device at 14:20. Price and availability may have changed." and swaps Book or Pay for "Check live price".
- Why: The brief: never present cached prices as live. The audit found no stamp.
- Where: `apps/web/public/sw.js`, `lib/offline/page-cache.ts`, `components/app/listing/ListingStickyBar.tsx`, `app/(app)/stay/[id]/StayFoot.tsx`.
- How: The service worker marks kept responses (a header plus a postMessage); a small hook reads it and the sticky bars change state until a live fetch succeeds.
- Layer: frontend, service worker. Priority: P0. Effort: M.

**OFF2. Offline screen with what they need**
- What: `/offline` adds Recently viewed, Saved (already `OfflineShelf`) and "Your next plan" for the coming 7 days (reference, address, time, host name), plus Retry and Home, and returns by itself when the signal comes back.
- Why: The R-reference the founder loved; today only packs and the shelf show.
- Where: `app/offline/OfflineScreen.tsx`, `app/offline/OfflineShelf.tsx`, `lib/offline/pack.ts`, `lib/search/memory.ts` (recently viewed).
- How: Extend the inspection pack model to stays and tables at confirmation, with no payment data; clear on sign-out via `ForgetOnSignOut`.
- Layer: frontend. Priority: P0. Effort: M.

**OFF3. OfflineTray on every side**
- What: Mount `OfflineTray` in the agent, host and admin layouts.
- Why: Audit: it lives only in the member layout, so a lister's queued edits are invisible.
- Where: `app/agent/layout.tsx`, `app/host/layout.tsx`, `app/(app)/layout.tsx:158`.
- How: Same component, same outbox.
- Layer: frontend. Priority: P1. Effort: S.

**OFF4. Keep the agent and host shell**
- What: The service worker keeps `/agent/dashboard`, `/agent/listings` and `/host` per viewer, so N5's switch opens on no data.
- Why: The founder's "switch on low or no data"; the agent side is never kept today.
- Where: `apps/web/public/sw.js` (never-keep list), `lib/offline/viewer-stamp.ts`.
- How: Allow those pages under the viewer stamp; earnings, payouts and money pages stay never-kept.
- Layer: service worker. Priority: P0. Effort: M.

**OFF5. Unsent text survives**
- What: Message drafts, review text, support forms and listing descriptions survive leaving, app kill and offline.
- Why: The thread draft is plain `useState` (`ThreadView.tsx:561`) and is lost on leave.
- Where: `app/(app)/messages/[id]/ThreadView.tsx`, `app/(app)/support/new`, `app/(app)/bookings/[bookingId]/review`.
- How: One `useDraft(key)` hook writing to IndexedDB with a short debounce, cleared on confirmed send, scoped by viewer, wiped on sign-out.
- Layer: frontend. Priority: P0. Effort: S.

**OFF6. Five connection states, one reaction**
- What: `ConnectionLine` tells slow, unstable (three failures in a minute), offline and back apart; "back" triggers safe replay and one summary banner.
- Why: The brief lists the states; replay today is silent.
- Where: `components/ui/ConnectionLine.tsx`, `lib/offline/retry-lost.ts`, `lib/offline/inflight-state.ts`, `lib/offline/replay-guard.ts`.
- How: Payments and bookings are never replayed automatically; they return as "Tap to finish your booking".
- Layer: frontend. Priority: P1. Effort: S.

**OFF7. "Keep on this phone" for chosen listings**
- What: A toggle on a saved listing that pre-caches its photos at Save-Data aware sizes.
- Why: A member viewing houses across town wants the photos without data.
- Where: `lib/offline/shelf.ts`, `lib/offline/shelf-store.ts`, `app/(app)/saved/SavedShelf.tsx`.
- How: Cap at 20 listings and 8 photos each at 640px; show the space used in Settings.
- Layer: frontend, service worker. Priority: P2. Effort: S.

## 6. Saving, favourites and collections

**SAV1. Save heart with feedback and a list**
- What: Instant fill with a small pop, confirm haptic, banner "Saved. Add to a list" whose action opens the existing lists sheet.
- Why: The most frequent action in a marketplace should feel the best.
- Where: `components/app/SaveControl.tsx`, `app/(app)/saved/Collections.tsx` ("Add to a list").
- How: Optimistic state, rollback with an error banner on failure.
- Layer: frontend. Priority: P0. Effort: S.

**SAV2. One Saved hub across verticals**
- What: `/saved` tabs: Places (listings, stays and restaurants together, filtered by type chips), Lists, Searches.
- Why: `saved_items` and `saved_places` are separate stores; members do not care which table holds a thing.
- Where: `app/(app)/saved/page.tsx`, `SavedBoard.tsx`, `app/(app)/saved/searches/page.tsx`, `lib/saved/places.ts`.
- How: One merged read sorted by saved date; N6 tab row.
- Layer: frontend. Priority: P1. Effort: M.

**SAV3. "Changes since you last looked"**
- What: Promote the existing change lines (price down, back on the market, new viewing times) to a strip at the top of Saved, plus an opt-in push.
- Why: The data exists (`public.listing_changes`) but shows as one muted line per card.
- Where: `lib/saved/changes.ts`, `lib/cron/jobs/new-match-alerts.ts`, `app/(app)/settings/notifications/NotificationMatrix.tsx`.
- How: Strip counts real changes only; tap filters Saved to the changed items.
- Layer: frontend, backend. Priority: P1. Effort: S.

**SAV4. Shared lists**
- What: Share a list with a partner or flatmate; they view and add.
- Why: House-hunting is rarely alone; it is also the seed of the signature feature (ACC1).
- Where: `saved_collections`, `saved_collection_items`, `lib/saved/collections-actions.ts`.
- How: New `saved_collection_members` table (viewer or editor) with RLS; invite through the share sheet; sign-in to join.
- Layer: backend, frontend. Priority: P2. Effort: M.

**SAV5. Compare from Saved**
- What: Select 2 to 4 saved places and open Compare from a sticky tray.
- Why: `SavedCompare.tsx` and `/compare` exist but are hard to reach.
- Where: `app/(app)/saved/SavedCompare.tsx`, `app/(app)/compare/CompareView.tsx`, `components/ui/BatchTray.tsx`.
- How: Select mode from long-press (IOS5) or a quiet "Compare" button in the Saved header.
- Layer: frontend. Priority: P2. Effort: S.

**SAV6. Alert state on each saved search**
- What: Each saved search shows Instant, Daily or Off as a segmented control and the count of new matches.
- Why: Members forget what they set; alerts are the reason to save a search.
- Where: `components/app/saved-searches/SavedSearchBoard.tsx`, `lib/saved/search-alerts.ts`, `lib/saved/instant-alerts.ts`.
- How: Writes through `lib/saved/searches-actions.ts`; banner on change.
- Layer: frontend. Priority: P1. Effort: S.

**SAV7. Signed-out saves carried into the account**
- What: Saving while signed out keeps the item on the phone and merges it after sign-in with "3 saved places moved to your account".
- Why: No sign-in wall at the first moment of interest.
- Where: `lib/saved/local.ts`, `app/(app)/saved/ShelfSync.tsx`.
- How: Merge on the first signed-in render; duplicates ignored.
- Layer: frontend. Priority: P1. Effort: S.

## 7. Property discovery

**PD1. Listing hero gallery**
- What: Full-bleed hero with round glass back, share and save buttons, a "1 / 12" counter, swipe, tap to the full viewer with pinch zoom, and a blurred placeholder first.
- Why: The listing detail is where trust is won; the references show the standard.
- Where: `components/app/listing/ListingGallery.tsx`, `PhotoViewer.tsx`, `PhotoFrame.tsx`, `components/ui/RemoteImage.tsx`.
- How: Store a dominant colour or tiny preview per photo at upload (`listing_photos`); fixed aspect ratio so nothing shifts.
- Layer: frontend, backend. Priority: P0. Effort: M.

**PD2. One detail order for every listing type**
- What: Hero, title with area and verified tag, three key facts, the move-in total (`ListingMoveIn`), lister card with message button, map, amenities, reviews, similar; the sticky bar shows price and one primary action.
- Why: 60-plus listing components assemble differently by type.
- Where: `app/(app)/listing/[id]/page.tsx`, `components/app/listing/DetailAnatomy.tsx`, `ListingSectionTabs.tsx`, `ListingStickyBar.tsx`.
- How: `DetailAnatomy` owns the order; types add or remove blocks, never reorder.
- Layer: frontend. Priority: P1. Effort: M.

**PD3. Home rails restyled from real data**
- What: The existing rails (`HomeStreams`, `CityRow`, new listings) use large rounded photo cards with a glass type tag and a beds and baths tag, headings with the Vallo stop (VIS4), and hide when under 3 items.
- Why: The Explore references feel rich because cards are big and quiet.
- Where: `components/app/home/HomeStreams.tsx`, `CityRow.tsx`, `HomeListingCard.tsx`, `new-listings.ts`.
- How: Card model from `components/app/listing-card-model.ts`; no invented rails.
- Layer: frontend. Priority: P1. Effort: M.

**PD4. Card to detail continuity**
- What: The tapped card's photo grows into the detail hero; back reverses it.
- Why: Spatial continuity is what makes native apps feel fluid.
- Where: `components/app/ListingCard.tsx` (the note near line 331), `components/motion/RouteTransition.tsx`.
- How: View Transitions where the WebView supports them, a fade elsewhere; only the photo is named; off under reduced motion.
- Layer: frontend. Priority: P2. Effort: M.

**PD5. Map with a results sheet**
- What: The map view gets a bottom sheet of results with peek, half and full detents and clustered price pins.
- Why: The pattern people know from travel apps; today the map and list are separate modes.
- Where: `components/app/search/RealMap.tsx`, `MapCanvas.tsx`, `MapDock.tsx`, `MapListPill.tsx`.
- How: Reuse Sheet detents; tile provider per "Needs the founder".
- Layer: frontend. Priority: P1. Effort: L.

**PD6. Share a listing as a card**
- What: Share sends a branded image (photo, price, area, Vallo mark) with the link through the native share sheet.
- Why: Listings travel on WhatsApp; a good card brings people back.
- Where: `components/app/listing/ListingActions.tsx`, `lib/share`, `lib/native/share-bridge.ts`.
- How: Generate from the existing Open Graph image route; `Share.share` with the file on native.
- Layer: frontend, API. Priority: P2. Effort: S.

**PD7. Area facts with sources**
- What: An area block with real commute reports, nearby places and the asking-price spread from Price check, each with its source line.
- Why: Honest local knowledge is a Vallo advantage over a bare listing.
- Where: `components/app/listing/ListingNeighbours.tsx`, `AreaMap.tsx`, `commute_reports`, `app/(app)/price`.
- How: Hidden when a source has too few rows; never "estimated value" wording.
- Layer: frontend. Priority: P2. Effort: S.

**PD8. One trust strip under the title**
- What: Group verified lister, proof of supply, reply time and last let into one "Why you can trust this" strip.
- Why: Trust signals exist but are scattered down the page.
- Where: `components/app/listing/ProofStrip.tsx`, `ReplyTimeLine.tsx`, `LastLetLine.tsx`, `VerifiedAgentBadge.tsx`.
- How: Show only true signals (`earned-trust.ts`); tap opens a sheet explaining each.
- Layer: frontend. Priority: P1. Effort: S.

## 8. Vallo Stays

**ST1. Date range sheet**
- What: Replace native date inputs with a range calendar sheet: blocked nights greyed, nightly price on open days, nights and total in the sticky footer.
- Why: Native date fields look like a web form at the heart of the Stays journey.
- Where: `components/app/stays/StaysDatesRow.tsx`, `StayFilterSheetPanel.tsx`, `app/(app)/stay/[id]/StayDatesForm.tsx`, `lib/availability`.
- How: One `DateRangeSheet` on the upgraded Sheet; availability read once per month in view.
- Layer: frontend, API. Priority: P0. Effort: M.

**ST2. Guests and rooms in one sheet**
- What: Adults, children and rooms with the `Quantity` control; the search bar reads "2 guests, 1 room".
- Why: One clear control instead of scattered fields.
- Where: `components/app/stays/StaySearchBar.tsx`, `components/ui/Quantity.tsx`.
- How: Limits from the room types; carried in the URL like the dates (`stays-dates-carried.ts`).
- Layer: frontend. Priority: P1. Effort: S.

**ST3. Same price breakdown on detail and checkout**
- What: Nightly rate times nights, cleaning, service fee, declared charges at the door, total, identical in both places.
- Why: A total that changes between screens destroys trust.
- Where: `app/(app)/stay/[id]/StayCost.tsx`, `app/(app)/checkout/[bookingId]/CheckoutSummary.tsx`.
- How: One shared breakdown model from `lib/bookings/checkout-view.ts`.
- Layer: frontend. Priority: P0. Effort: S.

**ST4. A calm hold countdown**
- What: A slim bar "Held for you for 14:59", a warning haptic at 2 minutes, and "Hold again" on expiry instead of an error.
- Why: Payment pressure should feel fair, not alarming.
- Where: `app/(app)/checkout/[bookingId]/HoldCountdown.tsx`.
- How: Server time is the source; re-hold calls the existing reserve action.
- Layer: frontend. Priority: P1. Effort: S.

**ST5. Arrival day kit**
- What: On arrival day the booking pass shows check-in time, address with "Open in Maps", host contact, and house rules and Wi-Fi when the host provides them, kept offline (OFF2).
- Why: The moment a guest most needs Vallo is often the moment the signal is worst.
- Where: `lib/bookings/arrival.ts`, `app/host/arrival`, `components/app/inspections/ViewingDayKit.tsx` (pattern to reuse).
- How: Only fields the host entered; contact after the phone moment.
- Layer: frontend. Priority: P1. Effort: M.

**ST6. Room type cards**
- What: Room types as cards (photo, beds, capacity, nightly price, rooms left); the chosen one tinted with a tick (R11 pattern).
- Why: Choosing a room is a comparison, not a dropdown.
- Where: `app/(app)/stay/[id]/RoomTypes.tsx`, `StayPick.tsx`.
- How: "Rooms left" only when the count is real.
- Layer: frontend. Priority: P1. Effort: S.

## 9. Restaurant discovery and reservations

**RS1. Reserve a table in one sheet**
- What: Day chips (Today, Tomorrow, dates), party size with `Quantity`, real time slots as a grid, then the deposit step only when the venue asks for one.
- Why: Dinner booking should take three taps.
- Where: `app/(app)/listing/[id]/ReserveTable.tsx`, `table-windows.ts`, `components/app/reservations/DepositStep.tsx`, `lib/reservations/actions.ts`.
- How: Slots from `table-windows.ts`; StepFrame-lite inside the Sheet; success moment (FB8) on the first reservation.
- Layer: frontend. Priority: P0. Effort: M.

**RS2. Restaurant filters that matter tonight**
- What: Chips on `/restaurants`: Open now, Takes reservations, No deposit, cuisine.
- Why: "Where can we eat now" is the real question.
- Where: `app/(app)/restaurants/page.tsx`, `lib/stays/hours.ts` (`hoursLabel`), `lib/stays/queries.ts` (`listRestaurants`).
- How: Open now reads service windows; hidden for venues without hours.
- Layer: frontend, API. Priority: P1. Effort: S.

**RS3. Restaurant page anatomy**
- What: Hero, open status, price band, menu photos, hours table, map, reviews, sticky "Reserve a table".
- Why: Restaurant pages should share the listing page's rhythm (PD2).
- Where: `app/(app)/restaurant/[id]/RestaurantFace.tsx`, `reservation_reviews`.
- How: Stand-in plates (`restaurant-plates.ts`) stay labelled as stand-ins.
- Layer: frontend. Priority: P1. Effort: M.

**RS4. Reservation pass and reminders**
- What: A pass (name, party, time, venue, reference), Add to calendar, and a reminder push 2 hours before.
- Why: Fewer no-shows, fewer lost deposits.
- Where: `components/app/plans/TripSpine.tsx`, `lib/reservations/queries.ts`, `reservation_reminders`, `components/app/inspections/InspectionSheet.tsx` (calendar file pattern).
- How: Calendar file from the same generator as inspections.
- Layer: frontend, backend. Priority: P1. Effort: S.

**RS5. Running late and change party size**
- What: From the pass: "Running 15 minutes late", "Change party size", "Cancel" with the deposit rule shown first.
- Why: Common real-life changes without a phone call.
- Where: `lib/venue-messages`, `lib/reservations/deposit-rules.ts`, `lib/reservations/seating-actions.ts`.
- How: Quick replies post into the venue thread; party size re-checks the slot.
- Layer: frontend, backend. Priority: P2. Effort: M.

**RS6. Pay the bill from the pass**
- What: During the seating window the pass shows "Pay the bill" into the existing bill-pay flow.
- Why: The feature exists (`lib/reservations/bill-pay.ts`, `BillReturnCheck`) but is hard to find.
- Where: `components/app/reservations/TableSeatingPanel.tsx`, `app/(app)/bookings/page.tsx`.
- How: Face ID before paying (SEC2).
- Layer: frontend. Priority: P2. Effort: S.

## 10. Messaging and communication

**MSG1. Composer rebuilt (decided)**
- What: A slim rounded field that grows from 1 to 5 lines, an attach menu (photo, camera, document, a listing), and a mic that becomes the send button when there is text.
- Why: The composer is a single-line `<input type="text">` with a photo button.
- Where: `app/(app)/messages/[id]/ThreadView.tsx` (around lines 1720 to 1745), composer CSS `nf-composer`.
- How: A textarea; on phones Return adds a line and the button sends; on desktop Enter sends. Same composer in `AssistantChat`.
- Layer: frontend. Priority: P0. Effort: M.

**MSG2. Voice notes end to end (decided)**
- What: Hold to record, slide left to cancel, slide up to lock, live waveform, playback at 1x, 1.5x and 2x.
- Why: No recording exists; the player has no data and the bucket allows only images and PDF (audit section 9).
- Where: `components/app/messages/VoiceNote.tsx`, `voice.ts`, `attachment.ts`, `message_attachments`, the attachments storage bucket.
- How: MediaRecorder in the WebView (audio/mp4 on iOS); microphone permission is already declared on both platforms, so no build; bucket and mime migration; cap length (see "Needs the founder").
- Layer: frontend, backend. Priority: P0. Effort: L.

**MSG3. Reactions (decided)**
- What: Long-press any message, voice note or call entry for a row of six reactions; counts under the bubble, live.
- Why: The founder asked for it; no table exists.
- Where: `components/app/messages/BubbleGestures.tsx`, `MessageMenu.tsx`, new `message_reactions` table.
- How: Unique (message, member, emoji), RLS on conversation membership, Realtime with `ownChannelName()`.
- Layer: frontend, backend. Priority: P0. Effort: M.

**MSG4. True delivery states**
- What: Sending, Sent, Delivered, Read and Failed with Retry, each backed by the server.
- Why: "Delivered" never shows because there is no column.
- Where: `lib/messages/delivery.ts`, `messages` table, thread ticks in `ThreadView.tsx`.
- How: A `delivered_at` set when the recipient's device receives the row; never inferred.
- Layer: frontend, backend. Priority: P1. Effort: M.

**MSG5. Vallo Assistant pinned in the inbox (decided)**
- What: Always the first inbox row, present with no other chats; inside, "Talk to a person" opens the support chat as an inner page linked to `support_tickets`.
- Why: Help lives where members already look.
- Where: `app/(app)/messages/Inbox.tsx`, `components/app/assistant`, `app/(app)/support/messages`, `app/admin/support`.
- How: Staff replies appear in that inner thread; the AI never claims to be a person; update `docs/AI-ASSISTANT.md`.
- Layer: frontend, backend. Priority: P0. Effort: M.

**MSG6. Report a message**
- What: Long-press a bubble, Report, a short reason list and optional note.
- Why: No Report exists on a message bubble (audit section 11).
- Where: `components/app/messages/MessageMenu.tsx`, `lib/reports`, `components/app/ReportSheet.tsx` (merge the two `ReportSheet`s).
- How: Sends the message id and a short window of context to the safety desk (SEC3).
- Layer: frontend, backend. Priority: P0. Effort: S.

**MSG7. Inbox that scales**
- What: Search across conversations, swipe to archive or mark unread, the listing thumbnail on each row.
- Why: Busy listers have dozens of threads; the views exist but finding a person does not.
- Where: `app/(app)/messages/Inbox.tsx` (views recent, unread, requests, archived, reported), `lib/messages/archive.ts`.
- How: Search reads counterpart name, listing title and last message; swipe uses `lib/ui/use-swipe-to-close.ts` mechanics.
- Layer: frontend, API. Priority: P1. Effort: M.

**MSG8. New-message button and first-unread landing**
- What: Scrolled up, a small floating "1 new message" button (soft-cornered); opening a thread lands on the first unread under a divider.
- Why: Losing your place in a chat is a classic web-chat flaw.
- Where: `components/app/messages/ThreadDividers.tsx`, `ThreadView.tsx`.
- How: IntersectionObserver on the last bubble.
- Layer: frontend. Priority: P1. Effort: S.

**MSG9. Photo upload progress per photo**
- What: A progress ring on each photo in the bubble, retry on the one that failed, grouped albums.
- Why: The brief asks for upload progress; a silent upload looks broken on 3G.
- Where: `components/ui/PendingRing.tsx`, `components/app/messages/PhotoGroup.tsx`, `AttachmentRow.tsx`.
- How: Upload progress events; the message sends only after every photo lands.
- Layer: frontend. Priority: P1. Effort: S.

## 11. Booking management

**BK1. One booking pass page**
- What: `/bookings/[bookingId]` with a status timeline (Requested, Confirmed, Paid, Check-in, Completed), reference, dates, address, host card and actions: Message, Directions, Add to calendar, Cancel, Receipt.
- Why: One answer to "where is my booking and what next".
- Where: `app/(app)/bookings/[bookingId]/BookingDetailCard.tsx`, `booking_state_events`, `lib/bookings/lifecycle.ts`, `components/ui/Tracker.tsx`.
- How: Timeline reads real state events; the next action is the one primary button.
- Layer: frontend. Priority: P0. Effort: M.

**BK2. Add to calendar for stays and tables**
- What: Calendar files for stays and reservations, as inspections already have.
- Why: Members live by their phone calendar.
- Where: `components/app/inspections/InspectionSheet.tsx` (existing generator), BK1, RS4.
- How: Share the generator; include the address and reference.
- Layer: frontend. Priority: P1. Effort: S.

**BK3. Refund preview before cancelling**
- What: `CancelBookingSheet` shows the naira refund and when it arrives before the confirm step.
- Why: People cancel with confidence when the money is clear.
- Where: `components/app/bookings/CancelBookingSheet.tsx`, `booking_cancellation_terms`, `booking_refund_parts`.
- How: Same calculation as the server; destructive confirm per ruling 19.
- Layer: frontend. Priority: P0. Effort: S.

**BK4. A "Today" card on Plans**
- What: At the top of Plans, anything happening today with its single next action.
- Why: Plans already merges three lists; today's item deserves top billing.
- Where: `components/app/plans/ComingUp.tsx`, `app/(app)/bookings/page.tsx`.
- How: Lagos day boundaries (`lagosToday`).
- Layer: frontend. Priority: P1. Effort: S.

**BK5. Receipts in one tap**
- What: Paid bookings show Receipt, opening a Sheet with Share and Save as PDF.
- Why: Receipts are needed for work claims and disputes.
- Where: `app/(app)/receipts`, `lib/receipts`.
- How: Existing receipt data; the Sheet links to the full page.
- Layer: frontend. Priority: P1. Effort: S.

**BK6. Review prompt at the right moment**
- What: A day after checkout or a reservation, a push and a Plans card open a short review flow (stars, highlight chips, text).
- Why: Reviews feed trust; asking at the right time gets honest ones.
- Where: `app/(app)/bookings/[bookingId]/review`, `reviews`, `reservation_reviews`.
- How: Built on StepFrame; banner "Review sent" (FB1).
- Layer: frontend, backend. Priority: P1. Effort: S.

**BK7. Rent reminders with a Pay action**
- What: `RentCountdowns` drive reminders at 30, 7 and 1 days with a Pay action that opens the right screen.
- Why: Rent is the largest money moment for a tenant.
- Where: `components/app/plans/RentCountdowns.tsx`, `lib/rent`, `lib/notify/templates.ts`.
- How: Push respects the member's switches; Face ID at pay (SEC2).
- Layer: frontend, backend. Priority: P2. Effort: S.

**BK8. Wallet pass for stays (later)**
- What: "Add to Apple Wallet" and Google Wallet for confirmed stays, with the check-in time on the lock screen.
- Why: A premium native touch that Hauslet does not show.
- Where: BK1, a new server route for the pass.
- How: Needs an Apple pass certificate and signing (see "Needs the founder").
- Layer: backend, native build. Priority: P2. Effort: L.

## 12. Property publishing and management

**PUB1. Wizard split by step on StepFrame (decided)**
- What: Move each step of `ListingWizard.tsx` (4,733 lines) into its own file rendered by the shared StepFrame: eyebrow, one question, Continue, Step N of M.
- Why: The single biggest "no plan" smell, and why steps feel different (audit section 8).
- Where: `app/agent/list/ListingWizard.tsx`, new `app/agent/list/steps/`.
- How: Keep the server draft per step, the device copy and every rule (supply proof, SCUML mandate, photo rules); the existing `ListingWizard.*.dom.test.tsx` suites must stay green.
- Layer: frontend. Priority: P0. Effort: L.

**PUB2. "Saved" tick and resume**
- What: Top bar shows Saving, then a green Saved tick, or "Saved on this phone" offline; returning shows "Continue your draft: 2-bed in Yaba, step 5 of 12".
- Why: Listers fill this on the move; they must trust nothing is lost.
- Where: StepFrame top bar, `app/agent/list/page.tsx`, `lib/offline/outbox.ts`.
- How: Tick reflects the real server write.
- Layer: frontend. Priority: P0. Effort: S.

**PUB3. "Check your listing" review**
- What: A summary card, each answer with a quiet Change button, and a "Things to fix" banner (verify identity, one more photo, charges at the door, mandate) with links; Submit enabled when the list is empty.
- Why: Today charges at the door and the SCUML mandate are enforced only at admin publish, so listers learn late.
- Where: the wizard's submit step, `app/agent/list/ListingSentForReview.tsx`, `listing_mandates`.
- How: Each fix returns to the review after.
- Layer: frontend. Priority: P0. Effort: M.

**PUB4. Move-in charges as cards with a live total**
- What: Charge chips (Caution, Legal, Agency, Service charge and more); each chosen one becomes a card (amount, naira or percent, Once, Yearly, Monthly) and a live "A tenant pays to move in" total.
- Why: The true move-in cost is Vallo's honesty promise; extra charges are not in the wizard today.
- Where: the pricing step, `components/app/listing/move-in-lines.ts` (the same lines the detail page reads), `ListingMoveIn.tsx`.
- How: One model for wizard and detail so the total matches.
- Layer: frontend, backend. Priority: P0. Effort: M.

**PUB5. Photo step like a native app**
- What: Pick many from the library or the camera, progress per photo, drag to reorder, cover badge, "Add 2 more photos" banner, and rule checks per photo (size, duplicate).
- Why: Photos decide whether a listing gets seen.
- Where: the photos step, `@capacitor/camera`, `lib/photo-hash`, `listing_photos`, `listing_photo_slots`.
- How: Upload in parallel with a cap of three on weak signal.
- Layer: frontend, Capacitor. Priority: P0. Effort: M.

**PUB6. AI description writer with consent and undo**
- What: "Write with AI" opens a consent sheet naming the provider and what is shared, shows what changed, and offers Undo; the counter reads "73 / 40 words minimum".
- Why: The brief asks for this exactly.
- Where: the description step, `lib/ai/consent.ts`, `app/agent/list/BroadcastPaste.tsx` (existing AI prefill).
- How: The previous text is kept for one-tap undo; nothing is published without the lister's edit or OK.
- Layer: frontend, API. Priority: P1. Effort: M.

**PUB7. Full-screen pin picker**
- What: A full-screen map with a fixed centre pin, "Place the pin on the entrance", "Use my location only if you are standing there", "Use this pin".
- Why: Exact pins make viewings and arrivals work.
- Where: the location step, `components/app/maps`, `lib/maps/tiles.ts`.
- How: Map choice per "Needs the founder"; works without location permission.
- Layer: frontend. Priority: P1. Effort: M.

**PUB8. Listings workspace with counts**
- What: `/agent/listings` gets a segmented control with counts (All, Rentals, Sales, Stays), status tags (Draft, In review, Live, Paused), quick actions and an "Add listing" FAB.
- Why: The R-reference shows how calm this can be.
- Where: `app/agent/listings/ListingsWorkspace.tsx`, `BulkBar.tsx`, `components/ui/Fab.tsx`.
- How: Counts from real rows; FAB clear of the dock.
- Layer: frontend. Priority: P1. Effort: M.

**PUB9. Agent Activity inbox**
- What: One Activity screen with Bookings, Applications and Viewings, a status tab row with counts, a search by listing or reference, and designed empty states.
- Why: Audit: no single activity inbox on the agent side (R14).
- Where: `app/agent/bookings`, `app/agent/inspections`, `lib/inspections`, new `app/agent/activity`.
- How: Reads existing tables only; the old pages redirect into tabs.
- Layer: frontend. Priority: P1. Effort: M.

**PUB10. Month calendar across listings**
- What: A month grid of rounded day cells with a legend of counts (Check-in, Check-out, Viewing, Blocked); tap a day for its events and quick block or unblock.
- Why: R13; the visit calendar exists but not across all listings.
- Where: `lib/visit-calendar`, `app/host/calendar`, `app/agent/inspections`.
- How: One calendar component for host and agent.
- Layer: frontend. Priority: P2. Effort: M.

## 13. Forms and input experiences

**FRM1. Next and Done on every form**
- What: Return moves to the next field, the last field says Done and submits.
- Why: Founder section 3.
- Where: `lib/ui/form-keys.ts`, `components/ui/FormKeys.tsx`, sign-up, profile edit, `app/(app)/support/new`, booking requests, wizard steps.
- How: Apply the existing helper; a test that every form field has an `enterKeyHint`.
- Layer: frontend. Priority: P0. Effort: S.

**FRM2. The right keyboard for each field**
- What: Numeric for naira, phone pad for phone, email keyboard, autofill tokens (name, email, tel, one-time-code, street-address), capital words for names.
- Why: The wrong keyboard is a small daily friction members notice.
- Where: `components/ui/NairaField.tsx`, `components/app/PhoneField.tsx`, `components/auth/fields.tsx`, `components/ui/Field.tsx`.
- How: Defaults on the field components so pages cannot forget.
- Layer: frontend. Priority: P0. Effort: S.

**FRM3. Accessible inline validation**
- What: Errors under the field on blur, a summary at the top on submit that moves focus to the first error, a warning haptic.
- Why: Errors shown while typing feel hostile; errors only at the top get missed.
- Where: `components/ui/Field.tsx`, `lib/ui/feedback.ts`.
- How: `aria-describedby` and `aria-invalid`; plain sentences that say how to fix.
- Layer: frontend. Priority: P0. Effort: S.

**FRM4. One field anatomy**
- What: Label above, 48px height, the 12px corner, hairline edge, 1.5px blue focus edge, helper and counter on one line under.
- Why: Fields drawn in different ways are the fastest path to "amateur".
- Where: `components/ui/Field.tsx`, `NairaField.tsx`, `components/app/PhoneField.tsx`, `components/auth/CodeInput.tsx`.
- How: Tokens only, enforced by `scripts/check-css-tokens.mjs`.
- Layer: frontend. Priority: P0. Effort: M.

**FRM5. Long choices in a searchable sheet**
- What: States, areas, banks and countries open a Sheet with search and a Popular group (Nigeria first).
- Why: Native selects with 36 states are slow to scroll.
- Where: `components/app/place/ChoicePicker.tsx`, `PlaceFields.tsx`.
- How: Short lists stay as segmented or radio rows.
- Layer: frontend. Priority: P1. Effort: M.

**FRM6. Smart paste**
- What: Paste a phone number in any format, a six-digit code into the code boxes, a bank account number and see the bank suggested.
- Why: People copy from WhatsApp and SMS all day.
- Where: `components/auth/CodeInput.tsx`, `components/app/PhoneField.tsx`, payout bank forms.
- How: Normalise on paste; tests exist for phone paste and can be extended.
- Layer: frontend. Priority: P2. Effort: S.

**FRM7. Leaving a half-filled form asks first**
- What: "Discard changes?" sheet on back, swipe back and Android back when a form is dirty.
- Why: Losing typed text is the worst form experience.
- Where: `lib/ui/use-back-guard.ts`, `lib/native/back-button.ts`, IOS2.
- How: Paired with OFF5 so most forms never need to ask.
- Layer: frontend. Priority: P1. Effort: S.

## 14. Search and filtering

**SRC1. A useful search opening state (R3)**
- What: Segmented Rent, Buy, Stays, Tables; a Near me row; Recent searches; Saved searches with alert dots; Popular areas from real listing counts.
- Why: Search should help before a word is typed.
- Where: `app/(app)/search/page.tsx`, `components/app/search/RecentSearches.tsx`, `NearMeChip.tsx`, `lib/areas`.
- How: Popular areas hidden under a real-count floor; segment sets `market`.
- Layer: frontend, API. Priority: P0. Effort: M.

**SRC2. Live count on the filter drawer**
- What: The footer reads "Show 48 places" and updates as filters change; Clear all at the top.
- Why: Zero-result dead ends are the worst search experience.
- Where: `components/app/filters/FilterDrawer.tsx`, `FilterDrawerPanel.tsx`, `filter-count.ts`.
- How: A debounced count query; "No places match. Try removing the price limit." when zero.
- Layer: frontend, API. Priority: P0. Effort: M.

**SRC3. Applied filters as a chip row**
- What: Under the search bar, scrolling chips for each applied filter with a remove x, and "Filters (3)".
- Why: Members see and undo what they set in one tap.
- Where: `app/(app)/search/page.tsx`, `components/ui/Chip.tsx`.
- How: Chips are round per ruling 17; select haptic on remove.
- Layer: frontend. Priority: P1. Effort: S.

**SRC4. Suggestions while typing**
- What: Area and estate completion, listing codes, and "Search for 'Lekki' in Stays".
- Why: Nigerian addresses are spelled many ways.
- Where: `lib/areas`, `components/app/listing/ListingCode.tsx`, `components/app/search/SearchPillMorph.tsx`.
- How: Local area list first, server second; no network per keystroke on Save-Data.
- Layer: frontend, API. Priority: P1. Effort: M.

**SRC5. Sort as a dropdown**
- What: "Sort by" (Newest, Price low to high, Price high to low, Nearest) using the `DropdownButton`.
- Why: A standard control people expect above results.
- Where: `components/ui/DropdownButton.tsx`, `lib/listings/search-params.ts`.
- How: Nearest appears only with a location.
- Layer: frontend. Priority: P2. Effort: S.

**SRC6. Empty results that help**
- What: "No 3-bed in Ikoyi under N5m. 12 places match without the price limit." with one tap to relax and "Get alerts for this search".
- Why: Turn a dead end into a saved search.
- Where: `components/app/search/DiscoveryEmpty.tsx`, `components/app/saved-searches/SaveSearchControl.tsx`.
- How: Counts per relaxed filter from the same query.
- Layer: frontend, API. Priority: P1. Effort: S.

**SRC7. Near me with a Vallo pre-prompt**
- What: Location is asked only on tapping Near me, after a short Vallo sheet saying why; denial falls back to choosing an area.
- Why: A declined system prompt is permanent on iOS; ask once, well.
- Where: `components/app/search/NearMeChip.tsx`, `MapCanvas.tsx`.
- How: Web geolocation inside the WebView (location strings already declared); remember a "Not now".
- Layer: frontend. Priority: P0. Effort: S.

## 15. User accounts and profiles

**ACC1. Vallo's signature feature: "Vallo Circle" (recommended name)**
- What: A verified, consent-based circle of people you live, travel and eat with: find a co-renter, shortlist together (SAV4), split a stay, book a table for the group, and see each other's trust passports.
- Why: The founder wants Vallo's own answer to Hauslet's roommate feature, better because it spans all four Vallo worlds and the feed.
- Where: `/around` feed and people (`app/(app)/around`), `app/(app)/passport`, `saved_collections`, a new `circles` and `circle_members` pair with RLS.
- How: Mutual yes before anything is shared; verified members only; block and report on every member. Names to put to the founder: Vallo Circle, Yardmates, Vallo Kin, Co-let, Nest by Vallo.
- Layer: backend, frontend. Priority: P2. Effort: L.

**ACC2. Profile hub card (R10)**
- What: Avatar, name, "Member since", three stats in a sunken strip (Reviews, Rating, Verified), and "Complete your profile" with a progress ring (photo, phone, ID, passcode), each dismissible.
- Why: One calm card replaces scattered rows and shows what to do next.
- Where: `app/(app)/profile/AccountHero.tsx`, `AccountBody.tsx`, `PassportRows.tsx`.
- How: Checklist reads real state; the phone row waits until the first deal (decided).
- Layer: frontend. Priority: P1. Effort: M.

**ACC3. Personal information page**
- What: Legal name, Display name, Email (masked), Phone ("Not provided" with why it is asked), ID verification status, Address, Emergency contact, each with a quiet Edit or Add.
- Why: This is where phone and ID live now that sign-up is short.
- Where: `app/(app)/settings/account`, `app/(app)/settings/phone`, `app/(app)/verification`.
- How: Each row opens a Sheet editor; Face ID before showing full details (SEC2).
- Layer: frontend. Priority: P1. Effort: M.

**ACC4. Public profile with trust first**
- What: `/u/[handle]` leads with the passport summary and verified tags, then listings and reviews, follow, and Report this person.
- Why: A person is reportable only as a social profile today.
- Where: `app/(app)/u/[handle]/page.tsx`, `app/(app)/passport/[who]`, `lib/reports`.
- How: Report routes to safety (SEC3).
- Layer: frontend. Priority: P1. Effort: S.

**ACC5. Devices and sign-in history**
- What: Device name, last active and approximate place; sign out one device; Face ID to remove.
- Why: Members feel safe when they can see and end sessions.
- Where: `app/(app)/settings/devices`, `app/(app)/settings/DevicesCard.tsx`.
- How: Existing device rows; banner "Signed out of iPhone 12".
- Layer: frontend, backend. Priority: P2. Effort: S.

**ACC6. Privacy choices sheet (R2)**
- What: One plain screen after the first useful screen: what is measured and why, two equal-weight rectangular buttons (Accept all, Only necessary) and "Choose what to share"; Settings, Privacy shows the choice and date.
- Why: No such consent surface exists in the code today; honest choice builds trust.
- Where: `app/(app)/settings/privacy`, `lib/observability/vitals.ts`, `lib/funnel`.
- How: Measurement code reads the choice; never shown before the first screen on a cold start.
- Layer: frontend. Priority: P1. Effort: M.

**ACC7. Clear account deletion**
- What: Delete account explains what goes, what the law keeps (ledger records), and confirms with Face ID (decided).
- Why: Required by both stores and a trust signal.
- Where: `app/(site)/delete-account`, `app/(app)/settings/DeleteAccountPanel.tsx`, `lib/account-deletion/plan.ts`.
- How: Shows open bookings or balances that block deletion first.
- Layer: frontend. Priority: P1. Effort: S.

## 16. Onboarding and authentication

**ONB1. Stacked sheets after first sign-in (R4, R5)**
- What: "Welcome to Vallo" banner, then a "Confirm your name" sheet pre-filled from Apple or Google with "This is how hosts will see you", then "Add a photo" (choose or take), then the notify beat (FB7).
- Why: Calm one-question steps over the real app behind a blur.
- Where: `components/app/welcome/FirstRun.tsx`, `ArrivalAsks.tsx`, `components/auth/FinishSetupForm.tsx`.
- How: Each sheet has a quiet "Skip for now"; banners replace each other (FB2).
- Layer: frontend. Priority: P1. Effort: M.

**ONB2. Sign-in choices ordered by platform**
- What: Apple first on iOS, Google first on Android and web, then email code; passkey offered on a known device.
- Why: The fastest door should be the first one.
- Where: `components/auth/AuthChoices.tsx`, `SocialDoors.tsx`, `NativeAppleSignIn.tsx`, `PasskeySignIn.tsx`.
- How: `lib/native/platform.ts` picks the order; same buttons, ruling 19 shapes.
- Layer: frontend. Priority: P1. Effort: S.

**ONB3. Code entry that fills itself**
- What: One-time-code autofill, auto-submit on the sixth digit, a resend timer.
- Why: The sign-in code is the most repeated form in the app.
- Where: `components/auth/CodeInput.tsx`, `VerifyCodeForm.tsx`, `CodeSignInForm.tsx`.
- How: `autocomplete="one-time-code"` on one hidden input feeding the boxes.
- Layer: frontend. Priority: P0. Effort: S.

**ONB4. The Vallo Community Promise (R6)**
- What: A full page in Vallo's own words: fair treatment, honest listings, no off-platform payments, with Decline and "Agree and continue".
- Why: Sets the tone and gives moderation a clear basis.
- Where: `components/auth/AcceptTerms.tsx`, `app/(site)/standards`.
- How: Asked once before the first message or deal, not at sign-up (see "Needs the founder").
- Layer: frontend, backend. Priority: P2. Effort: S.

**ONB5. One short interests step**
- What: `InterestChoices` on one screen of chips by world (Rent, Buy, Stays, Tables, Feed) with Skip.
- Why: Personalises Home without slowing the first minute.
- Where: `components/app/welcome/InterestChoices.tsx`, `lib/interests`.
- How: Writes the existing interests; Home reads them.
- Layer: frontend. Priority: P2. Effort: S.

**ONB6. The deal gate (decided rules, one surface)**
- What: At a booking request, listing submit, wallet or payout, a "1 thing to fix" sheet lists what is missing (phone confirmation, then verification) and returns the member to the deal afterwards.
- Why: Sign-up stays short; checks happen only when they matter.
- Where: `lib/identity/phone-gate.ts`, `components/app/PhoneGateLink.tsx`, `components/app/after-gate`, `components/verification/KycFlow.tsx`.
- How: One gate reader for all deal moments; verification opens the decided 7-step stepper; `next=` returns.
- Layer: frontend, backend. Priority: P0. Effort: M.

**ONB7. Browse everything signed out**
- What: Signed-out members browse every listing, stay and restaurant; sign-in appears only at Save, Message or Book, as a sheet that returns them.
- Why: Walls before value lose people.
- Where: `components/auth/auth-intent.ts`, `components/auth/AuthGate.tsx`, `apps/web/src/proxy.ts`.
- How: Saves kept locally (SAV7).
- Layer: frontend. Priority: P1. Effort: S.

## 17. Loading and performance

**PERF1. Baseline and budgets**
- What: Measure cold start, warm start, time to usable Home, JavaScript per route and memory after a 10-minute browse on a budget Android and an older iPhone; set budgets.
- Why: The brief forbids invented numbers; `scripts/check-tti.mjs` is wired nowhere.
- Where: `apps/web/scripts/check-tti.mjs`, `apps/web/scripts/check-weight.mjs`, `lib/observability/vitals.ts`, `components/app/VitalsReporter.tsx`, `lib/native/boot-trace.ts`.
- How: Run the checks in the local gate; record numbers in the performance report, simulated and device results labelled apart.
- Layer: frontend. Priority: P0. Effort: M.

**PERF2. Skeletons shaped like the content**
- What: Every `loading.tsx` on member routes draws the real layout (cards, rows, header), never a spinner alone.
- Why: Perceived speed, and the brief bans spinner-only screens.
- Where: `components/app/ScreenSkeleton.tsx`, `components/ui/Skeleton.tsx`, `app/(app)/*/loading.tsx`.
- How: A handful of presets (list, card grid, detail, thread) used everywhere.
- Layer: frontend. Priority: P0. Effort: M.

**PERF3. Right-sized images**
- What: A `sizes` value per card slot, modern formats, 640px on Save-Data, high fetch priority only on the hero.
- Why: Images are most of the bytes on a Nigerian data bundle.
- Where: `components/ui/RemoteImage.tsx`, `lib/images/optimisable.ts`, `apps/web/next.config.ts`.
- How: The existing optimiser; no new image service.
- Layer: frontend. Priority: P0. Effort: S.

**PERF4. Load heavy pieces on demand**
- What: The map, calls, the photo viewer and the assistant load only when opened.
- Why: Only 6 files use dynamic loading today; budget phones pay for every byte parsed.
- Where: `components/app/search/RealMap.tsx`, `lib/calls`, `components/app/listing/PhotoViewer.tsx`, `components/app/assistant`.
- How: Dynamic imports with a skeleton; checked by `app/client-import-graph.test.ts`.
- Layer: frontend. Priority: P1. Effort: M.

**PERF5. Pagination and off-screen savings**
- What: Cursor pagination with the next page fetched at 70 percent scroll on Search, Feed, Notifications and the inbox; off-screen cards skip rendering.
- Why: Long lists are where WebViews drop frames and grow memory.
- Where: `app/(app)/search/page.tsx`, `app/(app)/around`, `LiveNotifications.tsx`, `Inbox.tsx`.
- How: `content-visibility: auto` on cards; one request in flight per list.
- Layer: frontend, API. Priority: P1. Effort: M.

**PERF6. Fewer stylesheet layers**
- What: Merge the 60 imported stylesheets toward one ordered system and delete dead layers.
- Why: CSS parse and style recalculation cost real time on budget Android, and the layers contradict each other.
- Where: `app/globals.css`, `app/side-nav.css`, `lib/motion/ease.ts` (duplicate curves).
- How: Tokens first, then components; each removal checked at 360x800 in both themes.
- Layer: frontend. Priority: P1. Effort: L.

**PERF7. Startup that shows the shell first**
- What: The splash hides on the shell's first paint; session restore and counts load after; dock roots prefetch on idle.
- Why: "I do not want users waiting five seconds."
- Where: `lib/native/splash.ts`, `lib/native/boot.ts`, `components/app/KeepWarm.tsx`.
- How: Measure with PERF1 before and after.
- Layer: frontend, Capacitor. Priority: P0. Effort: M.

**PERF8. Memory that stays flat**
- What: Realtime channels closed on unmount, image cache capped, viewers and maps unmounted when closed.
- Why: The brief asks for stable memory over long sessions.
- Where: `lib/messages/useRealtime.ts`, `lib/supabase/channel-name.ts`, `apps/web/public/sw.js` (image cache 200).
- How: A long-browse test that counts open channels and listeners.
- Layer: frontend. Priority: P1. Effort: M.

## 18. Visual design and animations

**VIS1. Page sweep on PageFrame (decided PageFrame)**
- What: Apply PageFrame plus one surface, radius and spacing scale to the 30 busiest routes first, then the rest via `docs/PAGE_SWEEP.md`.
- Why: The founder's "every single page"; consistency comes from shared frames, not hand-tuning.
- Where: `components/app/PageHeader.tsx` (103 users), `components/app/Screen.tsx`, `components/app/LargeTitleFold.tsx`.
- How: Each page passes the 4B definition of done at 390x844 and 360x800, light and dark.
- Layer: frontend. Priority: P0. Effort: L.

**VIS2. Thin chrome icons (decided)**
- What: Lean strokes in the header, drawer and dock with the active state as a fill; fold `SettingsGlyph`, `LineGlyph`, `AdminGlyph` and the 48 inline SVG files into `UiIcon`.
- Why: The bold chrome is the biggest reason the shell looks heavier than the references.
- Where: `design-system/icons/UiIcon.tsx`, `app/css/symbols.css`, `docs/ICON_SYSTEM.md`.
- How: One stroke per size; a test that product files import no inline SVG.
- Layer: frontend. Priority: P0. Effort: M.

**VIS3. One container language**
- What: Cards on the 18px radius, hero containers 22px, sheets 28px, hairline borders, shadows only on floating things.
- Why: Hauslet's calm comes from big rounded containers with almost no shadow.
- Where: `packages/design-tokens/src/tokens.css`, `components/ui/Panel.tsx`, `components/ui/SummaryCard.tsx`.
- How: Name the scale in `docs/UX_SYSTEM.md`; `check-css-tokens` refuses stray values.
- Layer: frontend. Priority: P0. Effort: M.

**VIS4. The Vallo stop on hero titles**
- What: The final full stop of hero titles drawn in brand blue ("Explore stays.").
- Why: A cheap, strong identity device (R6); blue, because the orange list is closed.
- Where: `components/app/PageHeader.tsx` (large titles), Home and Stays heroes.
- How: A `heroStop` prop; hero screens only, never every title.
- Layer: frontend. Priority: P2. Effort: S.

**VIS5. Glass only on floating things**
- What: Blur on the dock, sheets, banners and controls over photos; solid everywhere else and on the light device profile.
- Why: The brief asks for selective glass and performance on budget Android.
- Where: `packages/design-tokens/src/tokens.css` (glass tokens), `components/app/ShellDock.tsx`, `components/ui/Sheet.tsx`.
- How: One glass token set with a solid fallback under `data-lite-device` and `prefers-reduced-transparency`.
- Layer: frontend. Priority: P1. Effort: S.

**VIS6. Designed empty states**
- What: One thin glyph or a 3D object, one sentence, one action, on every list (Saved, Plans, Messages, Notifications, Listings).
- Why: Empty states are first impressions for new members.
- Where: `components/app/Screen.tsx` (`EmptyState`), `components/app/EmptyActions.tsx`, `components/ui/Icon3D.tsx`.
- How: An inventory test that every list page passes an empty state.
- Layer: frontend. Priority: P1. Effort: M.

**VIS7. One motion vocabulary**
- What: Sheets spring up, steps slide sideways, banners fade and lift, lists stagger slightly on first paint only; 180 to 260ms for most things.
- Why: Motion that feels the same everywhere reads as one product.
- Where: `lib/motion/ease.ts` (duplicate curves), `app/css/motion-pref.css`, `components/motion/RouteTransition.tsx`.
- How: JavaScript reads the CSS tokens; Calm and Off settings respected.
- Layer: frontend. Priority: P1. Effort: M.

**VIS8. Money typography**
- What: Tabular figures for prices and balances, consistent naira sign spacing, smaller kobo.
- Why: Prices that jitter or misalign look untrustworthy.
- Where: `components/ui/Amount.tsx`, `components/ui/Money.tsx`, `components/ui/Odometer.tsx`.
- How: One `nf-figure` class.
- Layer: frontend. Priority: P2. Effort: S.

**VIS9. Feed cards in the same family**
- What: Feed posts, stories and people cards share the listing card's radius, spacing and type, so the feed carries Vallo's identity (P2.1b).
- Why: The feed is where Vallo can feel like a world, not a catalogue.
- Where: `components/social/feed/PostCard.tsx`, `app/social-feed.css`, `app/(app)/around`.
- How: Same tokens; the signature feature (ACC1) appears inside the feed.
- Layer: frontend. Priority: P2. Effort: M.

## 19. Accessibility

**A11Y1. Follow the phone's text size**
- What: A "Follow my phone" default for text size that tracks iOS Dynamic Type and Android font scale, beside the existing S, M, L.
- Why: Many members set large text; the in-app setting ignores the system today.
- Where: `app/(app)/settings/accessibility/AccessibilitySettings.tsx`, `components/app/account/settings-store.ts`.
- How: On iOS WKWebView the `-apple-system-body` font reflects Dynamic Type; map it onto the root size; test layouts at the largest size.
- Layer: frontend. Priority: P1. Effort: M.

**A11Y2. Labels on every icon-only control**
- What: Every icon button, glyph link and dock tab has a spoken label.
- Why: Icon-only chrome is increasing with the thin-icon pass.
- Where: `components/ui/Button.tsx` (`iconOnly`), the 48 files with inline SVG, `components/app/MobileTabBar.tsx`.
- How: Type-level: `iconOnly` requires `aria-label`.
- Layer: frontend. Priority: P0. Effort: S.

**A11Y3. Focus and announcements**
- What: Sheets trap and return focus; FeedbackBanner announces politely (errors assertively); steps announce "Step 3 of 7".
- Why: Screen reader users need to hear what changed.
- Where: `components/ui/Sheet.tsx`, FeedbackBanner, StepFrame.
- How: `aria-live` regions in the shared components only.
- Layer: frontend. Priority: P0. Effort: S.

**A11Y4. 44px targets everywhere**
- What: Extend the target test to chips, the lists strip in Saved, reaction rows and calendar cells.
- Why: Small targets fail on budget phones and for older members.
- Where: `components/app/touch-targets.test.ts`, `components/touch-targets-w12.dom.test.tsx`.
- How: The new components join the test list as they land.
- Layer: frontend. Priority: P1. Effort: S.

**A11Y5. Contrast over photos and in grey lines**
- What: Tags and buttons over photos get a scrim; grey meta lines meet 4.5:1 in both themes.
- Why: Glass over bright photos often fails contrast.
- Where: `components/app/listing/PhotoFrame.tsx`, `components/ui/Tag.tsx`, `packages/design-tokens/src/tokens.css`.
- How: Contrast checks in `ResultScreen.contrast.dom.test.tsx` style for the new tokens.
- Layer: frontend. Priority: P1. Effort: S.

**A11Y6. Reduced motion everywhere new**
- What: FeedbackBanner, Sheet, swipe back, card to detail and success moments honour both the system setting and the in-app Motion setting.
- Why: The brief asks for it; new motion is where it gets forgotten.
- Where: `app/css/motion-pref.css`, `lib/ui/calm.ts`.
- How: One `useMotion()` read in each shared component.
- Layer: frontend. Priority: P0. Effort: S.

## 20. Security and reliability

**SEC1. Expired session handled in place**
- What: When a call returns signed-out, a sign-in sheet opens over the current screen, drafts are kept, and the member returns to the same place.
- Why: No session-expiry listener exists in the client today; members lose work and land on the front door.
- Where: `lib/supabase`, `components/auth/AuthGate.tsx`, `apps/web/src/proxy.ts`, OFF5.
- How: Listen for the auth state change and for 401 results from server actions; never drop an outbox item.
- Layer: frontend. Priority: P0. Effort: M.

**SEC2. Face ID at the right moments (decided)**
- What: Withdraw, send, pay a bill, add a bank account, view ID documents, reveal full personal details, change passcode, delete the account.
- Why: Security where money and identity are, never at the front door.
- Where: `lib/passcode/passkey-unlock.ts`, `app/(app)/settings/MoneyLockGroup.tsx`, `components/passcode/PasskeyUnlockKey.tsx`.
- How: One `requireRecentApproval(kind)` call (`lib/ui/recent-approval.ts`) before each action.
- Layer: frontend. Priority: P0. Effort: M.

**SEC3. Report from the thing, routed (decided)**
- What: Report on a listing, a person, a message, a photo and a receipt, routed by kind to the right desk (safety, supply, money, support) with an acknowledgement and a trace number.
- Why: Every report lands in one moderation queue today.
- Where: `lib/reports`, `components/app/ReportSheet.tsx`, `app/admin/queue`, `staff_grants` scopes.
- How: A `desk` column on `reports` set from the kind; one ReportSheet.
- Layer: frontend, backend. Priority: P0. Effort: M.

**SEC4. No duplicates on replay**
- What: Every queued message, reservation and booking request carries a client key the server refuses twice.
- Why: The brief forbids duplicate bookings, messages and payments.
- Where: `lib/offline/replay-guard.ts`, `lib/bookings/checkout.ts` (already idempotent), `lib/messages/actions.ts`, `lib/reservations/actions.ts`.
- How: Extend the checkout pattern to the other writes.
- Layer: backend. Priority: P0. Effort: M.

**SEC5. Recover from a WebView crash**
- What: If the WebView content process dies (memory pressure), reload the same screen and log it.
- Why: On low-memory phones this shows as a white screen today.
- Where: the iOS and Android native shells, `app/api/client-error/route.ts`, `public.risk_alerts`.
- How: iOS `webViewWebContentProcessDidTerminate` and Android `onRenderProcessGone`: a native build queue item.
- Layer: native build. Priority: P1. Effort: S.

**SEC6. Private app switcher snapshot**
- What: Blur money, ID and passcode screens in the app switcher.
- Why: Balances and ID photos should not show in the multitasking view.
- Where: `app/(app)/wallet`, `app/(app)/verification`, native shells.
- How: A native overlay on resign-active (native build queue); a web blur on `visibilitychange` until then.
- Layer: frontend, native build. Priority: P2. Effort: S.

**SEC7. Error screens that lead to help**
- What: The error screen's reference (`C-XXXXXX`) gets "Copy reference" and "Tell support", opening the support chat with the reference attached.
- Why: A crash becomes a conversation instead of a dead end.
- Where: `app/error.tsx`, `app/global-error.tsx`, `lib/observability/reference.ts`, `app/(app)/support`.
- How: The reference already maps to `risk_alerts.entity_id`.
- Layer: frontend. Priority: P1. Effort: S.

---

## Needs the founder

Only items that cost money, need a new native build, or change product strategy.

1. **Dock order and labels (N1):** strategy and a ruling 17 change. Recommend Home, Search, Messages, Feed, Profile with labels under every tab; approve from a side-by-side screenshot.
2. **Map tiles (PD5, PUB7):** CARTO's non-commercial terms are a launch risk. Recommend a free vector style with no key and commercial use allowed (check its terms first), and MapTiler only if you approve its price.
3. **One planned native build 1.0.2:** Android predictive back, `adjustResize`, new App Link paths (N8, AND1, AND2, AND4), WebView crash recovery and app switcher privacy (SEC5, SEC6). Recommend one build when Actions minutes are back, collected in `docs/handoff/NATIVE_BUILD_QUEUE.md`.
4. **Rich push images on iOS (FB6):** needs a Notification Service Extension in that same build. Recommend including it in 1.0.2.
5. **Wallet passes (BK8):** an Apple pass certificate and signing service. Recommend parking it until after launch.
6. **Voice note storage (MSG2):** small but real Supabase storage cost. Recommend a 2-minute cap and keeping audio for 12 months.
7. **AI description writer (PUB6):** each use costs AI tokens. Recommend a daily cap per lister.
8. **Crash reporting vendor (PERF1, SEC5):** the code reads `SENTRY_DSN` but a vendor is a new service. Recommend keeping `risk_alerts` only until you decide.
9. **Signature feature (ACC1):** product strategy. Recommend "Vallo Circle" (alternatives: Yardmates, Vallo Kin, Co-let, Nest by Vallo), built after launch.
10. **Community Promise gate (ONB4):** a new step before the first message or deal. Recommend yes, once, in Vallo's words.
11. **Privacy choices sheet (ACC6):** a legal position under the NDPA. Recommend yes, with equal-weight buttons.
12. **Mascot or animated brand mark (FB8):** a mascot needs an illustrator. Recommend the animated Vallo mark now and a mascot later only if you want one.
