# SURVEY A: MEMBER, PUBLIC, AUTH AND ONBOARDING (GRADE 1 WORK QUEUE)

Written 7 November 2026 by Survey Agent A, read-only, on the code as it stands.
Scope: every `page.tsx` under `apps/web/src/app/(app)` (119), `(site)` (32),
`(auth)` (12), `(landing)`, `welcome`, `offline`, `first-run`, `s`, and the shell
(`components/app/AppShell.tsx`, `MobileTabBar.tsx`, `DockMore.tsx`, `NavTree.tsx`,
`nav-model.ts`). 168 routes in all. Agent, host, admin and backend are Survey B.

Paths are under `apps/web/src/` unless they start with `docs/` or `packages/`.

**How this was measured.** A script followed each page's local imports three
levels deep (stopping at `lib/`, `design-system/` and `components/ui/`) and counted,
per route: header kind, `loading.tsx`, banner calls, inline status sentences,
hand-rolled dialogs, raw `text-[...]`, arbitrary radii, inline `<svg>`, bold icon
weights, em dashes, vague error copy, inputs and `enterKeyHint`, primary buttons and
sheets. Every finding below was then checked by reading the file. Line numbers are
from today's tree.

**Priority**: P0 launch-blocking, P1 needed for Grade 1, P2 polish.
**Size**: S under a day, M one to three days, L more. **Layer**: component, page,
CSS, copy, route config, product decision.

**Note on the icon rule.** `docs/UX_SYSTEM.md` section 7 now carries the founder's
ruling of 7 November: icons are NOT thinned; the chrome keeps its bold stroke. This
survey follows that ruling, so there is no "bold to lean" sweep. Two places still
contradict it and should be corrected by the lead: `docs/UX_SYSTEM.md` section 12
("Thin icons" in the definition of done) and `docs/handoff/AUDIT_2026-11.md`
section 3 ("The bold chrome is the single biggest reason...").

---

## Summary

1. The four shared pieces exist but are almost unused: `PageFrame` is on 0 product pages, `StepFrame` and `OptionCards` are used only by `components/verification/KycFlow.tsx`, and `banner.*`/`toast(` is called from 6 product files.
2. Feedback is the biggest gap: about 120 member components report outcomes as an inline `role="status"` sentence, a private timer note, or nothing; 4 social files still use the old local `useToast`.
3. Sheets: 77 `<Sheet>` instances on the member and public side; 67 have no close X (`closeLabel`), 0 have a `description`, 1 has a sticky `footer`.
4. Headers: about 75 member pages use the small inline `PageHeader`, 11 use `variant="large"`, and 9 money screens, the feed, search, support, leaderboard and registrations draw their own tops.
5. Every long form has its own stepper: `RegisterShell` (owner, agent, firm), `ApplyWizard` (professional), the wallet step machines, `PaymentSteps` plus `SegmentedProgress` at checkout, `StepPath`, `ProgressPath`, `VerificationPath`.
6. Duplicates for the same job: two agent registrations, three AI consent pages, two support chats, three help search boxes, three first-message composers, two people finders, four money history pages beside Wallet, two withdrawals, two stay detail templates, two phone confirmations.
7. Empty states draw the 3D object by default (`components/ui/State.tsx` derives `art` from `icon`), against the Grade 1 "one thin glyph".
8. Hard-coded English sits in 48 member components plus `lib/money/copy.ts` (215 constants) and `lib/money/balance-copy.ts` (40); the whole Wallet is English-only.
9. Loading coverage is good (107 `loading.tsx`), but 33 routes inherit a skeleton of the wrong shape; no hard dead links were found; the em dash gate holds (0 in scope).
10. The visual debt is small and listable: 17 raw `text-[...]` sizes, about 25 off-scale radii (6px and 10px on containers), 9 inline icons that have a `UiIcon`, 6 hand-rolled dialogs.

---

## Platform-wide sweeps

Each sweep is one change applied to many files. Do these before the page-by-page
list: most page rows below become small once the sweeps land.

### SW1. Every action outcome to the top banner (P0, L, component)

Rule to apply: an action's OUTCOME (saved, sent, deleted, cancelled, copied,
failed) goes to `banner.success/info/warning/error` from `lib/ui/toast.ts`, with
`{ retry }` on failures that can be retried. FIELD errors (under one input) stay
inline. A queued action says "Saved on your device. It sends when you're back
online". The page keeps its own record (UX_SYSTEM 8.1).

Files that report an outcome inline today (move the outcome, keep field errors):

