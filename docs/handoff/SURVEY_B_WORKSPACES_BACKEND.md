# SURVEY B: WORKSPACES (AGENT, HOST, ADMIN) AND BACKEND

Written 7 November 2026 by Survey Agent B, read-only, on `platform-grade-1-readiness`.
Sources: the code under `apps/web/src` (paths below are relative to it unless
they start with `docs/`, `supabase/` or `apps/`), `supabase/migrations`, and
read-only SELECTs plus the security and performance advisors on the live
project `uccixoonmbhrnyczyigt` (30 profiles). Counts only; no personal data,
tokens or secrets were read into this file.

---

## Summary

1. None of the four Grade 1 shared pieces reaches a workspace yet: `PageFrame`, `StepFrame` and `OptionCards` are used only by `components/verification/KycFlow.tsx` and the dev preview; the `banner.*` store has 0 callers in `app/agent`, `app/host`, `app/admin`, `components/agent`, `components/host`. Every workspace success and failure is an inline sentence or nothing.
2. Headers: agent pages draw their own `<h1>` in four class variants under a `WorkspaceHeader` that already prints the title; admin has four header patterns (`PageHead` 21 pages, raw `<h1>` 9, two different `DeskHead` components).
3. The listing wizard (`app/agent/list/ListingWizard.tsx`, 4,733 lines, 198 KB) is 8 screens holding about 60 questions; it maps cleanly onto a computed 15 to 17 screen StepFrame flow, and `components/host/HostWizard.tsx` with `lib/host/onboarding.ts` is already the right template for the split.
4. Missing versus the references: no Getting started card, no setup tasks in Needs attention, no Activity inbox, no cross-listing month calendar, no What do you manage sheet, no listing status filter or counted segments.
5. Admin: the staff grant by account exists and is solid (`lib/admin/staff-actions.ts`, positions, handbook, keys). Missing: a business developer desk and a social media manager desk. Reports reach one moderation tab; guest door-charge reports land only in Alerts.
6. Backend: 189 server-action files, 158 on `ActionResult`; 31 are not (the admin queue's claim and release return `void`). 36 local copies of a "service down" sentence. In-app rate limits in 38 files, database insert limits on 7 tables; bookings, inspection requests, viewings and briefs have neither.
7. Database: 323 public tables, all with RLS on, no `true` write policy. Advisors: 0 ERROR, 794 WARN findings (4 lints), 478 INFO findings (4 lints). The biggest real cost is 393 multiple-permissive-policy warnings, 20 each on `listings`, `accommodations`, `businesses`.
8. Migration drift: 3 migrations applied live on 31 October are not in the repo, and `newsletter_enqueue` has a different version live and locally (live 756, repo 753).
9. Reliability: all 41 pg_cron jobs and the 21 Vercel crons ran clean for 7 days; Paystack reconciliation runs twice an hour from two schedulers (1,440 audit rows in 30 days, 97% of the audit log); 18 "Store: readiness, red" alerts are open and repeating; 9 client errors in 2 days, 7 of them the realtime "after subscribe" crash, 2 after the fix commit.
10. Push: 1 active device token across 30 profiles, 7 queue rows in 30 days (3 delivered, 4 suppressed, 0 failed), drain healthy since 1 November.

**How to read a finding.** `ID` . path . problem . fix . **priority** (P0 launch-blocking, P1, P2) . **size** (S under a day, M a few days, L a week or more) . **layer** (UI, Flow, Server, DB, Ops).

---

## Workspaces: page by page

### 0. Cross-cutting (applies to all 95 workspace pages)

| Signal | agent (26 pages) | host (17) | admin (52) |
|---|---|---|---|
| `PageFrame` / `PageHeader` | 0 / 0 | 0 / 4 (calendar, DecideView, StatementView, HostReviewsView) | 0 / 0 (own `PageHead`) |
| Raw page `<h1>` | 24 files, classes `nf-h1`, `nf-h2`, `nf-h2 mt-5`, `nf-agent-head__title` | 9 files | 9 files |
| `banner.*` or `toast.*` callers | 0 | 0 | 0 |
| Inline `setMessage` / `setNotice` feedback | 4 page files + wizard | 2 + 13 in `components/host` | 18 files |
| `loading.tsx` | 26 | 16 | 34 |
| `error.tsx` | 1 (root) | 1 (root) | 2 |
| Hand-rolled `role="dialog"` | 0 | 0 | 3 (`_components/AdminNav.tsx`, `_components/ConsolePalette.tsx`, `support/SupportKeys.tsx`) |
| Inline `<svg>` | 2 (charts) | 1 (`dashboard/RestaurantSummary.tsx`) | 5 (`money/_desk/charts.tsx`, `referrals/ReferralGraph.tsx`, `_components/panels.tsx`, `_components/AdminGlyph.tsx`, `_review/parts.tsx`) |
| Raw `text-[Npx]`, `weight="bold"` | 0, 0 | 0, 0 | 0, 0 |

Good news first: no raw pixel type sizes, no bold icon weights, skeletons on almost every route, and real (never invented) data everywhere. The gaps are structural.

- **X-01** `app/agent/**`, `app/host/**`, `app/admin/**`: no workspace page uses `PageFrame`; titles are hand-drawn `<h1>` in four sizes, and on agent and host pages the `WorkspaceHeader` bar already prints the same title, so the title appears twice on phones. Fix: move every workspace page onto `PageFrame` (title folds into the bar on scroll, one subtitle, one actions slot, optional tab row) and delete the per-page `<h1>`s. **P1 . M . UI**
- **X-02** all workspace client components: zero `banner.*` calls; saves, sends, approvals and deletes report through inline `role="status"` lines (26 files in `app/agent`, 65 in `app/admin`) or not at all. Fix: every action result goes through `banner.success` / `banner.error({ retry })`; keep inline text only for field errors. Start with listing delete and undo (`app/agent/listings/ListingsWorkspace.tsx`), staff grant (`app/admin/staff/StaffForms.tsx`), support reply (`app/admin/support/SupportDesk.tsx`), host room and rate saves (`components/host/RoomNightsEditor.tsx`, `components/host/calendar/RatePlanSheet.tsx`). **P0 . M . UI** (UX_SYSTEM 8.1: "Every success and failure goes through the banner")
- **X-03** `app/agent/*/page.tsx`: the same three-way preamble (signed-out or not-agent pitch, unconfigured note, agent) is copied into 10 to 20 pages (`ListingPitch` in 20, `"unconfigured"` branch in 15), and the unconfigured state is hand-drawn each time (`IconPlate` + `h1.nf-h2.mt-5` + paragraph, for example `app/agent/bookings/page.tsx:55`). Fix: one `AgentPage` server wrapper (`components/agent/AgentPage.tsx`) that resolves context, draws the pitch or `EmptyState`, and hands the agent to its child. **P1 . M . UI/Server**
- **X-04** `components/agent/AgentShell.tsx`, `components/host/HostShell.tsx`: two shells with the same bar, dock, safe-area and immersive logic; both carry dead props (`locale` "still passed by every page", `logoLabel` `@deprecated`). Fix: one `WorkspaceShell` with a `nav` slot; agent and host pass their rail/drawer models. **P2 . M . UI**
- **X-05** Drawers and switches: the agent and host share `components/workspace/WorkspaceDrawer.tsx` (good), but the member shell draws its own drawer inside `components/app/AppShell.tsx`, and role switching has three mechanisms: `components/supply/ProfileSwitcher.tsx` (452 lines, member dock), `components/agent/ModeSwitcher.tsx` (agent rail and drawer only), `components/roles/RoleSwitcher.tsx` (signed-out profile). Fix: one switch model (`lib/supply/workspaces.ts` already lists the workspaces) rendered as the R63 "Exit agent tools" row in all three drawers and as the `ProfileSwitcher` sheet; retire `ModeSwitcher` and keep `RoleSwitcher` only for the signed-out explainer. **P1 . M . UI** (coordinate with Survey A, who owns the member shell)
- **X-06** `public/sw.js` never keeps `/agent` or `/host` pages, and `components/app/OfflineTray.tsx` is mounted only in the member layout. The founder's "switch on low or no data" fails for the agent side. Fix: keep the agent and host shells and their read-only pages (dashboard, listings, calendar) with the "Saved on your device" stamp; never keep money or messages. **P1 . M . UI/Ops**
- **X-07** Hard-coded English in translated workspaces: 29 literal `label=`/`title=` strings in `ListingWizard.tsx` ("Estate or compound name", "Agency fee", "Caution deposit", "Year built", "Security desk number"...), "Inspections" in `components/agent/agent-nav-model.ts:53` (with the same `calendar-booking` icon as Bookings), "Select" / "Done selecting" in `ListingsWorkspace.tsx:880`. The wizard's own header comment says "Every string comes from the dictionary". Fix: move them into `packages/i18n/src/locales/en.ts` slices; give Inspections its own icon (`calendar-clock`). **P1 . S . UI**

### 1. Agent dashboard and listings

Pages: `app/agent/dashboard/page.tsx` (+ `RealDashboard.tsx` 370 lines, `dashboard-data.ts`), `app/agent/listings/page.tsx` (+ `ListingsWorkspace.tsx` 1,000 lines, `BulkBar`, `CloseListingSheet`, `DuplicateListing`, `OwnerAskStrip`), `app/agent/listings/[listingId]/{status,health,board,promotion,calendar,arrival,mandate}`, `app/agent/portfolio`, `app/agent/analytics/**`, `app/agent/promotion`, `app/agent/firm`, `app/agent/reviews`.

What is there: a navy `HeroBand` with the date, "Today", one primary (Add listing), a `TodayHero` count of what needs you, a four-stage pipeline gauge, upcoming stays, `KycBanner`, `PasscodeOffer`, `StillAvailableCard`; listings grouped by status with counts, search by title, bulk select, undoable draft delete, per-listing completeness meter.

- **A-01** `app/agent/dashboard/RealDashboard.tsx`: no "Getting started" card (R44). An agent with no phone, no identity check, no payout account and no listing sees a `KycBanner`, a `PasscodeOffer` and an empty pipeline as three separate shapes. Fix: a `GettingStarted` card, "N of 4 complete", progress bar, struck-through done rows, fed by `getKycStanding`, `confirmed_phones`, `getPayoutAccounts`, `numbers.totalListings`; it replaces `KycBanner` on the dashboard and disappears at 4 of 4. **P1 . M . UI/Server**
- **A-02** same file, lines 255 to 266: "Needs attention" lists only inspections waiting on the lister. Fix: R47 task cards counted in the heading ("Needs attention (3)") with Do it / Dismiss / Snooze, covering verify identity, set up payout, confirm phone, a listing with "More info required", a mandate expiring, a still-available question; dismissals stored per account. **P1 . M . UI/Server**
- **A-03** `app/agent/dashboard/RealDashboard.tsx:111`: quick actions are four tiles (Add listing, Bookings, Listings, Earnings); R44 has chips for the three most-used jobs (Add listing, Applications, Find leads). Fix: chips row, with Applications pointing at the new Activity inbox (A-12) and Find leads at `app/agent/messages` briefs. **P2 . S . UI**
- **A-04** No "What do you manage?" sheet (R11/R12) on first entry; `gateFirstRun("agent", ...)` exists but there is no dashboard focus preference anywhere in `lib` (grep for `dashboard_focus` finds nothing). Fix: a `Sheet` with `OptionCards` (Rentals, Sales, Stays, Restaurants, Everything), written to `profiles.settings.agentFocus`, read by the dashboard to order sections and by `ListingsWorkspace` as the default segment; "Customise" link on the dashboard reopens it. **P1 . M . UI/Server**
- **A-05** `app/agent/listings/ListingsWorkspace.tsx`: no counted segmented filter by kind (All, Rentals, Sales, Stays) and no status filter sheet (R42/R43); status is only the grouping order. Fix: `SegmentedControl` with counts from `readAgentNumbers.byStatus`, a filter-by-status `Sheet` (All, Live, In review, Changes required, Draft, Closed) with a tick, state in `?status=` and `?kind=`. **P1 . S . UI**
- **A-06** same file: the empty state for a new agent is the pipeline `State` "no listings"; R17 wants a centred thin glyph, "No listings here yet", and a link to the How to list help article plus the FAB. Fix: `EmptyState` with the help link and a "Continue draft" row when `readOpenDraft` finds one (R28). **P2 . S . UI**
- **A-07** same file: delete and undo report through a per-row `errors` map, and a successful delete shows nothing after the undo window closes. Fix: `banner.info("Draft deleted", { action: Undo })` during the window, `banner.error({ retry })` on failure. **P1 . S . UI**
- **A-08** `app/agent/listings/[listingId]/*`: seven per-listing pages (status, health, board, promotion, calendar, arrival, mandate) reached from a row's actions, each with its own heading style; nothing ties them into one listing home. Fix: a listing detail page with a tab row in `PageFrame` (Overview, Calendar, Charges at the door, Mandate, Promotion, Health) so the agent always knows where they are. **P2 . M . UI**
- **A-09** `app/agent/analytics/**` (3 pages) and `app/agent/portfolio`: charts draw inline SVG (`components/agent/charts/Sparkline.tsx`, `AreaTimeChart.tsx`) with their own colours. Fix: run them through the `dataviz` palette tokens in `packages/design-tokens`; keep the honest "no previous period" rule. **P2 . S . UI**
- **A-10** `components/agent/AgentToolsCards.tsx`, `components/agent/ListingMeter.tsx`, `StillAvailableCard.tsx`: three different card shapes on one dashboard. Fix: all on the raised-card surface (`--nf-surface-secondary`, 1px border, 18px radius) per UX_SYSTEM 2 and 3. **P2 . S . UI**

### 2. Listing wizard (`app/agent/list/ListingWizard.tsx`)

**Today.** 8 screens (`STEP_KEYS`: basics, photos, location, amenities, utilities, pricing, guestView, submit), a hand-built `StepHead`, `Stepper`, `Choice`, `Field`, `Note` and a segmented progress with jump-back, server draft on each step change plus a device copy (`localStorage`), photo rules (3 minimum, 1600px long edge, EXIF stripped by re-encode, `MAX_PHOTOS`, `MAX_VIDEOS`, `MAX_VIDEO_SECONDS`), 40-word description, `BroadcastPaste` (V-09, with `listing_broadcast_marks` so unconfirmed figures block submit), `ListerFeeGate` (D60, blocking behind `LISTER_FEE_GATE_BLOCKING_FLAG`), `VerifyGateLink` (P0.3), `PhoneGateLink`, `TenantPays` move-in total, `PriceGuide`, `ShotList`, `DraftMatches`. Screen 0 alone asks title, property type, description, unit shape, bedrooms, bathrooms, toilets, parking, size, furnishing, floor, floors and condition. Charges at the door (`app/agent/listings/[listingId]/arrival`) and the owner's mandate (`.../mandate`) live outside the wizard and are enforced only at admin publish (`lib/admin/actions.ts:751` `heldReasons`).

**Proposed flow (computed count, R29 pattern 11: 7 before the kind is known, then 15 to 17).** Each row is one `StepFrame` with an eyebrow.

| # | Eyebrow / question | Answers (from today's screen) | Reference | Shown when |
|---|---|---|---|---|
| 1 | THE BASICS: What are you listing today? | intent: rent, sale, nightly stay (`LISTING_INTENT_CHOICES`) as `OptionCards`; "Start from your WhatsApp message" (`BroadcastPaste`) as a pale secondary on this screen | R18.1, R29 | always |
| 2 | Your connection to this property | landlord, agent, firm, developer. Today derived silently from the agent row's `type`/`role` into `listings.listing_role`; show it as a confirm card with Change, because it decides the mandate step | R18.2, R30 | always |
| 3 | Residential or commercial? | category | R18.3, R31 | rent, sale |
| 4 | Which best describes it? | property type as a 3-column tile grid (today a `Choice` list on screen 0) | R18.4 | always |
| 5 | LOCATION: Where is it? | state, city, area, address, landmark (screen 2) + grey "Who sees the exact location" card | R18.5 | always |
| 6 | Is the pin on the entrance? | full-screen pin picker (new) | R18.6 | always |
| 7 | DETAILS: How many rooms? | bedrooms, bathrooms, toilets, parking as number chips, size optional (screen 0) | R18.7, R32 | always |
| 8 | What is the place like? | unit shape (`UnitQuestions`), furnishing, floor, floors, condition, year built (screens 0 and 5) | | rent, sale |
| 9 | LIGHT AND WATER | power grid, backup, backup hours, water, prepaid meter (screen 4) | | rent, sale, stay |
| 10 | THE COMPOUND | estate name, gate directions, security desk number, access code, `CompoundQuestions`, `ServiceQuestions`, `FloodQuestion` (flagged) (screen 4) | | rent, sale |
| 11 | What else is there? | amenities chips (screen 3) | | always |
| 12 | PRICING: What is the rent / price / nightly rate? | one large naira field with period, `PriceGuide` under it (screen 5) | R18.8 | always |
| 13 | MOVE-IN CHARGES (rent) / WHAT A BUYER PAYS (sale) / CHARGES AT THE DOOR (stay) | caution, agreement, agency, legal, service charge, stamp duty, total move-in as charge cards with live arithmetic; `TenantPays` is the headline; for a stay, the five door charges move in from `.../arrival` (V-57) | R18.9, R33 | always |
| 14 | PHOTOS: Add photos of the place | photos and videos, readiness banner "Add 2 more", cover crowned, reorder, `ShotList` (screen 1) | R18.10, R34 | always |
| 15 | FINISH: Describe it | title with counter (`MIN_TITLE_LENGTH`/`MAX_TITLE_LENGTH`), description with word counter, "Write with AI" behind the consent sheet (`lib/ai/consent.ts`) with Undo | R18.11, R35 | always |
| 16 | THE OWNER'S MANDATE | upload the mandate or invite the principal (today `.../mandate`, SCUML item 17) | | agent, firm |
| 17 | Check and submit | every answer with a grey "Change", "things to fix" from the submit gate (`stepOfGateField` already maps a gate field to its step), the fee acceptance (`ListerFeeGate`), the verification and phone gates named here, the guest view as a sheet ("See it as a renter"), `DraftMatches` demand line; primary "Submit for review" | R18.12, R28, R39 | always |

**Must keep, unchanged in behaviour.** (a) The supply door: only an approved agent row opens the wizard (`getAgentContext`, `SUPPLY_DOOR_HREF` `/profile/setup`), everyone else sees `ListingPitch`. (b) SCUML: item 17 mandate gate (`isMandateRefusal`) and item 15 EDD gate (`isEddGateRefusal`) stay in the database; the wizard only surfaces them earlier. (c) Charges at the door: V-57 `arrivalChargesDeclared` stays the publish gate. (d) Photo rules: 3 minimum, 1600px, metadata strip with the `<img>` fallback for old Android and HEIC, refusal rather than upload on re-encode failure, the server count at submit, storage path `<uid>/<listing id>/<uuid>`. (e) The fee gate: D51 rate agreement in the database, D60 blocking flag read fail closed. (f) Broadcast paste: V-09 marks per draft, an unread set never written back (`initialUnconfirmed` null). (g) `readOpenDraft` resume and `?new=1`, the "sent" chain for a listing in review (`sentFrom`), `untouchedUnread` so a group that failed to read is never overwritten with nulls. (h) The five DOM suites `ListingWizard.{fee-gate,media,publish,review,steps}.dom.test.tsx` stay green.

- **LW-01** `app/agent/list/ListingWizard.tsx`: one 4,733-line client component owning state, uploads, autosave, every step and every gate. Fix: split like the host wizard: steps as data in `lib/listings/wizard-steps.ts` (`stepsFor(intent, role)`, the model `lib/host/onboarding.ts` already uses), one file per step in `app/agent/list/steps/`, a `useListingDraft` hook (server draft + device copy + save state), the media pipeline in `lib/listings/photo-prep.ts`, and the frame from `components/ui/StepFrame.tsx`. **P1 . L . Flow**
- **LW-02** same file: several questions per screen (13 on screen 0). Fix: the table above. **P1 . L . Flow**
- **LW-03** same file: the save state is a `notice` line; no "Saved" tick in a top bar and no "Saved on this phone" before an account draft (R30, pattern 12). Fix: `StepFrame`'s save slot, "Saved" only after the server answered. **P1 . S . UI**
- **LW-04** `app/agent/listings/[listingId]/arrival/page.tsx` and `.../mandate/page.tsx`: two publish gates live outside the flow, so a lister learns about them only from an admin refusal email ("Approved, but it is not published yet", `lib/admin/actions.ts:765`). Fix: steps 13 and 16 above; the pages stay as edit screens after submit. **P1 . M . Flow**
- **LW-05** `app/agent/list/page.tsx:34`: the comment says "the seven step wizard"; there are eight. And lines 182 to 185 await two flags inside JSX after a serial `readBroadcastMarks`, three round trips after the `Promise.all`. Fix: fold `readBroadcastMarks`, both `flagIsOn` reads into the first `Promise.all` (the marks read can key off `id` or the resumed draft in a second small wave only when `id` is absent). **P2 . S . Server**
- **LW-06** same flow: no property-type tile grid, no full-screen pin picker, no AI writer with consent and undo (P1.1). Fix: tile grid on `OptionCards`' sibling, pin picker on the map work (P1.6), AI writer on `lib/ai/consent.ts`. **P1 . M . UI**

### 3. Agent calendar, inspections, bookings, activity

Pages: `app/agent/inspections/page.tsx` (`components/agent/visit-calendar/VisitCalendar.tsx`: week strip or month grid of viewings only), `app/agent/bookings/page.tsx` (`BookingsWorkspace.tsx`, `ReservationsBoard.tsx`), `app/agent/listings/[listingId]/calendar/page.tsx` (per-listing availability, the only writer of `unavailable`), `app/agent/messages/**` (inbox with stages, follow-ups, briefs), `app/agent/notifications/page.tsx` (re-exports the member page in the agent shell, good).

- **A-11** No agent-wide calendar (R13): viewings live in `VisitCalendar` on Inspections, blocks per listing, check-ins and check-outs on Bookings. Fix: `/agent/calendar` reusing `lib/visit-calendar/model.ts` `monthGrid` with rounded day cells, today tinted, a legend with counts (Check-in, Check-out, Viewing, Blocked, Rent due), a listing filter button, and a day sheet with that day's events and quick block or unblock (writes through `lib/agent/calendar-actions.ts`). Put it in the agent nav model. **P1 . M . UI/Server**
- **A-12** No Activity inbox (R14): bookings, applications and viewings are three destinations with no counts. Fix: `/agent/activity` with a segmented control (Bookings, Applications, Viewings), an underline tab row with real counts (All, Pending, Upcoming, Ongoing, Completed), one search field "Search by listing or booking ref", and an empty state with "Share your listing". Reads already exist (`readHostBookings`, `readInspectionsForLister`, `lib/agent/application-respond.ts`). **P1 . M . UI/Server**
- **A-13** Agent nav (`components/agent/agent-nav-model.ts`): 13 rows; the reference tab set is Dashboard, Listings, Activity, Calendar, Account. Fix: once A-11 and A-12 exist, group Inspections and Bookings under Activity and add Calendar; keep the rest under Account (R63 sections). **P2 . S . UI**
- **A-14** `app/agent/bookings/page.tsx`: hand-drawn unconfigured state and title (see X-03); the two boards read in parallel and `catch` to empty, so a failed read is drawn as "no bookings". Fix: return `{ readFailed }` and draw the UX_SYSTEM 11 error state with a retry. **P1 . S . UI/Server**
- **A-15** `app/agent/messages/page.tsx` imports `getAgentInbox` (`lib/agent/messages-queries.ts`) while the member inbox uses `lib/messages/live.ts` `loadConversationSummaries`: two inbox readers over the same conversations (see B-12). **P2 . M . Server**

### 4. Agent money and verification

Pages: `app/agent/earnings/page.tsx` (+ `EarningsWorkspace`, `PayoutAccounts`, `EarningsHistory`, `PayoutList`, chargeback hold), `app/agent/settings/page.tsx` (+ `AgentSettingsBody`), `app/agent/verification/page.tsx` (the four-rung tier ladder, read-only, honest).

- **A-16** `components/agent/PayoutAccounts.tsx`: a native `<select>` of banks with a `SuccessSheet`; the member side has `components/app/payments/AddBankAccountSheet.tsx`, and `components/host/HostWizard.tsx` calls `addBankAccount` / `listBanks` / `resolveBankAccount` with a third UI. Fix: one `ChooseBankSheet` (R47: search, bank logos in round tiles) and one add-account flow used by all three. **P1 . M . UI**
- **A-17** `app/agent/verification/page.tsx` versus `app/(app)/verification` (`KycFlow`): two pages both called verification, one the agent tier ladder, the other identity. Fix: rename the agent page "Your badge" or "Verification tier", link its identity rung straight to `/verification`, and say on both which one this is. **P1 . S . UI**
- **A-18** `app/agent/earnings/page.tsx`: earnings, payouts, payout accounts, history and a PEP question on one long page. Fix: `PageFrame` with tabs (Overview, Payouts, Accounts, History); R47's "Workspace finances" cards (Next payout, Pending) on the dashboard. **P2 . M . UI**

### 5. Host workspace

Pages: `app/host/page.tsx` (`HostTodayView`, `HostStandingBody`, `DeskFigure`), `apply` (`components/host/HostWizard.tsx` 1,571 lines, steps as data, `components/host/stays/*Step.tsx`), `start`, `bookings`, `reservations`, `decide` (`DecideView`), `calendar` (`RateCalendar`, `RatePlanSheet`, `CalendarSync`, `TapeChart`), `rooms` (`RoomNightsEditor`), `photos` (three photo managers), `earnings` + `earnings/statement`, `reviews`, `arrival`, `transfer`, `settings`, `notifications`, `assistant`.

- **H-01** `components/host/HostWizard.tsx`: the better-planned wizard (honest computed count, steps in `lib/host/onboarding.ts`, step components in `stays/`), but its frame, progress and save line are its own, not `StepFrame`. Fix: wrap each drawn step in `StepFrame`; it becomes the template LW-01 copies. **P1 . M . Flow**
- **H-02** `components/host/PhotoManager.tsx`, `AccommodationPhotoManager.tsx`, `BusinessPhotoManager.tsx` plus the listing wizard's own photo grid: four photo managers. Fix: one `PhotoGrid` (cover crowned, menu dot, dashed add tile, readiness banner R34) with per-bucket adapters. **P2 . M . UI**
- **H-03** Host headers: 4 views use `PageHeader`, 9 pages a raw `<h1>`, the rest none, under a `WorkspaceHeader` that also titles the page, plus a chip row (`HostNav`), a drawer and a sidebar (`HostDeskSidebar`). Fix: X-01 plus one navigation surface per breakpoint (chips on phone are a third nav on top of drawer and dock). **P1 . M . UI**
- **H-04** `components/host/*` feedback: 13 files set inline messages (`RoomNightsEditor`, `RatePlanSheet`, `CalendarSync`, `FacilitiesPicker`...). Fix: X-02. **P1 . S . UI**
- **H-05** `components/host/HostDocumentUploader.tsx`: one of four identity and business document upload surfaces (with `KycFlow`, `components/agent/ApplyWizard.tsx`, the owner, agent and firm register forms), writing to three buckets (`identity-checks`, `agent-documents`, `host-documents`) with different MIME lists (`identity-checks` refuses HEIC, the other two accept it). Fix: one `DocumentCapture` (R37 check your capture, zoom, retake) and one identity record; a business document (CAC) stays per workspace. **P1 . L . Flow/DB**
- **H-06** `app/host/start/page.tsx` (29 lines) and `app/host/apply`: two entries to becoming a host, plus "Add a workspace" in the member shell. Fix: one entry through the What do you manage sheet (A-04), which routes stays and restaurants to `HostWizard`. **P2 . S . Flow**
- **H-07** Host dashboard (`app/host/HostTodayView.tsx`): has "Needs attention" but no Getting started card (photos, rates, charges at the door, payout, verification). Fix: the same `GettingStarted` component as A-01 with a host task list. **P1 . S . UI**

### 6. Admin console by desk

Shell: `app/admin/layout.tsx` (`requireAdmin()`), `_components/AdminFrame.tsx`, `_components/nav.ts` (12 rows plus "All desks"), `ConsolePalette` (Control K), `ConsoleStepUp` (security key), `EntryGate`, `StaffFrame`. The console is deliberately English-only (R-107). Visual system: its own `PageHead`, `Panel`, `CalmNote`, `PanelEmpty`, `KpiStrip`, `Badge`, its own `IconPlate` (`_components/panels.tsx:102`, a duplicate of `components/ui/IconPlate`) and `AdminGlyph` (a third icon family next to `UiIcon` and `SettingsGlyph`).

| Desk (nav row) | Pages | Door | Notes |
|---|---|---|---|
| Overview, Queue, Lookup | `page.tsx`, `queue` (671 lines), `lookup` | admin; queue tabs by scope | Queue folds listings, applications, reports, tickets, flags, held; tab scopes in `queue/page.tsx:114` |
| Listings | `listings`, `listings/[id]` | listing_approval | review and publish, held reasons named |
| Supply | `supply`, `agents` (563 lines), `businesses`, `stops` | kyc_review / admin | |
| Identity | `kyc`, `kyc/guide`, `compliance`, `review-calls/**` | kyc_review, compliance | ID beside selfie |
| Money | `money`, `payments`, `chargebacks/**`, `fees`, `referrals`, `restaurant-fees` | finance | step-up for money |
| Agreements | `agreements`, `agreements/settings` | agreements | |
| Bookings | `bookings/**` | admin | |
| Around (social) | `social`, `standing`, `blocked-terms`, `weight-withheld` | moderation / admin | `social` moderates places and area moderators only |
| Support | `support`, `people/**`, `account-recovery` | support | replies, escalations, keys |
| Operations | `operations/**`, `alerts`, `audit`, `oversight`, `call-usage`, `retention` | operations | |
| Analytics | `analytics`, `front-door`, `field-speed` | admin | |
| Settings | `settings`, `switches`, `reference`, `examples`, `staff`, `handbook/**` | super admin for staff | |

- **AD-01** Admin headers: `PageHead` on 21 pages, raw `<h1>` on 9 (`reference`, `review-calls`, `social`, `bookings/[bookingId]`, `chargebacks/[chargebackId]`, `review-calls/[id]`, `payments`, `kyc/guide`, `listings/[id]`), two different `DeskHead` components (`money/_desk/Desk.tsx:22`, `_review/parts.tsx:26`). Fix: `PageHead` becomes a thin wrapper over `PageFrame` with the console's density; delete both `DeskHead`s. **P1 . S . UI**
- **AD-02** `app/admin/**` feedback: 18 files use inline `setMessage` (for example `staff/StaffForms.tsx:37` "Access given..."), and `lib/admin/queue-desk-actions.ts` (`takeRow`, `releaseRow`, `bulkAct`, `saveView`, `deleteView`) returns `Promise<void>`, so a failed claim or bulk act says nothing at all. Fix: return `ActionResult` and use the banner; a claim lost to a colleague reads "Taken by another reviewer". **P1 . S . Server/UI**
- **AD-03** Hand-rolled dialogs: `_components/AdminNav.tsx`, `_components/ConsolePalette.tsx`, `support/SupportKeys.tsx`. Fix: `components/ui/Sheet.tsx` (side sheet on wide) and the existing guard test that lets this list only shrink. **P2 . S . UI**
- **AD-04** Icon families: `AdminGlyph.tsx` and admin `IconPlate` beside `UiIcon` and `components/ui/IconPlate`. Fix: map `AdminGlyph` names onto `UiIcon` lean stroke, delete the duplicate plate. **P2 . S . UI**
- **AD-05** `app/admin/social/page.tsx`: titled "Around", moderates proposed places and area moderator applications only; no tooling to post as Vallo, schedule, or see post analytics. See Missing desks. **P1 . L . Flow**
- **AD-06** `app/admin/queue/page.tsx:114` `TAB_SCOPE`: reports, flags and held all open to `moderation`; tickets to `support`; nothing routes a report by kind. A scam or off-platform-payment report about a listing goes to the same tab as offensive wording in a review. See the routing table under Missing desks. **P1 . M . Server**
- **AD-07** `lib/stays/arrival-actions.ts` `report_door_charge` (a guest says the door charge differed) writes `door_charge_reports` and a `risk_alerts` row; no desk reads `door_charge_reports` (grep finds it only in `database.types.ts`), so the report surfaces only as an Alerts line. Fix: a "Door charges" lane in the queue for the `listing_approval` and `support` desks, with the booking, the declared charges and the asked amount side by side. **P1 . M . Server/UI**
- **AD-08** `app/admin/staff/page.tsx` + `lib/admin/staff-actions.ts` `grantStaff`: granting is by the email on the Vallo account, with positions (`lib/admin/staff-positions.ts`, 12 named positions with job descriptions mirrored in a migration), scopes, note, revoke with reason, handbook acknowledgement, security keys, `SupportTeam` one-step add and remove. This meets P2.5 "How staff are added" already. Gaps: no search by name or handle (email only), no "granted by / when" column visible on the roster for each scope change, inline feedback. Fix: add a people picker over `lib/admin/lookup-reads.ts`, show `granted_by` and `granted_at` (columns exist on `staff_grants`), banner feedback. **P2 . S . UI**
- **AD-09** `app/admin/agents/page.tsx` (563 lines) and `app/admin/queue/page.tsx` (671 lines): page files doing reads, shaping and rendering. Fix: move reads into `lib/admin/reads/*` (the folder exists) and keep pages under 250 lines. **P2 . M . Server**
- **AD-10** `app/admin/examples`, `app/admin/front-door`, `app/admin/field-speed`, `app/admin/call-usage`: low-traffic desks in the main nav groups. Fix: fold under Analytics and Settings children so the 12 rows are the working desks. **P2 . S . UI**

---

## Missing desks and flows

### What the grant model already gives us

`public.staff_grants` (live columns: `user_id, scopes, note, granted_by, granted_at, revoked_at, revoked_by, revoke_reason, position`; 3 grants live), `public.staff_scope` enum (live: `listing_approval, kyc_review, moderation, support, agreements, guarantee, finance, compliance, operations`), named positions in `private.staff_position_title` / `private.staff_position_scopes` mirrored by `lib/admin/staff-positions.ts`, `requireAdmin(scope)` in `lib/admin/guard.ts`, the handbook gate and console security key, and `public.audit_log` (staff actions already write `staff.*` rows: 23 in 30 days). Both new desks are therefore **positions plus desks**, not a new permission system.

### Desk 1: Support and business developer desk (`/admin/partners`)

- **Position.** `business_developer` added to `STAFF_POSITIONS` and its migration mirror, default scopes `["support", "listing_approval"]`. It never carries `finance`, `guarantee`, `agreements` or `compliance`, and `admin_grant_staff` already refuses grants from anyone but a super admin, so a business developer cannot touch money, payouts or other people's grants. Identity decisions stay with `kyc_review`: the desk can see where a person is stuck, never approve their ID.
- **What the desk shows.** (1) **My people**: members this staff member is onboarding, each with a progress strip read from real state (account, phone confirmed, identity submitted or approved, supply registration, first draft, first listing live, payout account). (2) **Add a person I met**: find by email, phone or handle (`lib/admin/lookup-reads.ts`), then "Start onboarding", which sends the member an in-app and email invitation with a deep link to the exact next step (`/verification`, `/profile/setup`, `/agent/list?id=`). Staff never fill forms on a member's behalf and never see an ID image unless they also hold `kyc_review`. (3) **Listings to review**: the `listings` queue tab filtered to "my people first", with the same review controls. (4) **Support**: the `tickets` tab, plus tickets whose `related_kind` points at one of my people. (5) **Reports routed to me**: reports with `category in ('unavailable','not_as_described','duplicate')` about listings (supply quality), see routing below.
- **Data.** One table `public.onboarding_cases (id, member_id, staff_id, source text check in ('met_in_person','online','referral'), stage text, opened_at, closed_at, note)` with RLS: staff with `support` read their own rows, super admin reads all. Stage is computed on read, never typed. Every open, nudge, close and review writes `audit_log` (`partner.case_opened`, `partner.nudge_sent`, `partner.listing_reviewed`).
- **Measures.** Cases opened, time to first live listing, drop-off step. Shown on `/admin/oversight` per staff member.

### Desk 2: Social media manager desk (`/admin/studio`)

- **Position.** `social_media_manager`, default scopes `["support"]` (so they can reply to support messages, as P2.5 asks). Publishing is gated on the position itself (`staff_grants.position = 'social_media_manager'` or super admin), checked in a new `private.may_publish_as_vallo()` used by the RPCs below, so no new scope value is required. If the founder prefers a scope, add `content` to `staff_scope` in the same migration; the desk code reads one helper either way.
- **What the desk shows.** (1) **Compose**: a feed post, a story, an in-app announcement banner, or a home banner, as Vallo. Posts already support `author_kind = 'SYSTEM'` (the twice-daily `vallo-daily-note` job posts that way) and `'BOT'`, so a published item is an ordinary `posts` or `stories` row the feed already renders. (2) **Schedule**: a calendar of queued items with publish time, Lagos time zone. (3) **Draft with the assistant**: the workspace assistant (`components/workspace/WorkspaceAssistant.tsx`) with a "drafting" mode, its output always landing in the composer for a human to edit and press Publish; consent recorded through `lib/ai/consent.ts`. (4) **Analytics**: per item views, likes, saves, comments, reposts from the counters already on `posts` and `stories` (`view_count, like_count, repost_count, save_count, comment_count`), plus taps from `funnel_events` where a `door` names the post. (5) **Support**: the tickets tab, reply only.
- **Data.** `public.scheduled_publications (id, kind check in ('post','story','announcement','banner'), body, media_path, area_id, publish_at, published_ref uuid, state check in ('draft','scheduled','published','withdrawn'), created_by, approved_by, created_at)`; a pg_cron job `vallo_publish_scheduled` every 5 minutes calls `private.publish_due()`, which inserts the SYSTEM post or story and stamps `published_ref`. Media goes to the existing `social-media` bucket under a `vallo/` prefix. Every compose, schedule, publish and withdraw writes `audit_log` (`studio.*`). A banner or announcement needs a second person's approval when it links to money or safety pages (the `approved_by` column).

### Reports to the right desk

Today: `public.reports` (0 rows live) takes `listing, conversation, message, review, business, event`; social reports (`reportPost`, `reportProfile`, `reportStoryComment` in `lib/social`) insert into the same table; all land in `/admin/queue?tab=reports` for `moderation`. Door-charge reports go to `door_charge_reports` and Alerts. Transactions go through a support ticket. Proposed routing, by a `desk` column computed on insert (`private.report_desk(target_type, category)`):

| Report | Desk (scope) | Clock |
|---|---|---|
| any target, `off_platform_payment` or `scam` | Trust and safety (`moderation`), copy to `compliance` when money moved | urgent |
| any target, `unsafe` | Trust and safety (`moderation`) | urgent |
| listing or business, `not_as_described`, `unavailable`, `duplicate` | Supply (`listing_approval`), shown on the partners desk | standard |
| review, post, story comment, profile, event, `offensive` | Moderation (`moderation`) | standard |
| message or conversation | Moderation, with the message flag lane | by category |
| transaction (new target `payment`, from the receipt) | Money (`finance`) | standard |
| door charge differed | Supply and support (AD-07) | standard |
| person (new target `person`, from any profile, not only social) | Trust and safety | by category |

The queue's `TAB_SCOPE` then reads `desk` instead of the fixed map, and each desk's tab shows only its rows. The acknowledgement and trace already exist in `lib/reports/my-reports.ts`.

### Other missing flows (agent side)

Getting started (A-01), Needs attention tasks (A-02), What do you manage (A-04), status filter (A-05), month calendar (A-11), Activity inbox (A-12), bank chooser (A-16), agent shell kept offline (X-06), and the "Exit agent tools" control in every drawer (X-05).

---

## Backend: architecture and consistency

- **B-01** `lib/**` and `app/**` `"use server"` files: 189 files, 158 return `ActionResult` (`lib/actions/envelope.ts`); 31 do not. The ones a person meets: `lib/admin/queue-desk-actions.ts` (void), `lib/host/front-desk-actions.ts` (`StayEventResult`), `lib/inspections/handshake-actions.ts` (three bespoke answer types), `lib/compliance/sanctions/actions.ts` (`DeskAnswer`), `lib/reports/withdraw-action.ts`, `app/(app)/verification/actions.ts` (`KycSubmitResult`), `lib/agent/application.ts`. Fix: move each onto `ActionResult<T>` (the bespoke shapes become `data`), and add a lint test that every exported async function in a `"use server"` file returns `Promise<ActionResult<...>>` except the documented auth and passcode exceptions. **P1 . M . Server**
- **B-02** Error words: 387 `fail("...")` literals with 318 distinct sentences, and 36 local constants for the same "service is down" sentence (`const SERVICE_DOWN` in `lib/admin/actions.ts:62`, `money-actions.ts:21`, `moderation-actions.ts:30`, `suspension-actions.ts:35`, `verification-actions.ts:36` and others). Near-duplicates: "That did not go through. Nothing changed. Try again." versus "That did not go through. Nothing was changed. Try again." Fix: `lib/actions/words.ts` with `UNREACHABLE`, `NOT_FOUND(thing)`, `TAKEN_ELSEWHERE`, `SIGNED_OUT`, used everywhere; banned-phrase test extended to the duplicates. **P2 . S . Server**
- **B-03** Rate limits on writes: in-app `consume()` (`lib/security/rate-limit.ts`) in 38 action files; database `limit_member_inserts` triggers on `listings, messages, posts, reports, reviews, story_comments`, plus `support_ticket_rate` and `support_message_rate`. Unlimited by either: `lib/bookings/actions.ts` `reserve` (creates holds against inventory), `lib/inspections/actions.ts` `requestInspection`, `lib/viewings/actions.ts` `bookViewingSlot`, `lib/briefs/actions.ts` `postBrief`, `lib/enquiry/actions.ts`, `lib/saved/*` (cheap but unbounded), `lib/messages/direct-actions.ts` thread creation (relies on the message trigger only). Fix: add `inspection_requests`, `bookings` (holds), `viewing_bookings`, `briefs` to `limit_member_inserts`, and `consume(subjectForUser)` in `reserve` so a script cannot hold every night of a listing. **P1 . S . DB/Server**
- **B-04** `lib/agent/listings-queries.ts:106` `getAgentContext` is not wrapped in React `cache()`, and `components/agent/AgentShell.tsx` calls `getUnreadMessageCount` (`lib/agent/messages-queries.ts:110`), which calls `getAgentContext` again: every agent page reads `agents` at least twice per request (24 page call sites). Fix: `export const getAgentContext = cache(async ...)`, as `readSession` and `getShellContext` already are. **P1 . S . Server**
- **B-05** Hot pages, serial waves: `app/(app)/search/page.tsx` (908 lines) runs up to five dependent waves (a 9-read `Promise.all`, a 4-read `Promise.all`, `readListingFactsFor` when the id set is over 200, `readCommutes` when anchored, a 2-read `Promise.all`); `app/(app)/listing/[id]/page.tsx` (1,815 lines) awaits `listingById`, then two `Promise.all`s, then `await readPayeeRecords` inside JSX (line 1351) and `headers()` at line 1001; `app/(app)/messages/[id]/page.tsx` awaits `readMyReplyTemplates` (line 200) and a facts read (line 254) after its `Promise.all`; `app/(app)/home/page.tsx` `readStatedKinds` is two waves inside the first. Fix: one `search_page(p_query jsonb)` RPC returning results with facts, captions and ownership in one round trip; hoist the in-JSX awaits into the page's `Promise.all`; pass the already-read `listing.id` to a single "listing extras" RPC. **P1 . M . Server/DB** (Survey A owns the pages' look; this is only their data path)
- **B-06** Two phone gates: `lib/phone-otp/gate.ts` (`decidePhoneGate`, fail open, 28 importers: reputation friction) and `lib/identity/phone-gate.ts` (`requireConfirmedPhone`, fail closed, 4 importers: money). The split is deliberate and documented, but they read `confirmed_phones` two ways and speak two message sets. Fix: one module `lib/phone/gate.ts` exporting `phoneGate(mode: "friction" | "money")`, one lookup, one sentence set; keep both behaviours. **P2 . S . Server**
- **B-07** Dead sign-up phone gate: `lib/phone-otp/signup-gate.ts`, `signup-gate-server.ts` and `app/(auth)/sign-up/phone/page.tsx` survive although sign-up no longer asks for a phone (AUDIT section 0). Only the page itself still imports them. Fix: confirm with Survey A that nothing links to `/sign-up/phone`, then delete the three files and their tests. **P2 . S . Server**
- **B-08** Dead code: `lib/native/device.ts:76` `nativeHaptic` has no caller; `components/ui/Toast.tsx` `useToast` still has 4 callers (`components/social/badges/BadgeMoment.tsx`, `social/profile/ProfileMenu.tsx`, `ProfileShare.tsx`, `social/story/StoryViewer.tsx`) beside the global banner. Fix: move the 4 to `banner.*`, delete `useToast` and `nativeHaptic`. **P2 . S . UI**
- **B-09** Two help stores: `lib/support/faq.ts` (grounds the support AI) and `lib/support/help-articles.ts` (the help pages). Fix: one content source (`lib/help/articles.ts`) with the FAQ as a derived view, so the assistant and the help centre cannot disagree. **P2 . M . Server**
- **B-10** Four ID upload surfaces and three buckets (H-05). Fix: one `lib/identity/documents.ts` server module (signed upload URL, MIME and size rules, one bucket `identity-checks`, HEIC accepted or converted client-side everywhere) used by `KycFlow`, `ApplyWizard`, the register forms and `HostDocumentUploader`. **P1 . L . Server/DB**
- **B-11** Payout account flows: three UIs over `lib/payments/bank-accounts-actions.ts` (A-16). **P1 . M . UI**
- **B-12** Thread readers: `lib/messages/live.ts` (`loadConversationSummaries`, `loadThread`, `getThreadContext`), `lib/agent/messages-queries.ts` `getAgentInbox` (a second inbox reader), `lib/admin/queries.ts:1445` `getTicketThread` and the member support thread, `lib/social/posts-queries.ts:749` `getThread`, plus `lib/venue-messages`. Fix: the agent inbox reads `loadConversationSummaries` with a lister filter and adds its stages on top; support threads share one `readSupportThread`; social threads stay separate (different model). **P2 . M . Server**
- **B-13** `app/agent/list/ListingWizard.tsx` writes drafts through `lib/agent/listings-actions.ts`, but listing rules also live in `lib/listings/photo-gate.ts`, the submit gate, `lib/admin/actions.ts` `heldReasons` (re-implements the mandate and door-charge checks in TypeScript after the database already refused). Fix: one `listing_publish_blockers(p_listing)` SQL function that the wizard's checklist, the admin desk and `heldReasons` all read, so the three can never disagree. **P1 . M . DB/Server**
- **B-14** Stale comments: `app/agent/list/page.tsx:34` ("seven step"), `components/agent/AgentShell.tsx` `locale` prop "still passed by every page", `components/host/HostShell.tsx` `logoLabel` `@deprecated`, `app/admin/_components/nav.ts:13` "the renders draw twelve rows" (check after AD-10). Fix: correct or delete with the files they describe. **P2 . S . Server**
- **B-15** API routes (55): consistent bearer guard on 21 cron routes through `runCronJob`; signatures on webhooks; `consume()` on public write routes (`client-error`, `vitals`, `funnel`, `support`, `push/register`, `map/listings`, `assistant`). Exceptions worth a look: `api/csp-report` has a body cap and an in-memory dedupe but no rate limit (logs only, low risk); `api/paystack/reconcile` does not use `runCronJob`, so it records no `job_runs` row (see R-03). Fix: wrap reconcile in `runCronJob`. **P2 . S . Ops**
- **B-16** `record_funnel_event` (anon, SECURITY DEFINER) inserts a row per new `p_visit` uuid with no limit; a script can fill `funnel_events` (purged daily by `vallo_purge_funnel_events`). Fix: revoke anon EXECUTE and keep the `api/funnel` route (already rate limited) as the only door, or add a per-IP limit in the function. **P2 . S . DB**

---

## Database: advisors, RLS, indexes

Read live on 7 November 2026, 15:13 UTC.

### Advisor counts

| Advisor | Lint | Level | Findings |
|---|---|---|---|
| Security | `authenticated_security_definer_function_executable` | WARN | 371 |
| Security | `anon_security_definer_function_executable` | WARN | 29 |
| Security | `auth_leaked_password_protection` | WARN | 1 |
| Security | `rls_enabled_no_policy` | INFO | 110 (public 86, private 14, retired_custody 7, promotion 3) |
| Performance | `multiple_permissive_policies` | WARN | 393 across 75 tables |
| Performance | `unused_index` | INFO | 347 across 163 tables |
| Performance | `unindexed_foreign_keys` | INFO | 20 |
| Performance | `auth_db_connections_absolute` | INFO | 1 |
| **Totals** | 8 lints | ERROR 0, WARN 794, INFO 478 | |

### RLS

- 323 tables in `public`, **0 without RLS**, 439 policies, **0 write policies (`INSERT`, `UPDATE`, `DELETE`, `ALL`) with a `true` expression**. All 8 public views run `security_invoker=true`.
- 24 `SELECT ... using (true)` policies, all reference or published data (`amenities`, `states`, `fee_rates`, `money_policy*`, `feature_flags`, `agent_badges`...) except two worth a decision: `follows` and `post_reposts` (the social graph readable by anyone, including anon), and `price_check_shares` readable by every signed-in account including `created_by` (anon has no grant). 