- **Settings**: `app/(app)/settings/AccountToggles.tsx` (updateSettings, line 75), `app/(app)/settings/notifications/NotificationMatrix.tsx` (note, 332), `app/(app)/settings/place/PlaceForm.tsx` (saved, 82), `app/(app)/settings/DeleteAccountPanel.tsx` (done, 247), `app/(app)/settings/MoneyLockGroup.tsx`, `app/(app)/settings/AiConsentCard.tsx`, `app/(app)/settings/ai-assistant/AssistantControls.tsx`, `app/(app)/settings/ai-assistant/consent/ConsentForm.tsx`, `app/(app)/settings/devices/DeviceList.tsx` (outcome, 207), `app/(app)/settings/devices/NotMePanel.tsx`, `app/(app)/settings/privacy/blocked/BlockedList.tsx` (unblock, 90 to 98), `app/(app)/settings/privacy/PendingAddressMove.tsx`, `app/(app)/settings/passcode/PasscodeSettings.tsx` (done), `app/(app)/settings/phone/PhoneConfirmForm.tsx` (done, 157), `app/(app)/settings/phone/ProfilePhoneForm.tsx`, `app/(app)/settings/SettingsHub.tsx`, `app/(app)/settings/AccountSection.tsx`, `app/(app)/settings/help/MyReports.tsx`, `components/app/payments/PaymentMethodsPanel.tsx` (251 to 300), `components/app/payments/AddBankAccountSheet.tsx`, `components/app/push/PushSetting.tsx`, `components/app/push/PushDevices.tsx`, `components/passport/PassportSettings.tsx`, `components/app/welcome/InterestChoices.tsx` (saved, 114), `components/app/IntentTune.tsx`.
- **Profile and social**: `app/(app)/profile/AccountBody.tsx` (448), `app/(app)/profile/AccountHero.tsx`, `components/social/profile/ProfileEditor.tsx` (saved, 350), `components/social/profile/ProfilePhotos.tsx` (111, 147, 168, English literals), `components/social/profile/FollowButton.tsx` (error, 150), `components/social/profile/PeopleList.tsx`, `components/social/ReportSheet.tsx` (sent, 69), `components/social/comments/CommentsSheet.tsx` (notice, 240), `components/social/feed/Feed.tsx` (notice, 401, 464), `components/social/feed/PostEditor.tsx`, `components/social/story/StoryComposer.tsx`, `app/(app)/post/[id]/ThreadView.tsx` (notice, 205, 261), `app/(app)/around/JoinButton.tsx`, `app/(app)/around/new/ProposeAreaForm.tsx` (done, 107), `app/(app)/around/[slug]/ModeratorApply.tsx`.
- **Messages and calls**: `app/(app)/messages/[id]/ThreadView.tsx` (a private note with its own 4s timer, 495 to 531 and 1770), `app/(app)/messages/Inbox.tsx` (archive note, 610), `app/(app)/messages/new/FirstMessage.tsx`, `app/(app)/u/[handle]/message/DirectFirstMessage.tsx`, `app/(app)/messages/share/SharePicker.tsx`, `components/app/messages/ForwardSheet.tsx`, `components/app/messages/StageControl.tsx`, `components/app/messages/ShowMePanel.tsx`, `components/app/messages/AvailabilityCard.tsx`, `components/app/messages/MediaViewer.tsx`, `components/passport/PassportThreadRows.tsx` (81), `components/stays/MessageVenue.tsx`, `components/calls/CallButtons.tsx`.
- **Saved and search**: `app/(app)/saved/Collections.tsx` (createCollection, deleteCollection, setInCollection), `app/(app)/saved/SavedBoard.tsx` (in-slot undo chip), `components/app/saved-searches/SaveSearchControl.tsx`, `components/app/saved-searches/SavedSearchBoard.tsx`, `components/app/search/ShelfChipRow.tsx`, `components/app/compare/CompareBody.tsx`.
- **Bookings, viewings, reservations**: `components/app/bookings/CancelBookingSheet.tsx` (102), `app/(app)/bookings/[bookingId]/review/ReviewForm.tsx` (203 to 238), `components/app/inspections/ViewingSheets.tsx`, `components/app/inspections/ViewingDayKit.tsx` (87 to 100), `components/app/inspections/InspectionSheet.tsx`, `components/app/inspections/TruthQuestions.tsx`, `components/app/inspections/GateHandshake.tsx`, `components/app/inspections/visit/VisitPlanner.tsx`, `components/app/inspections/visit/VisitListerCard.tsx`, `components/app/inspections/visit/VisitStatus.tsx`, `components/app/listing/ListerCallButton.tsx`, `components/app/listing/StillAvailable.tsx`, `app/(app)/listing/[id]/ReservePanel.tsx`, `app/(app)/listing/[id]/ReserveTable.tsx`, `components/app/reservations/TableSeatingPanel.tsx`, `components/app/reservations/PayDepositButton.tsx`, `components/app/after-gate/RefundRequestForm.tsx`, `components/app/safety/UnsafeSheet.tsx`, `components/app/doors/SafetyShareControl.tsx`, `components/app/doors/AgentLookupCard.tsx`, `app/(app)/checkout/RoomRequestForm.tsx`, `components/app/ReportSheetPanel.tsx` ("Thank you, we have it").
- **Tenancy, agreements, rent, arrival**: `components/app/tenancy/CautionControls.tsx` (281), `components/app/tenancy/FlatmateControls.tsx`, `components/app/tenancy/RenewalControls.tsx` (offerRenewal, answerRenewal, answerExitAccount, relistFromTenancy), `components/app/tenancy/PinMessages.tsx`, `components/app/tenancy/ReceiptCodePanel.tsx` (copied, 81 to 97), `components/app/tenancy/TenancyReportCard.tsx`, `app/(app)/tenancy/[id]/complaint/PackControls.tsx`, `components/app/agreements/AgreementControls.tsx` (confirm, amend, cancel, claim), `components/app/agreements/DrawUpAgreement.tsx`, `app/(app)/agreements/[id]/fund/FundControl.tsx`, `app/(app)/agreements/[id]/fund/SwitchToCard.tsx`, `app/(app)/agreements/[id]/held/ReleaseControl.tsx`, `app/(app)/rent/review/[paymentId]/TenancyReviewForm.tsx` (114), `components/app/arrival-check/ArrivalCheckCard.tsx`, `components/app/arrival-check/ArrivalRuling.tsx`, `components/stays/ArrivalChargesForm.tsx`, `components/stays/DoorChargeReport.tsx`.
- **Money**: `components/money/balance/SendScreen.tsx` (163 to 289), `components/money/balance/WithdrawScreen.tsx`, `components/money/balance/AddMoneyScreen.tsx`, `components/money/balance/BalanceOnboarding.tsx`, `components/app/referral/InviteLinkCard.tsx` (copied, 60 to 81), `components/app/referral/RewardsPayoutForm.tsx`, `components/app/referral/WithdrawFlow.tsx`, `components/app/money/MoneyStepUp.tsx`, `components/money/pay-choice/PayChoiceCard.tsx`, `components/app/payments/crypto/CryptoPayOption.tsx`, `app/(app)/pro/ManagePlan.tsx`, `app/(app)/pro/PlanCheckout.tsx`.
- **Support and assistant**: `app/(app)/support/messages/[id]/ReplyBox.tsx` (setNote(copy.sent), 79), `app/(app)/support/messages/[id]/TicketActions.tsx`, `app/(app)/support/new/NewQueryForm.tsx` (fileSupportTicket), `components/app/account/ReportProblem.tsx`, `components/app/account/SupportChat.tsx`, `components/app/assistant/AssistantBlocks.tsx`, `components/app/assistant/AssistantChat.tsx` (461).
- **Verification**: `components/verification/KycFlow.tsx` (sent, 243), `components/verification/RequestedPhotoPanel.tsx`, `components/verification/DojahPanel.tsx`, `components/verification/DocumentUploader.tsx`.
- **Public site**: `app/(site)/contact/ContactForm.tsx`, `app/(site)/check/CheckForm.tsx`, `app/(site)/delete-account/RestoreForm.tsx`, `app/(site)/landlord/[token]/ReplyActions.tsx`, `app/(site)/safe/[token]/SafetySharePanel.tsx`, `components/site/NewsletterForm.tsx`. The host is global (`components/ui/DetailsHost.tsx` in `app/layout.tsx:545`), so the public site can use the banner today.

Actions with NO feedback at all (add a banner): Mark all read (`app/(app)/notifications/LiveNotifications.tsx:154`), Copy message (`app/(app)/messages/[id]/ThreadView.tsx:512`), inbox mark read (`app/(app)/messages/Inbox.tsx`, markInboxRead), cancel booking success (`components/app/bookings/CancelBookingSheet.tsx` shows only the error).

Gate to add after the sweep: a test that fails when a client component renders a `role="status"` sentence next to a server action call outside a field (the same shape as `components/ui/hand-rolled-sheets.test.ts`).

### SW2. Retire the local `useToast` (P0, S, component)

`components/ui/Toast.tsx:98` `useToast` draws its own pill per caller. Callers:
`components/social/profile/ProfileMenu.tsx`, `components/social/profile/ProfileShare.tsx`,
`components/social/badges/BadgeMoment.tsx`, `components/social/story/StoryViewer.tsx`.
Move each to `banner.*`, then delete `useToast` and the legacy `Toast` component.

### SW3. Sheet anatomy on every sheet (P1, M, component)

`closeLabel` is the close X's on switch (`components/ui/Sheet.tsx:130`). 67 of 77
member and public sheets omit it; none pass `description`; one passes `footer`.
Add a close X, a one-sentence description where the sheet asks something, and move
the action buttons into `footer` (one primary, one pale secondary). Files:
`app/(app)/post/[id]/ThreadView.tsx`, `app/(app)/profile/SignedOutHero.tsx`, `app/(app)/profile/AccountBody.tsx`, `app/(app)/pro/PlanCheckout.tsx`, `app/(app)/pro/ManagePlan.tsx`, `app/(app)/settings/MoneyLockGroup.tsx`, `app/(app)/settings/AiConsentCard.tsx`, `app/(app)/settings/DeleteAccountPanel.tsx`, `app/(app)/support/new/NewQueryForm.tsx`, `app/(app)/messages/[id]/ThreadOptionsSheet.tsx`, `app/(app)/saved/Collections.tsx`, `components/money/balance/WalletRows.tsx`, `components/money/balance/WithdrawScreen.tsx`, `components/money/balance/SendScreen.tsx`, `components/money/balance/AddMoneyScreen.tsx`, `components/verification/DojahPanel.tsx`, `components/social/badges/BadgeMoment.tsx`, `components/social/badges/BadgeRow.tsx`, `components/social/bloom/CreateBloom.tsx`, `components/social/profile/ProfileMenu.tsx`, `components/social/ReportSheet.tsx`, `components/social/comments/CommentsSheet.tsx`, `components/social/DeleteSheet.tsx`, `components/app/listing/ListingPhotoGrid.tsx`, `components/app/listing/ProofStrip.tsx`, `components/app/listing/CardMenu.tsx`, `components/app/money/MoneyStepUp.tsx`, `components/app/ReportSheetPanel.tsx`, `components/app/place/ChoicePicker.tsx`, `components/app/MemberKeys.tsx`, `components/app/price/ShareAreaButton.tsx`, `components/app/Disclosure.tsx`, `components/app/agreements/AgreementControls.tsx`, `components/app/account/ReportProblem.tsx`, `components/app/after-gate/RefundRequestForm.tsx`, `components/app/stays/StayFilterSheetPanel.tsx`, `components/app/filters/FilterDrawerPanel.tsx`, `components/app/ResultSheet.tsx`, `components/app/assistant/AssistantSettingsSheet.tsx`, `components/app/inspections/visit/VisitPlanner.tsx`, `components/app/inspections/ViewingSheets.tsx`, `components/app/messages/ShareSheet.tsx`, `components/app/messages/ForwardSheet.tsx`, `components/app/threads/ReservationFace.tsx`, `components/app/threads/RentalFace.tsx`, `components/app/payments/PaymentMethodsPanel.tsx`, `components/app/payments/crypto/CryptoPayOption.tsx`, `components/app/payments/AddBankAccountSheet.tsx`, `components/app/payments/PaymentStage.tsx`, `components/app/bookings/CancelBookingSheet.tsx`, `components/app/IntentTune.tsx`, `components/app/PhoneField.tsx`, `components/app/leaderboard/overlays.tsx`, `components/roles/RoleSwitcher.tsx`, `components/site/MobileMenu.tsx`.
Also: the wrapper `Sheet` in `components/app/account/rows.tsx:503` takes no
`closeLabel`, `description` or `footer` prop through; add them or replace its 7
callers with the platform `Sheet`. Cheapest route: make `closeLabel` default to the
dictionary's "Close" in `Sheet.tsx` and let callers opt out, so the sweep is one line.

### SW4. Pages onto `PageFrame` (P1, L, page)

`components/app/PageFrame.tsx` is used by no product page. Move every ordinary
page that draws `PageHeader` without `variant` (the small inline header) onto
`PageFrame`, which gives one title size, the fold, and the Grade 1 rhythm:
`agreements/[id]`, `agreements/[id]/fund`, `agreements/[id]/held`, `around/[slug]`, `around/new`, `around/people`, `around/settings`, `bookings/[bookingId]`, `bookings/[bookingId]/review`, `calls/reviews`, `calls/reviews/[id]`, `checkout`, `checkout/[bookingId]`, `inspections/gate/[id]`, `listing/[id]/trust`, `messages/new`, `messages/share/[kind]/[id]`, `notifications/[id]`, `passport/[who]`, `pay/crypto/[reference]`, `pay/deposit/[reservationId]`, `payments`, `payouts`, `post/[id]`, `price/area/[id]`, `pro/confirm`, `profile/application`, `profile/setup/[role]`, `receipts`, `record/[code]`, `refunds`, `rent/move-in/[listingId]`, `rent/pay/[inspectionId]`, `rent/review/[paymentId]`, `rent/share/[id]`, `restaurants`, `rewards`, `rewards/history`, `rewards/referrals`, `rewards/withdraw`, `saved/searches`, `settings/accessibility`, `settings/account`, `settings/ai-assistant`, `settings/ai-assistant/consent`, `settings/appearance`, `settings/devices`, `settings/devices/alert`, `settings/help`, `settings/interests`, `settings/invite`, `settings/invite/how-it-works`, `settings/notifications`, `settings/passcode`, `settings/passport`, `settings/payments` (the only `layout="stacked"`), `settings/phone`, `settings/place`, `settings/privacy`, `settings/privacy/ai`, `settings/privacy/blocked`, `settings/privacy/data`, `settings/privacy/money-lock`, `settings/region`, `stays/search`, `stories/new`, `support/messages`, `support/messages/[id]`, `support/new`, `tenancy/[id]`, `tenancy/[id]/complaint`, `u`, `u/[handle]/edit`, `verification` (all under `app/(app)/`).
Already large (keep, then wrap in `PageFrame`): `agreements`, `bookings`, `compare`, `messages`, `notifications`, `price`, `saved`, `settings`.
Hand-rolled tops to replace or justify: `components/money/balance/WalletChrome.tsx:46` `WalletHeader` (9 callers), `app/(app)/support/page.tsx` (site `BackButton` plus `components/support/SupportHero.tsx`), `app/(app)/profile/setup/page.tsx` (site `BackButton`), `components/app/leaderboard/LeaderboardScreen.tsx:185`, `components/supply/RegisterShell.tsx:92` (title at `TYPE.rowTitle`, smaller than every other page title), `components/social/profile/FollowListPage.tsx`, `components/app/inspections/visit/VisitHeader.tsx`.
Full-bleed screens that correctly skip it: `home`, `stays`, `search`, `around`, `listing/[id]`, `stay/[id]`, `restaurant/[id]`, `messages/[id]`, `stories/[id]`, `assistant`, `profile`, `u/[handle]`.

### SW5. Long flows onto `StepFrame` (P1, L, component)

`components/ui/StepFrame.tsx` is used only by `components/verification/KycFlow.tsx`.
Move these flows onto it and retire their private steppers:
- `components/supply/RegisterShell.tsx` (with `ProgressRing`, `components/supply/ProgressPath.tsx`) behind `OwnerRegisterForm.tsx`, `AgentRegisterForm.tsx`, `FirmRegisterForm.tsx` (`/profile/setup/owner`, `/agent`).
- `components/agent/ApplyWizard.tsx` (898 lines, `SegmentedProgress`) behind `/profile/setup/[role]` (professional).
- Wallet: `components/money/balance/SendScreen.tsx` (amount, review, otp, waiting: line 34), `WithdrawScreen.tsx`, `AddMoneyScreen.tsx`, `BalanceOnboarding.tsx` (`StepPath`).
- Rewards: `components/app/referral/WithdrawFlow.tsx`, `RewardsPayoutForm.tsx`.
- Checkout: `app/(app)/checkout/[bookingId]/page.tsx` (`SegmentedProgress`) plus `components/app/payments/PaymentSteps` in `PaystackCheckout.tsx` and `PaymentStage.tsx`: two progress marks on one screen.
- Agreements: `components/app/agreements/DrawUpAgreement.tsx`, `components/app/agreements/PaymentGate.tsx` (`StepPath`).
- Tenancy: the caution return in `components/app/tenancy/CautionControls.tsx` (15 fields inline on the tenancy page).
- Support: `app/(app)/support/new/NewQueryForm.tsx` (kind, then what happened, then photo).
- Feed: `app/(app)/around/new/ProposeAreaForm.tsx`, `components/social/story/StoryComposer.tsx` (`/stories/new`).
- `app/(app)/verification/page.tsx` still draws `VerificationPath` (inline svg, `components/verification/VerificationPath.tsx`) above the StepFrame flow: drop it once the frame carries progress.

### SW6. One-choice questions onto `OptionCards` (P1, M, component)

`components/ui/OptionCards.tsx` is used only by KycFlow. Candidates:
`components/supply/AddWorkspaceChooser.tsx` ("What do you want to add?", `/profile/setup`),
`components/app/welcome/InterestChoices.tsx` (`/welcome`, `/settings/interests`),
`components/roles/RoleSwitcher.tsx`, `components/money/pay-choice/PayChoiceCard.tsx`,
`app/(app)/pro/PlanPicker.tsx`, the reason lists in `components/app/bookings/CancelBookingSheet.tsx`,
`components/social/ReportSheet.tsx` and `components/app/ReportSheetPanel.tsx`, the kind
choice in `app/(app)/support/new/NewQueryForm.tsx`, `components/app/IntentTune.tsx`.

### SW7. Empty states: one thin glyph (P1, S, component)