- **D-01** Leaked password protection is off (Supabase Auth, HaveIBeenPwned check). Fix: turn it on in the Auth settings (founder's dashboard; no migration). **P1 . S . Ops**
- **D-02** 393 multiple-permissive-policy warnings; the hot read path pays for them: `listings` 20, `accommodations` 20, `businesses` 20, `listing_access` 16, `inspection_requests` 15, `area_members` 12, `agent_applications` 10, `listing_mandates` 10, `reports` 10. Postgres evaluates every permissive policy and ORs them on each row of every search. Fix: per table and command, merge into one policy per role (`<table>_select` with the OR inside), starting with `listings`, `accommodations`, `businesses` and the `*_write` policies that also grant `SELECT` (for example `accommodation_amenities_select` + `accommodation_amenities_write`); measure search with `EXPLAIN ANALYZE` before and after. **P1 . M . DB**
- **D-03** 29 SECURITY DEFINER functions executable by anon. Most are deliberate public reads (`platform_stats`, `directory`, `leaderboard`, `listing_truth_for`, `listing_lister_name`, `calendar_feed`, `share_door`, `referral_door`, the `landlord_line_*` token doors). Two are writes: `record_funnel_event` (B-16) and `landlord_line_answer` / `landlord_line_stop` (token-gated, fine). Fix: one migration that documents each as intended with `comment on function` and revokes anon from any that only the server calls; add a check in `scripts/check-migrations.mjs` that a new anon-executable definer needs a comment. **P2 . S . DB**
- **D-04** 371 definer functions executable by `authenticated`: the RPC-first design (every write is a definer function with its own checks), so this is expected, but it means internal helpers reachable from the REST API need care. Fix: inventory once; any helper not meant to be called from a client moves to `private` (which is not exposed) or loses `EXECUTE` for `authenticated`. **P2 . M . DB**
- **D-05** 110 tables with RLS on and no policy: deny-all to clients, server-only by design (ledger, sanctions, wallets, idempotency, webhooks). 86 of them sit in `public` beside client tables, including `escrows`, `escrow_rulings`, `wallets`, `wallet_entries` although escrow is retired (`retired_custody` schema exists). Fix: as the "planned backend" step, move server-only tables to `private` (or a `server` schema) and retired ones to `retired_custody`, so `public` means "a client may touch this". **P2 . L . DB**
- **D-06** `auth_db_connections_absolute`: Auth pinned to 10 connections. Fix: switch to percentage allocation before any instance resize. **P2 . S . Ops**

### Indexes

- Hot foreign keys were indexed on 28 October (`20261028132808_fk_indexes_hot_tables`) and 31 October (`index_remaining_growing_f...`, see D-08). The 20 left are mostly audit columns (`*_decided_by`, `*_updated_by`, `*_created_by`, `*_granted_by`): `agent_documents.request_id`, `agreement_risk_settings.updated_by`, `blocked_terms.added_by/retired_by`, `call_reviews.outcome_by/requested_by`, `deal_agreements.decided_by`, `enquiry_followups.set_by`, `guarantee_claims.decided_by/paid_by`, `identity_checks.decided_by`, `internal_accounts.marked_by`, `member_entitlement_plans.granted_by`, `money_policy.updated_by`, `payment_rail_policy.created_by`, `provider_arrangements.release_paused_by`, `referral_policy.created_by`, `subscription_settings.updated_by`, `verification_requests.document_id/requested_by`.
- **D-07** Index the three with real join traffic (`agent_documents.request_id`, `verification_requests.document_id`, `verification_requests.requested_by`) and `identity_checks.decided_by` (the KYC desk sorts by reviewer); leave the policy-table audit columns. Do not act on the 347 unused indexes until there is launch traffic (with 30 profiles every index looks unused; `listings` alone shows 23). **P2 . S . DB**

### Migrations

- **D-08** Drift between live and repo: live `supabase_migrations.schema_migrations` has 756 versions, `supabase/migrations` has 753 files. Live only: `20261031090702_vitals_cold_start_boot_ti...`, `20261031090713_vitals_cold_start_validat...`, `20261031091854_index_remaining_growing_f...` and `20261103145342_newsletter_enqueue`; repo only: `20261103140500_newsletter_enqueue.sql`. A fresh environment built from the repo would miss three migrations and replay the newsletter one under the wrong version. Fix: pull the three statements from `schema_migrations.statements` into files with their live versions, rename the newsletter file to `20261103145342` and record it in `supabase/migrations/RENAMED.txt`, then make `scripts/check-migrations.mjs` compare against the live list in CI. **P0 . S . DB**
- **D-09** `supabase/migrations/pending/` holds 6 unapplied files (`grade1_push_drain_kick_on_enqueue.sql`, `grade1_staff_sign_in_alerts_only_new_device.sql`, `grade1_voice_notes_and_message_reactions.sql`, `newsletter_default_on_2026-11-launch.sql`, `rt01_remove_retired_objects.sql`, `rt02_remove_v100_renter_passport.sql`) plus `rollback/` and `LANDMARKS.md`. Fix: a one-line owner and decision date per file in `LANDMARKS.md`, so nobody applies `rt01` or `rt02` without the founder. **P2 . S . DB**

---

## Reliability: crashes, crons, push

### Crash recorder (`public.risk_alerts`, `entity_type = 'client_error'`)

9 rows, all open, 6 to 7 November (the recorder started on 6 November, `app/api/client-error`).

| Pattern | Count | When | Status |
|---|---|---|---|
| `cannot add postgres_changes callbacks ... after subscribe()` | 7 | 6 Nov 13:00 (1), 19:00 (3), 20:00 (1), 21:00 (1), 22:00 (1) | Fix committed 6 Nov 20:19 (`lib/supabase/channel-name.ts` `ownChannelName`); 2 rows after it |
| `"Haptics.then()" is not implemented on ios` | 1 | 6 Nov 13:00 | Fixed 6 Nov 13:41 (`lib/native/device.ts`) |
| `RangeError: Maximum call stack size exceeded` in a minified `trigger` | 1 | 7 Nov 14:00 | Unattributed |

- **R-01** `lib/calls/useCallRealtime.ts:76` still opens `supabase.channel(\`call-${callId}\`)` with a `postgres_changes` listener, the exact shape `ownChannelName` was written to prevent (its own comment: database listeners must use it; only broadcast channels keep shared names). Reopening a call screen before the old channel is removed throws the same error. Fix: `ownChannelName(\`call-${callId}\`)`; add a test that greps for `.channel(` followed by `postgres_changes` without `ownChannelName`. The 21:00 and 22:00 rows may also be phones still on the old build (`DeployWatch` reloads them). **P1 . S . UI**
- **R-02** The stack overflow cannot be traced from a minified frame. Fix: upload source maps privately (Vercel or the recorder) or record the chunk path plus line and column so `_next/static/immutable/chunks/*` resolves; then resolve or close the 9 open rows so the desk shows only live problems. **P2 . S . Ops**

### Cron health

- **pg_cron (41 jobs): every one active, 0 failed runs in 7 days.** Includes per-minute `vallo_calls_sweep` and `vallo_hold_claims_sweep` (10,080 runs each), `vallo_push_drain` every 5 minutes (2,016), and `vallo_reconcile_payments` hourly.
- **Vercel crons (`apps/web/vercel.json`, 21 entries, region `dub1`) as recorded in `public.job_runs`: all `ok` for 7 days**, except `landlord-line` (641 runs, all `skipped`, its flag is off) and `store-readiness` (2 runs, both `repeat`, last 6 Nov; scheduled daily). `photo-hash-backfill` and `push-drain` are driven by pg_cron through `pg_net` and record runs too. `net._http_response` last 7 days: 76 responses 200, 2 responses 500.
- **Open operational alerts:** `Store: readiness, red` 18 open (10 Oct to 7 Nov, one a day, never resolved), `Catalogue: read failed` 7 open (to 6 Nov), `Cron: email outbox, failed` 2 (19 Oct), `Cron: pg cron watch, failed` 1, `Cron: sanctions screen, unrecorded` 1, `Money reconciliation: the last call got no reply` 1, `Webhook: payluk, signature invalid` 1 (13 Oct). `Push drain: the last call did not succeed` 25, all resolved (15 Oct to 1 Nov, fixed by `20261101095601_push_drain_alerts_once`).

- **R-03** Paystack reconciliation runs from two schedulers: pg_cron `vallo_reconcile_payments` (minute 47, calls `private.request_money_reconciliation()`, which posts to the site's reconcile route) and Vercel `/api/paystack/reconcile` (minute 10). Result: 1,440 `payment.reconciliation.run` audit rows in 30 days (exactly two an hour), 97% of all `audit_log` rows, burying the staff actions an auditor looks for. Fix: keep one scheduler (pg_cron, which already alerts on no reply), delete the Vercel entry, and write a reconciliation audit row only when it changed something; wrap the route in `runCronJob` (B-15). **P1 . S . Ops**
- **R-04** `Store: readiness, red` raises a new open alert every day and none is ever resolved, and the job recorded only 2 runs in 7 days with outcome `repeat`. An alert that fires daily for a month trains staff to ignore the Alerts desk. Fix: make the alert idempotent (update the open row's `last seen`, the pattern `20261101095601_push_drain_alerts_once` used), list which readiness checks are red on the alert, and confirm why the daily run reports `repeat`. **P1 . S . Ops**
- **R-05** `Catalogue: read failed` 7 open alerts (`app/api/health/catalogue`). Fix: find which read fails (it guards the public catalogue the home and search pages use) and resolve; this is the one open alert that touches the member surfaces. **P1 . S . Ops**
- **R-06** `vercel.json` `new-match-alerts` runs at `0,5,10,15,20,25,30,35,45,50,55`: minute 40 is missing with no comment. `landlord-line` runs 96 times a day only to skip. Fix: write the reason or restore `*/5`; gate `landlord-line` in `vercel.json` (remove the entry while the flag is off) to save invocations. **P2 . S . Ops**
- **R-07** Old open alerts (email outbox 19 Oct, payluk signature 13 Oct, sanctions unrecorded 25 Oct, money reconciliation no reply 25 Oct, pg cron watch 28 Oct): the jobs are green now, the alerts are not closed. Fix: close with a note, or auto-resolve on the next green run. **P2 . S . Ops**

### Push pipeline

- `public.push_tokens`: **1 active token, 1 person** (of 30 profiles). `private.push_enqueue` queues only for people with a live token, by design.
- `public.push_queue`, last 7 days: 7 rows, `done/delivered` 3, `done/suppressed_no_device` 4, 0 retried; last 30 days the same 7. `public.push_queue_health`: pending 0, held 0, sending 0, failed 0, dead 0, stale claims 0, 2 delivered in the last hour.
- Notifications last 7 days: 44 (`system` 32, `message` 7, `social` 4, `listing` 1); 7 reached the queue (the token holder's).

- **R-08** The pipeline is healthy but untested at volume: one device. `suppressed_no_device` on 4 of 7 rows for the one person with a token suggests their token was seen as gone at send time (revoked between enqueue and drain, or device ref mismatch). Fix: before launch, enrol at least one iOS and one Android test device per platform, run `api/push/self-test` from each, and check `push_deliveries.provider_status` per platform; the pending `grade1_push_drain_kick_on_enqueue.sql` (send at enqueue instead of waiting up to 5 minutes) is worth applying after that test. **P1 . S . Ops**

---

## Top 25 for workspaces and backend (ranked)

1. **D-08** Commit the 3 live-only migrations and fix the `newsletter_enqueue` version, then check drift in CI (P0, S, DB).
2. **X-02** Every workspace action reports through `banner.*`, starting with listings, staff, support, host saves (P0, M, UI).
3. **LW-01 + LW-02** Split `ListingWizard.tsx` into steps-as-data on `StepFrame` with the 17-row flow, keeping every gate (P1, L, Flow).
4. **LW-04** Bring charges at the door and the owner's mandate into the wizard so no lister learns of them from a refusal (P1, M, Flow).
5. **B-13** One `listing_publish_blockers` SQL function read by the wizard checklist, the admin desk and `heldReasons` (P1, M, DB).
6. **X-01 + AD-01** All 95 workspace pages on `PageFrame`; one admin header (P1, M, UI).
7. **A-01 + A-02 + H-07** Getting started card and Needs attention tasks with Do it / Dismiss / Snooze on agent and host dashboards (P1, M, UI).
8. **A-12** Agent Activity inbox with counted tabs (P1, M, UI).
9. **A-11** Agent month calendar with legend counts and a day sheet (P1, M, UI).
10. **A-04** What do you manage sheet writing a dashboard focus (P1, M, UI).
11. **Desk 1** Business developer desk: position, `onboarding_cases`, invitations, audit (P1, L, Flow).
12. **Desk 2** Social media manager desk: SYSTEM posts, `scheduled_publications`, pg_cron publisher, analytics, audit (P1, L, Flow).
13. **AD-06 + AD-07** Reports routed to desks by a computed `desk`; door-charge reports into a queue lane (P1, M, Server).
14. **B-03** Insert limits on bookings holds, inspection requests, viewings and briefs (P1, S, DB).
15. **D-02** Merge permissive policies on `listings`, `accommodations`, `businesses` and other hot tables (P1, M, DB).
16. **B-04** `cache()` on `getAgentContext` (P1, S, Server).
17. **B-05** Collapse search and listing page serial waves into one read each (P1, M, Server).
18. **R-03** One scheduler for Paystack reconciliation; stop flooding `audit_log` (P1, S, Ops).
19. **R-01** `ownChannelName` for the call channel; guard test (P1, S, UI).
20. **R-04 + R-05** Make readiness alerts idempotent and fix the catalogue read failure (P1, S, Ops).
21. **B-01 + AD-02** Every server action on `ActionResult`, starting with the admin queue's void actions (P1, M, Server).
22. **X-05** One role switch model and the "Exit agent tools" row in every drawer (P1, M, UI).
23. **H-05 + B-10** One document capture and one identity bucket for all four ID uploads (P1, L, Flow).
24. **X-06** Keep the agent and host shells offline with the device stamp (P1, M, Ops).
25. **D-01** Turn on leaked password protection (P1, S, Ops).

**Finding count:** 84 (X 7, A 18, LW 6, H 7, AD 10, desks and routing 3, B 16, D 9, R 8). The 17 rows of the proposed wizard flow are design, not counted separately.