`components/ui/State.tsx` derives a 3D object (`art`) from `icon` whenever one
matches (`components/ui/state-art.ts`), so most empty states draw the 80px clay
object. UX_SYSTEM section 11 says one thin glyph. Change the default to the line
glyph on its plate (`art: false` unless a caller asks), and keep art only for record
moments. Covers `EmptyState` (`components/app/Screen.tsx:254`), `DiscoveryEmpty`
(`components/app/search/DiscoveryEmpty.tsx`) and `EmptyActions`
(`components/app/EmptyActions.tsx`) at once. Then retire the two wrappers in favour of
`State` (the file's own V-97 plan).

### SW8. Inline `<svg>` to `UiIcon` (P2, S, component)

Replace where a glyph exists: `app/(app)/settings/phone/PhoneConfirmForm.tsx:167`
(tick, use `check`), `components/app/listing/ListingGallery.tsx:432,456` (play, use
`play`), `app/(app)/messages/[id]/ThreadView.tsx:374` (read ticks: add a
`check-double` glyph to `design-system/icons/UiIcon.tsx`),
`components/money/balance/MoveKit.tsx:118` and `components/money/AmountPad.tsx:156`
(the same backspace drawn twice: add one `backspace` glyph), `components/passcode/Keypad.tsx:136`,
`components/passcode/PasskeyUnlockKey.tsx`. Keep as artwork (not icons): `QrCode.tsx`,
`ShareCardFrame.tsx`, `StoreBadges.tsx`, `PassportBook.tsx`, `MoneyCurve.tsx`,
`TierBadge.tsx`, `OwnershipSeenMark.tsx`, `StatusTrack.tsx`, `Composer.tsx` ring.
Icon weight: per the 7 November ruling the bold chrome in
`components/app/MobileTabBar.tsx:510`, `components/app/DockMore.tsx:157` and
`app/css/symbols.css:27` stays. `components/calls/views.tsx:110` sets
`weight="bold"` on content buttons inside a call: check it is chrome, else drop it.

### SW9. Raw text sizes to the type scale (P2, S, CSS)

17 sites outside the styleguide: `app/(app)/listing/[id]/ReservePanel.tsx:384`
(1.5rem), `components/app/listing/ListingReviews.tsx:90` (1.75rem),
`app/(app)/support/new/NewQueryForm.tsx:413` (1.0625rem), `app/(auth)/error.tsx:45,55`,
`app/(site)/error.tsx:38`, `components/auth/Verifying.tsx:169`,
`components/auth/EmailTakenNotice.tsx:83`, `components/auth/fields.tsx:39,47,79,88`,
`components/app/PhoneField.tsx:198,286` (em-relative flag sizes, acceptable),
`components/messages/VerifiedAvatar.tsx:64,65,66`. Map each to `nf-h3`,
`nf-body`, `nf-body-sm`, `nf-caption` or `--nf-text-*`. Also `app/css/grade1.css`
itself writes raw rem sizes (`.nf-pc-offer__title` 0.9375rem and others): move those
to tokens so the Grade 1 sheet is the example, not an exception.

### SW10. Off-scale radii (P2, S, CSS)

UX_SYSTEM section 3 allows 28, 22, 18, 14, the 10/12/14 button set and circles.
Containers using 6px (`--nf-radius-xs`): `components/app/listing/ListingGallery.tsx`
(2), `components/app/listing/PhotoViewer.tsx`, `components/app/listing/ListingPhotoGrid.tsx`,
`components/app/search/MapCanvas.tsx`, `components/app/listing/ListingActions.tsx`.
Containers using 10px (`--nf-radius-sm`, a button radius): `app/(app)/listing/[id]/ReserveTable.tsx` (3),
`app/(app)/support/messages/[id]/ThreadView.tsx` (2), `components/support/PhotoField.tsx`,
`components/app/tenancy/TenancyReportCard.tsx`, `components/app/reservations/DepositPageBody.tsx`,
`components/app/listing/ProofStrip.tsx`, `components/app/assistant/AssistantSidebar.tsx`,
`app/(site)/docs/DocsSidebar.tsx`. `components/verification/SelfieCapture.tsx` uses
`rounded-[50%]` (use the circle token). The `rounded-[var(--nf-...)]` arbitrary
spelling (about 60 sites, list from `rg "rounded-\[var" apps/web/src`) should become
the named utilities so `scripts/check-css-tokens.mjs` can police them.

### SW11. Hard-coded English into the dictionary (P1, L, copy)

Rule 7 of the handoff keeps new copy English, but these strings bypass
`@vallo/i18n` and so can never be translated or reviewed in one place. Worst files
(count of literal sentences): `components/app/agreements/AgreementControls.tsx` (16),
`app/(app)/settings/ai-assistant/AssistantControls.tsx` (15),
`app/(app)/around/new/ProposeAreaForm.tsx` (10), `app/(app)/settings/ai-assistant/consent/ConsentForm.tsx` (10),
`components/app/account/SupportChat.tsx` (10), `components/app/assistant/AssistantSettingsSheet.tsx` (8),
`components/app/reservations/TableSeatingPanel.tsx` (8), `components/social/story/StoryComposer.tsx` (8),
`components/app/listing/VerifiedAgentBadge.tsx`, `components/app/search/MapCanvas.tsx`,
`components/social/profile/ProfileEditor.tsx`, `components/social/profile/ProfileMenu.tsx`
(6 each), `app/(app)/profile/AccountBody.tsx`, `app/(app)/profile/SignedOutHero.tsx`,
`app/(app)/settings/ai-assistant/page.tsx`, `components/app/assistant/AssistantBlocks.tsx`,
`components/app/assistant/AssistantChat.tsx`, `components/app/inspections/ViewingSheets.tsx`,
`components/social/bloom/CreateBloom.tsx`, `components/social/story/StoryRail.tsx`,
`components/money/balance/SendScreen.tsx` (5 each), and 27 more files with 3 or 4.
Money is English by design today: `lib/money/copy.ts` (215 exports),
`lib/money/balance-copy.ts` (40), `app/(app)/wallet/WalletRoute.tsx` ("Sign in to
continue", "Sign in"), `app/(app)/receipts/page.tsx:62` ("See your payments").
Also `app/(app)/around/page.tsx:34` (`title: "Around"`), `lib/offline/page-cache.ts`
`agoWords` (hard `"en"` locale), `components/app/nav-model.ts:439` ("Pro").

### SW12. Loading skeletons of the right shape (P1, M, page)

Routes with no `loading.tsx` of their own (they show a parent's shape):
- Generic `(app)/loading.tsx` (header plus 3 rows): `calls/reviews`, `calls/reviews/[id]`, `checkout`, `compare`, `directory`, `inspections/gate/[id]`, `leaderboard`, `pay/deposit/[reservationId]`, `price`, `price/area/[id]`, `pro`, `pro/confirm`, `rewards`, `rewards/history`, `rewards/referrals`, `rewards/withdraw`.
- Wrong parent shape: `wallet/add`, `wallet/send`, `wallet/withdraw`, `wallet/settings` all get the balance card skeleton of `app/(app)/wallet/loading.tsx`; `profile/setup/owner`, `/agent`, `/[role]` get the chooser skeleton of `profile/setup/loading.tsx`; `settings/ai-assistant` and `/consent` get the settings hub skeleton; `messages/share/[kind]/[id]` gets the inbox skeleton; `(auth)/sign-up/phone` gets the sign-up doors skeleton.
- Own but misshaped: `app/(app)/u/[handle]/message/loading.tsx` draws `LoadingPeople` (a people list) for a compose screen.
- None at all: `welcome`, `offline` (correct, precached), `first-run/[feature]`.

### SW13. Duplicate routes and redirect-only pages (P1, M, route config)

Redirect-only `page.tsx` files that should be `next.config` redirects (then delete
the page and its `loading.tsx`): `app/(app)/around/manage/page.tsx` (to
`/around/settings`), `app/(app)/profile/setup/firm/page.tsx` (to `/profile/setup/agent`),
`app/(app)/settings/invite/referrals/page.tsx` and `.../[id]/page.tsx` (to
`/rewards/referrals`; each still ships a skeleton that can flash), `app/(auth)/sign-in/email/page.tsx`
(to `/sign-in`). Duplicate jobs, each needs one owner (decide, then redirect the other):

| Job | Routes or files | Recommendation |
|---|---|---|
| Agent registration | `/profile/setup/agent` (`AgentRegisterForm`) and `/profile/setup/professional` (`components/agent/ApplyWizard.tsx`) | One StepFrame flow; `AddWorkspaceChooser.href.ts:17` points to one |
| Assistant agreement | `/settings/ai-assistant`, `/settings/ai-assistant/consent`, `/settings/privacy/ai` | One page with the switch and one consent sheet |
| Support chat | `/support` and `/settings/help` (both mount `SupportChat`) | `/settings/help` becomes a row to `/support` |
| Help search | `app/(app)/support/SupportSearch.tsx`, `components/site/support/SupportSearch.tsx`, `app/(site)/help/HelpSearch.tsx` over `lib/support/help-articles.ts` and `lib/support/faq.ts` | One search component, one store |
| First message | `/messages/new` (`FirstMessage`), `/u/[handle]/message` (`DirectFirstMessage`), `components/stays/MessageVenue.tsx` | One composer sheet with a subject |
| Thread reader | `app/(app)/messages/[id]/ThreadView.tsx`, `app/(app)/support/messages/[id]/ThreadView.tsx`, `app/(app)/post/[id]/ThreadView.tsx` | Shared bubble and composer parts |
| Finding people | `/u` (`PeopleSearch`) and `/around/people` (`PeopleFinder`) | `/u` redirects to `/around/people` |
| Money history | `/payments`, `/receipts`, `/refunds`, `/payouts` beside `/wallet/transactions` | Tabs or filters inside Wallet |
| Withdraw | `/wallet/withdraw` and `/rewards/withdraw` | One withdraw flow with a "from" choice |
| Stay detail | `/stay/[id]` (`StayDetailView` for accommodation rows) and `/listing/[id]` for catalogue stays (`app/(app)/stay/[id]/page.tsx:204`) | One detail order (RECOMMENDATIONS PD2) |
| Phone confirm | `/sign-up/phone` (no longer in the sign-up path per the audit) and `/settings/phone` | Keep `/settings/phone`; redirect the other |
| Legal | `(app)/legal/{terms,privacy,disclaimer}` and `(site)/{terms,privacy,disclaimer}` | Intentional, same text from `lib/legal`; keep |

Dead links: a static scan of every `href`, `push`, `replace` and `redirect` string
literal against the route tree found none that miss (template paths such as
`/listing/${id}` resolve). Keep `scripts/check-deep-links` extended to web hrefs.

### SW14. Hand-rolled dialogs into `Sheet` or one viewer (P1, M, component)

Member side `role="dialog"` outside `Sheet`: `components/app/AppShell.tsx:256`
(the drawer, own scrim), `components/app/assistant/AssistantChat.tsx:1050` (history
drawer, aria-label "Conversation history" in English),
`app/(app)/settings/ai-assistant/AssistantControls.tsx:73` (alertdialog "Turn the
assistant off?"), `components/social/profile/ProfileMenu.tsx:257` (blocked card,
`aria-label={`You blocked ${who}`}`), `components/app/leaderboard/overlays.tsx:232`.
Full-screen viewers `components/app/listing/PhotoViewer.tsx:486` and
`components/app/messages/MediaViewer.tsx:415` are legitimate but are two viewers for
one job: merge. The guard list in `components/ui/hand-rolled-sheets.test.ts:17`
only catches scrim classes, so the last four slip past it; widen it to any
`role="dialog"` outside `Sheet.tsx`.

### SW15. Offline: the price stamp on kept copies (P1, M, component)

`components/ui/ConnectionLine.tsx` says a page is kept and how old it is, but no
detail page marks its PRICE or availability as possibly stale (UX_SYSTEM section 11,
RECOMMENDATIONS OFF1). Read `keptCopyKind()` from `lib/offline/page-cache.ts` and
show "Saved on your device. Price and availability may have changed." on the price
block and disable Book or Pay while kept: `components/app/listing/ListingStickyBar.tsx`,
`app/(app)/listing/[id]/ReservePanel.tsx`, `app/(app)/listing/[id]/RentalPanel.tsx`,
`app/(app)/stay/[id]/StayFoot.tsx`, `app/(app)/listing/[id]/ReserveTable.tsx`,
`app/(app)/saved/SavedBoard.tsx`, `components/app/offline/ShelfView.tsx`.

### SW16. Root tabs never show Back (P1, S, page)

A dock root should not carry a back control. `app/(app)/around/page.tsx:224` and
`app/(app)/search/page.tsx:573` draw the site `BackButton` (fallback `/`).
`app/(app)/stays/search/page.tsx` draws a `PageHeader` with back on a root tab.
Remove on roots; keep when the route was pushed from inside (check `lib/nav/resolve.ts`).

### SW17. Calm grounds behind reading content (P2, M, CSS)

`app/(site)/layout.tsx` paints `nf-aurora` and `nf-grid-veil` (`app/css/ambient.css`)
behind every public page, including legal text; `app/offline/OfflineScreen.tsx` uses
"two gradients". UX_SYSTEM section 2: no gradients behind reading content. Keep the
aurora on the landing hero only. `components/app/AppShell.tsx` adds `nf-soft-top`
(a wash) behind every in-app page: confirm it reads as canvas in both themes.

### SW18. Copy gates hold, two exceptions (P2, S, copy)

Em dashes: 0 in scope. Vague errors: one, `components/app/assistant/AssistantChat.tsx:461`
"Something went wrong. Send it again." (English, and vague): say what failed.
`lib/money/copy.ts` and the checkout copy (`app/(app)/checkout/[bookingId]/payment-copy.ts:116`)
already refuse "something went wrong", which is the model to copy.

---

## Page by page

Rows assume the sweeps above; each row names only what is specific to that route.
"SW1" means the route's actions are in the banner sweep list.

### Shell and navigation

| Route or file | Problem | Fix | P | Size | Layer |
|---|---|---|---|---|---|
| `components/app/AppShell.tsx:402` and `components/app/MobileTabBar.tsx:521` | Two triggers open one Create sheet: the header pencil and the dock's round "+" (`nf-dockcreate`, passed by `ShellDock.tsx:83`). The comment at 403 says the "+" is gone; it is not | Keep one (RECOMMENDATIONS N2); fix the comment | P1 | S | component |
| `components/app/AppShell.tsx:71` | Bell only on 5 paths (`/home`, `/stays`, `/search`, `/stays/search`, `/around`); Profile, a root, has none | Bell on every root (N3) | P1 | S | component |
| `components/app/MobileTabBar.tsx:124` | Messages lives inside the More tray, not on the dock | Founder decision on N1 (Messages as a tab); if yes, Feed or More moves | P1 | M | product decision |
| `components/app/AppShell.tsx:256` | Drawer is a hand-rolled dialog with its own scrim | SW14: build on `Sheet` side placement or the overlay hook | P1 | M | component |
| `components/app/MobileTabBar.tsx:308` | Comment "THE CENTRE ONE IS THE SWITCH"; the centre is `DockMore` | Correct the comment | P2 | S | copy |
| `components/app/nav-model.ts:28` | Comment "the same eleven"; signed in the drawer draws about 19 rows (4 discovery, 7 account, 3 money, price, up to 3 workspaces, 4 tail) | Regroup to about 12 (N4); fix the comment | P1 | M | component |
| `components/app/DockMore.tsx` | Repeats 9 drawer rows (Messages, Plans, Saved, Assistant, Agreements, Price, Settings, Support, Report a problem) | Trim to what the dock lacks | P2 | S | component |
| `components/app/NavTree.tsx` | Named a tree; its own header says it is no longer one | Rename to `NavList` | P2 | S | component |
| `app/side-nav.css` | 906 lines, much dead per the audit | Prune with a coverage pass | P2 | M | CSS |
| Agreements in nav | In the drawer (`nav-model.ts:207`), in More (`MobileTabBar.tsx:134`) and as the fourth tab when social is off (`MobileTabBar.tsx:66`) | One home | P2 | S | component |
| Role switching | `components/supply/ProfileSwitcher.tsx`, `components/roles/RoleSwitcher.tsx` (signed-out profile), `ModeSwitcher` (agent shell) | One switcher sheet; shared with Survey B | P1 | M | component |
| `components/ui/ToastHost.tsx` and `app/css/grade1.css` | Banner is "compact, max 24rem" in CSS; UX_SYSTEM 8.1 says "max 34rem wide" | Align the doc to the founder's 7 November "smaller" ruling | P2 | S | copy |

### Home and discovery

| Route or file | Problem | Fix | P | Size | Layer |
|---|---|---|---|---|---|
| `/home` (`components/app/home/HomeScreen.tsx`, `HomeHero.tsx`) | Hero title is an `h2` with no accent stop; Assistant proposals in `components/app/assistant/AssistantBlocks.tsx` report 21 states inline and in English | Hero title as the page `h1` with the accent stop (UX_SYSTEM 5); AssistantBlocks to SW1 and SW11 | P1 | S | page |
| `/stays` (`app/(app)/stays/page.tsx`) | Same hero; no `PageFrame` (correct); empty via `DiscoveryEmpty` uses 3D art | SW7 | P2 | S | page |
| `/around` (`app/(app)/around/page.tsx`) | Root tab with Back (224); title literal "Around" (34); feed notices inline (`components/social/feed/Feed.tsx:401,464`) | SW16, SW11, SW1 | P1 | S | page |
| `/around/[slug]` | `ModeratorApply.tsx` English and inline result | SW1, SW11 | P2 | S | page |
| `/around/new` | `ProposeAreaForm.tsx`: 10 English strings, success is an inline "Thank you. We have it." | StepFrame (SW5), banner then return | P1 | S | page |
| `/around/settings`, `/around/manage` | `manage` is a redirect page | SW13 | P2 | S | route config |
| `/around/people` and `/u` | Two people finders | SW13 | P1 | M | page |
| `/directory` (`components/app/directory/DirectoryScreen.tsx`) | Says "opens soon" until migration d76; no `loading.tsx`; no `PageHeader` at all | Confirm d76 with Survey B; give it `PageFrame` and a skeleton, or hide the link until live | P1 | S | page |
| `/leaderboard` (`components/app/leaderboard/LeaderboardScreen.tsx`) | Own header (185) with an English constant; hand-rolled dialog (`overlays.tsx:232`); inline svg in overlays; no `loading.tsx`; "opens soon" until d76 | `PageFrame`, SW14, SW8, SW12 | P1 | M | page |
| `/compare` | Large header, `State` empty, no `loading.tsx` | SW12 | P2 | S | page |
| `/price`, `/price/area/[id]` | No `loading.tsx`; area page PageHeader drawn twice for states | SW12, SW4 | P2 | S | page |
| `/s/[token]` (share door) | Four primaries across states in `app/s/[token]/DoorViews.tsx`; check one per state | Verify one primary per state | P2 | S | page |

### Search and map

| Route or file | Problem | Fix | P | Size | Layer |
|---|---|---|---|---|---|
| `/search` (`app/(app)/search/page.tsx`, 908 lines) | Root tab with Back (573); `components/app/search/MapCanvas.tsx` English ("Search this area", "Places on this map") and 6px radius; filter drawer `components/app/filters/FilterDrawerPanel.tsx` is a Sheet with no close and no sticky "Show N results" footer | SW16, SW11, SW10; filter footer with the live count (SRC2) | P1 | M | page |
| `/search` opening state | R3/R68: field, segmented verticals, Near me, suggested searches. `SearchForYou` and `RecentSearches` exist; check the segment is a sunken track with a raised active segment (UX_SYSTEM 9) | Visual pass | P1 | S | page |
| `/stays/search` | Root tab drawn with `PageHeader` and Back, unlike `/search`; `components/app/stays/StayFilterSheetPanel.tsx` (8 inputs) has no close | Same field-led top as `/search`; SW3 | P1 | M | page |
| Map tiles (`lib/maps/tiles.ts`) | CARTO non-commercial terms (audit 13) | Founder decision on a key | P1 | S | product decision |

### Listing and stay detail

| Route or file | Problem | Fix | P | Size | Layer |
|---|---|---|---|---|---|
| `/listing/[id]` (`page.tsx`, 1815 lines, 102 files) | Primaries in `ReservePanel.tsx:343,779`, `RentalPanel.tsx:144`, `ListingSummaryCard.tsx:51`, `ListingStickyBar.tsx:323`, `StillAvailable.tsx:49`, `page.tsx:718`: verify only one shows per viewport | One primary per viewport; summary card's action becomes secondary when the sticky bar shows | P1 | M | page |
| `/listing/[id]` gallery | `components/app/listing/ListingGallery.tsx` inline play svg (432, 456), 6px and 22px arbitrary radii; `PhotoViewer.tsx:486` hand-rolled viewer | SW8, SW10, SW14 | P2 | S | component |
| `/listing/[id]` type | `ReservePanel.tsx:384` `text-[1.5rem]`; `ListingReviews.tsx:90` `text-[1.75rem]` | SW9 (`nf-figure` or `nf-h2`) | P2 | S | CSS |
| `/listing/[id]` facts | No "Key facts" sheet with the price in words (R64) | Facts row opens a `Sheet` | P2 | M | component |
| `/listing/[id]` report and contact | `components/app/ReportSheetPanel.tsx` ends on an inline "Thank you, we have it"; `ListerCallButton.tsx` note inline | SW1 | P1 | S | component |
| `/listing/[id]` offline | Kept copy shows live-looking price and Book | SW15 | P1 | M | component |
| `/listing/[id]/trust` | Small header; has `error.tsx` | SW4 | P2 | S | page |
| `/listing/[id]/visit`, `/visit/[inspectionId]` | Own `VisitHeader` (`components/app/inspections/visit/VisitHeader.tsx`); planner notes inline (`VisitPlanner.tsx`, `VisitListerCard.tsx`, `VisitStatus.tsx`); planner sheet with no close | `PageFrame`, SW1, SW3 | P1 | M | page |
| `/stay/[id]` | Two templates: `StayDetailView.tsx` (accommodation) and the catalogue `ListingPage` (`page.tsx:204`); 107-file closure | One detail order (PD2); share hero, facts, host, calendar, foot | P1 | L | page |
| `/stay/[id]` booking | Dates and guests split across `StayDatesForm.tsx` and `ReservePanel`; no date-range sheet (ST1) | Date range and guests sheets | P1 | M | component |
| `/restaurant/[id]` | `ReserveTable.tsx` (useActionState) reports inline; 10px radii; `TableSeatingPanel.tsx` 8 English strings and 5 primaries in its states | Reserve in one sheet (RS1), banner on success, SW10, SW11 | P1 | M | page |
| `/restaurants` | Small header on a list page | `PageFrame`; SW7 on its empty | P2 | S | page |
| `/rent/move-in/[listingId]` | Header drawn twice for states | SW4 | P2 | S | page |

### Saved

| Route or file | Problem | Fix | P | Size | Layer |
|---|---|---|---|---|---|
| `/saved` (`SavedBoard.tsx`) | Remove turns the card into an in-slot Undo chip; no banner; fallback copy "Undo" literal (94) | Banner "Removed from Saved" with Undo action (FB3), keep the slot collapse | P1 | S | component |
| `/saved` collections (`Collections.tsx`) | Create, delete and add-to-list errors inline; Sheet has no close | SW1, SW3 | P1 | S | component |
| `/saved` offline | Kept shortlist shows prices as live | SW15 | P1 | S | component |
| `/saved/searches` (`components/app/saved-searches/SavedSearchBoard.tsx`, `SaveSearchControl.tsx`) | Alert toggle and save report inline; small header | SW1, SW4 | P1 | S | page |

### Messages and calls

| Route or file | Problem | Fix | P | Size | Layer |
|---|---|---|---|---|---|
| `/messages/[id]` (`ThreadView.tsx`, 1779 lines) | Private feedback note with its own 4s timer (`actionNote`, 495 to 531, 1770) for delete, forward and errors; Copy is silent (512) | SW1: banner.error with retry, "Message copied", "Forwarded to {name}" | P0 | S | component |
| `/messages/[id]` read ticks | Inline svg (374) | SW8 | P2 | S | component |
| `/messages/[id]` composer | No voice note, no reactions, no delivered state (audit 9; backend is Survey B) | MSG1 to MSG4 | P1 | L | component |
| `/messages/[id]` options | `ThreadOptionsSheet.tsx` without close; `MediaViewer.tsx:415` own dialog | SW3, SW14 | P2 | S | component |
| `/messages` (`Inbox.tsx`) | Archive confirmation inline (610); mark read silent | Banner "Chat archived" with Undo | P1 | S | component |
| `/messages/new`, `/u/[handle]/message`, venue messages | Three composers | SW13; the `u/[handle]/message` skeleton is a people list (SW12) | P1 | M | page |
| `/messages/share/[kind]/[id]` | Header drawn 4 times for states; `SharePicker.tsx` inline error; inbox skeleton | SW4, SW1, SW12 | P2 | S | page |
| `/calls/reviews`, `/calls/reviews/[id]` | Generic skeleton; small header; `components/calls/views.tsx:110` `weight="bold"` on in-call buttons | SW12, SW4; confirm the bold is chrome | P2 | S | page |

### Bookings, plans, checkout and payments

| Route or file | Problem | Fix | P | Size | Layer |
|---|---|---|---|---|---|
| `/bookings` (Plans, 42-file closure) | Large header is right; inline notes in `components/app/plans/InspectionsBoard.tsx:137`, `components/app/inspections/GateHandshake.tsx`, `TruthQuestions.tsx`, `components/app/safety/UnsafeSheet.tsx`; no "Today" card (BK4) | SW1; Today card | P1 | M | page |
| `/bookings/[bookingId]` | Cancel reports only failure (`CancelBookingSheet.tsx:102`); no refund preview before cancel (BK3); no Add to calendar for stays (only viewings build an `.ics`: `lib/viewings/day-kit.ts`) | Banner "Booking cancelled", refund line in the sheet, calendar file | P1 | M | page |
| `/bookings/[bookingId]/review` | `ReviewForm.tsx` result inline (203 to 238) | Banner "Review posted" and return to the booking | P1 | S | page |
| `/checkout` | Index redirects when no stay; `RoomRequestForm.tsx` inline error | SW1 | P2 | S | page |
| `/checkout/[bookingId]` (36 files) | Two progress marks (`SegmentedProgress` in `page.tsx`, `PaymentSteps` in `PaystackCheckout.tsx` and `PaymentStage.tsx`); `CryptoPayOption.tsx` three Sheets without close, 22px and 14px arbitrary radii | One progress mark (SW5); SW3; SW10 | P1 | M | page |
| `/pay/deposit/[reservationId]` | Generic skeleton; `DepositPageBody.tsx` 10px radius | SW12, SW10 | P2 | S | page |
| `/pay/crypto/[reference]` | Fine; small header | SW4 | P2 | S | page |
| `/rent/pay/[inspectionId]` | Fine (honest copy, own skeleton); small header | SW4 | P2 | S | page |
| `/rent/review/[paymentId]` | `TenancyReviewForm.tsx:114` done inline | SW1 | P1 | S | page |
| `/rent/share/[id]` | 6 inputs on one page | Check for a sheet | P2 | S | page |
| `/agreements`, `/agreements/[id]` | `components/app/agreements/AgreementControls.tsx`: 16 English strings, confirm, amend, cancel and claim report inline; `DrawUpAgreement.tsx` is a long inline form | SW1, SW11, SW5 | P1 | M | page |
| `/agreements/[id]/fund`, `/held` | `FundControl.tsx`, `ReleaseControl.tsx`, `SwitchToCard.tsx` inline; `components/money/fund/FundScreen.tsx` English | SW1, SW11 | P1 | S | page |
| `/tenancy/[id]` (18 files, 28 inputs) | Caution return (`CautionControls.tsx`, 15 fields), flatmates (`FlatmateControls.tsx`, 6), renewal (`RenewalControls.tsx`, 4) are inline forms on one page; `ReceiptCodePanel.tsx` "copied" inline | Each becomes a Sheet or StepFrame; SW1 | P1 | L | page |
| `/tenancy/[id]/complaint` | `PackControls.tsx` inline | SW1 | P2 | S | page |
| `/inspections/gate/[id]` | `GateHandshake.tsx` notes inline; generic skeleton | SW1, SW12 | P2 | S | page |
| `/record/[code]` | Fine (honest states) | SW4 only | P2 | S | page |
| `/payments`, `/receipts`, `/refunds`, `/payouts` | Four history pages beside Wallet; titles from `lib/money/copy.ts` (English); `receipts/page.tsx:62` literal | SW13 into Wallet; SW11 | P1 | M | page |

### Wallet and money

| Route or file | Problem | Fix | P | Size | Layer |
|---|---|---|---|---|---|
| `/wallet` and `/wallet/{add,send,withdraw,settings,transactions}` | Own top (`WalletChrome.tsx:46`), not `PageHeader`; all sub-routes share the balance skeleton; whole surface English (`lib/money/balance-copy.ts`, `WalletRoute.tsx`) | `PageFrame` with the gear as an action and Overview/Transactions as its tab row; own skeletons; SW11 | P1 | L | page |
| `/wallet/send`, `/withdraw`, `/add` | Private step machines (`SendScreen.tsx:34`), errors in `nf-mw-error`, Sheets without close; success shown only on the screen | StepFrame (SW5), banner on send or withdraw plus the record | P1 | L | component |
| `/rewards`, `/rewards/history`, `/rewards/referrals`, `/rewards/withdraw` | No `loading.tsx` on any; a second withdraw flow (`WithdrawFlow.tsx`, `RewardsPayoutForm.tsx`) | SW12; SW13 (one withdraw) | P1 | M | page |
| `/settings/invite`, `/how-it-works` | `InviteLinkCard.tsx` "copied" inline; R69 honest "no campaign" card | Banner "Link copied"; honest card | P1 | S | page |
| `/settings/payments` | Only `layout="stacked"` header; `PaymentMethodsPanel.tsx` status inline; `AddBankAccountSheet.tsx` no close | `PageFrame`, SW1, SW3 | P1 | S | page |
| `/pro`, `/pro/confirm` | Redirect to `/home` while `SUBSCRIPTIONS_OPEN = false` (`lib/subscriptions/open.ts:12`); sheets without close | Parked; sweep when opened | P2 | S | page |

### Profile and settings

| Route or file | Problem | Fix | P | Size | Layer |
|---|---|---|---|---|---|
| `/profile` (`AccountHero.tsx`, `AccountBody.tsx`) | No "Complete your profile" checklist (R10, R49); name edit reports inline (448) in a Sheet without close; `SignedOutHero.tsx` English and two primaries; `ProfileIdentityCard.tsx` English | Checklist card (photo, phone, ID, passcode); SW1, SW3, SW11 | P1 | M | page |
| `/profile/application` | Fine (`StatusTrack`); small header | SW4 | P2 | S | page |
| `/profile/setup` | `AddWorkspaceChooser.tsx` is a hand-made card list under a site `BackButton` | `PageFrame` plus `OptionCards` (SW6) | P1 | S | page |
| `/profile/setup/owner`, `/agent` | `RegisterShell.tsx` private stepper, title at row size; chooser skeleton | StepFrame (SW5), SW12 | P1 | L | page |
| `/profile/setup/[role]` (professional) | `components/agent/ApplyWizard.tsx` (898 lines) duplicates `/agent` | SW13 decision, then StepFrame | P1 | L | product decision |
| `/profile/setup/firm` | Redirect page | SW13 | P2 | S | route config |
| `/u/[handle]` | `ProfileMenu.tsx` and `ProfileShare.tsx` and `BadgeMoment.tsx` use the old `useToast`; blocked card is a hand-rolled dialog (257) with English | SW2, SW14, SW11; "Reasons to trust" (R50) from real facts | P1 | M | page |
| `/u/[handle]/edit` | `ProfileEditor.tsx` saved note inline; `ProfilePhotos.tsx` 3 English success notes | SW1, SW11; calm edit list (R51 to R53) | P1 | M | page |
| `/u/[handle]/followers`, `/following` | `FollowListPage.tsx` own header, English errors | `PageFrame`, SW11 | P2 | S | page |
| `/u` | Duplicate of `/around/people` | SW13 | P1 | S | route config |
| `/settings` (`SettingsHub.tsx`) | Large header correct; English section names ("VALLO AI Assistant", "Privacy and security") | SW11 | P2 | S | copy |
| `/settings/account` | Small header; Sheet wrapper from `rows.tsx` | SW4, SW3 | P2 | S | page |
| `/settings/notifications` | `NotificationMatrix.tsx:332` note inline | SW1 | P1 | S | page |
| `/settings/ai-assistant`, `/consent`, `/settings/privacy/ai` | Three pages; `AssistantControls.tsx` alertdialog (73) and 15 English strings; `ConsentForm.tsx` 10 English strings | SW13, SW14, SW11 | P1 | M | page |
| `/settings/devices`, `/devices/alert` | `DeviceList.tsx` outcome inline ("signed out") | Banner "Signed out of N devices" | P1 | S | page |
| `/settings/help` | Mounts `SupportChat` again | SW13 | P1 | S | page |
| `/settings/interests` | `InterestChoices.tsx` saved inline; nine cards hand-made | SW1, tile grid or OptionCards (SW6) | P1 | S | page |
| `/settings/passcode` | `PasscodeSettings.tsx` done inline; keypad inline svg | Banner "Passcode set" via `SuccessFlagHost`; SW8 | P1 | S | page |
| `/settings/passport` | Inline states | SW1 | P2 | S | page |
| `/settings/phone` | `PhoneConfirmForm.tsx` inline tick svg (167) and done inline | SW8, SW1 | P1 | S | page |
| `/settings/place` | `PlaceForm.tsx` saved inline; `ChoicePicker.tsx` sheet without close | SW1, SW3 | P1 | S | page |
| `/settings/privacy`, `/blocked`, `/data`, `/money-lock` | Unblock and money lock report inline (`BlockedList.tsx`, `MoneyLockGroup.tsx`) | SW1 | P1 | S | page |
| `/settings/accessibility`, `/appearance`, `/region` | Device-local switches with no confirmation | Banner only where a server write happens; fine otherwise | P2 | S | page |
| `/settings/invite/referrals`, `/referrals/[id]` | Redirect pages with skeletons | SW13 | P2 | S | route config |
| `/verification` | The only Grade 1 reference flow; still draws `VerificationPath` svg above it; `KycFlow.tsx:243` sent inline | Use it as the model; drop the extra path; banner on submit | P2 | S | page |
| `/passport/[who]` | Header drawn 3 times for states; inline svg in `PassportBook.tsx` is art | SW4 | P2 | S | page |
| `/notifications`, `/notifications/[id]` | Large header right; Mark all read silent (`LiveNotifications.tsx:154`); rows not actionable (FB5) | Banner "All caught up"; row actions | P1 | S | page |

### Feed and social

| Route or file | Problem | Fix | P | Size | Layer |
|---|---|---|---|---|---|
| Feed (`components/social/feed/Feed.tsx`, `Composer.tsx`) | Composer already uses the banner (good); Feed and comments use inline `notice` with English ("There is nobody to do that to on this post.") | SW1, SW11 | P1 | S | component |
| `/post/[id]` (`ThreadView.tsx`) | Inline notices (205, 261); third thread reader | SW1, SW13 | P1 | S | page |
| `/stories/[id]` (`components/social/story/StoryViewer.tsx`) | Old `useToast`; story viewer flow | SW2 | P0 | S | component |
| `/stories/new` (`StoryComposer.tsx`) | 8 English strings; long inline form | SW11, SW5 | P1 | M | page |
| Badges (`components/social/badges/BadgeMoment.tsx`, `BadgeRow.tsx`) | Old `useToast`; sheets without close | SW2, SW3 | P1 | S | component |
| `components/social/bloom/CreateBloom.tsx` | Audience sheet English, no close | SW11, SW3 | P2 | S | component |

### Support and help

| Route or file | Problem | Fix | P | Size | Layer |
|---|---|---|---|---|---|
| `/support` (`app/(app)/support/page.tsx`) | Site `BackButton` plus `SupportHero.tsx` with an arbitrary 22px radius, not a page frame | `PageFrame`; SW10 | P1 | S | page |
| `/support/new` (`NewQueryForm.tsx`, 432 lines) | Long form; raw `text-[1.0625rem]` (413); 3 arbitrary radii; 2 Sheets without close; kind choice hand-made | StepFrame (SW5), OptionCards (SW6), banner then ticket page | P1 | M | page |
| `/support/messages`, `/support/messages/[id]` | `ReplyBox.tsx:79` "sent" inline; `TicketActions.tsx` inline; 10px radii in its `ThreadView.tsx` | SW1, SW10, SW13 | P1 | S | page |
| `/assistant` (`components/app/assistant/AssistantChat.tsx`, 1173 lines) | Hand-rolled history drawer (1050); English and vague error (461); not pinned in the inbox (MSG5, decided) | SW14, SW18, pin in inbox | P1 | M | page |
| Help search | Three components over two stores | SW13 | P1 | M | component |

### Auth and onboarding

| Route or file | Problem | Fix | P | Size | Layer |
|---|---|---|---|---|---|
| `(auth)` forms (`components/auth/fields.tsx`) | Raw sizes (39, 47, 79, 88); section rule as a grey hairline (`border-[var(--nf-panel-hair)]`, 37) | SW9; space instead of a line (UX_SYSTEM 4) | P2 | S | CSS |
| `components/auth/Verifying.tsx:169`, `EmailTakenNotice.tsx:83`, `app/(auth)/error.tsx:45,55` | Raw sizes | SW9 | P2 | S | CSS |
| `components/auth/slate.tsx` | `AuthPillButton` and `AuthPillLink` names contradict the shape law (the shape itself is the button system's rectangle) | Rename to `AuthButton` | P2 | S | component |
| `/sign-in/email` | Redirect page | SW13 | P2 | S | route config |
| `/sign-up/phone` | Off the sign-up path since this session (audit 0), still live, duplicates `/settings/phone` | Redirect to `/settings/phone` | P2 | S | route config |
| `/sign-up/email` (`EmailAuthForm.tsx`) | Six inputs on one screen | Keep for now; consider email first, then the rest | P2 | M | page |
| `/sign-up/finish` (`FinishSetupForm.tsx`) | Terms and 18+ for Apple or Google as a full page | R4 pattern: banner "Signed in", then a "Confirm your details" Sheet with name prefilled | P1 | M | page |
| First-run asks (`components/app/welcome/ArrivalAsks.tsx`) | R5 photo sheet and R9 notify pre-prompt polish | Sheet anatomy (SW3) with "you choose next" line and a banner after Yes | P1 | M | component |
| `/welcome` (`components/app/welcome/FirstRun.tsx`) | Four slides; one primary per slide (fine); no skeleton (fine) | Check against R6 (eyebrow, huge title with accent stop, sticky foot) | P2 | S | page |
| `/first-run/[feature]` | Fine | None | P2 | S | page |
| `/offline` (`OfflineScreen.tsx`) | Ground is two gradients | SW17 | P2 | S | CSS |
| Account moments | `SuccessFlagHost` already drives them | Confirm each moment named in UX_SYSTEM 8.1 fires (signed in, account created, email confirmed, password changed, passcode set) | P1 | S | component |

### Public site and legal

| Route or file | Problem | Fix | P | Size | Layer |
|---|---|---|---|---|---|
| `app/(site)/layout.tsx` | Aurora and grid veil behind all reading pages | SW17 | P2 | M | CSS |
| `/terms`, `/privacy`, `/disclaimer`, `/eula`, `/host-agreement`, `/cancellations`, `/standards`, `/delete-account` | `DocumentSheet` is good; no "In short" callout per section (R66); `lib/legal/*.tsx` has none | Add a summary per section in `lib/legal` and render it in `DocumentSheet` | P2 | M | copy |
| `/ai/permissions`, `/ai/privacy`, `/ai/security`, `/ai/terms` | Four thin `AiLegalPage` pages | Fine; link from the one assistant page (SW13) | P2 | S | page |
| `/help`, `/guides`, `/guides/[slug]`, `/docs`, `/docs/[slug]` | Three help surfaces; no article anatomy (R15, R16: tip callout, Before you start, numbered steps, screenshots) | One Help Centre after the screens are final (audit 15.8) | P1 | L | page |
| `/contact`, `/check`, `/r`, `/delete-account` (restore), `/landlord/[token]`, `/safe/[token]` | Form results inline via `useActionState`; `ReplyActions.tsx`, `RestoreForm.tsx`, `SafetySharePanel.tsx` use `rounded-[var(--nf-container-radius)]` | SW1, SW10 | P2 | S | page |
| `/styleguide` | Public route (noindex in `app/robots.ts:98`) with 14 raw text sizes | Move to `(dev)` | P2 | S | route config |
| `/for-agents`, `/for-hosts`, `/for-landlords` | Shared `SupplyPage`; fine | None | P2 | S | page |
| `/about`, `/careers`, `/safety`, `/move-in-cost`, `/areas/[state]/[area]`, `/r/[code]` | Fine structurally (`SiteHead`) | Calm-ground pass only | P2 | S | page |
| `(landing)` | Primaries in `SiteHeader.tsx` (2), `Hero.tsx`, `MobileMenu.tsx`; check only one is lit above the fold | One lit primary | P2 | S | page |

---

## Top 25 for the member side (ranked)

1. **SW1 banner sweep, wave 1 (P0)**: messages (`ThreadView.tsx` private note, Copy, forward), saved, bookings cancel and review, settings saves, profile edit. Start with the files that have an existing timer or "sent" note.
2. **SW2 retire `useToast` (P0)**: 4 social files, then delete the legacy toast.
3. **`ThreadView.tsx` feedback (P0)**: delete, forward, copy and send failures to the banner with retry.
4. **SW3 sheet anatomy (P1)**: default `closeLabel` in `Sheet.tsx`, then descriptions and sticky footers on the 67 sheets.
5. **SW5 registrations on StepFrame (P1)**: `RegisterShell` owner and agent, and decide professional versus agent (SW13).
6. **SW4 PageFrame sweep (P1)**: the ~75 small-header pages, settings first (most uniform), then money and bookings.
7. **Wallet onto the shared pieces (P1)**: `PageFrame` top, StepFrame send and withdraw, own skeletons, banner on outcome.
8. **SW7 empty states to the thin glyph (P1)**: one default change in `components/ui/State.tsx`.
9. **SW15 kept-copy price stamp (P1)**: listing, stay and restaurant feet; Book disabled while kept.
10. **One stay detail order (P1)**: merge `StayDetailView` and the catalogue listing face (PD2).
11. **Create entry and bell (P1)**: one Create trigger; bell on every root (N2, N3).
12. **SW13 duplicates, batch A (P1)**: assistant agreement (3 to 1), support chat (2 to 1), help search (3 to 1).
13. **SW13 duplicates, batch B (P1)**: money history into Wallet, one withdraw, people finder.
14. **Tenancy page forms into sheets (P1)**: caution return, flatmates, renewal.
15. **Checkout progress (P1)**: one progress mark, crypto sheets with close.
16. **Profile hub (P1)**: "Complete your profile" checklist, honest Refer card, edit list (R10, R49 to R53).
17. **SW14 hand-rolled dialogs (P1)**: drawer, assistant history, AI off confirm, blocked card, leaderboard; merge the two viewers; widen the guard test.
18. **SW16 no Back on root tabs (P1)**: `/around`, `/search`, `/stays/search`.
19. **SW12 skeleton shapes (P1)**: wallet sub-routes, registrations, rewards, `u/[handle]/message`.
20. **Sign-in completion sheets (P1)**: R4 confirm details, R5 photo, R9 notify polish.
21. **Support new as a StepFrame (P1)**: kind as OptionCards, then details, then photo.
22. **SW11 copy into the dictionary (P1)**: agreements, assistant, money first (most strings, most exposure).
23. **Search filters (P1)**: sheet with close and a live-count footer on both search screens.
24. **SW6 OptionCards (P1)**: workspace chooser, interests, pay choice, report reasons.
25. **Visual debt cleanup (P2)**: SW8 inline icons, SW9 raw sizes, SW10 radii, SW17 calm grounds, redirect pages into `next.config`.
