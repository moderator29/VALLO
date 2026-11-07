# BANNER MOMENTS: every outcome through the one top banner

Agent BANNER, 7 November 2026. The founder's ruling of 7 November ("THE
BANNER EVERYWHERE", FOUNDER_DECISIONS.md): the compact top banner
(`lib/ui/toast.ts`, `components/ui/ToastHost.tsx`) carries every outcome on
every page, member, agent, host and admin. No outcome or error is written as
text beside a control or under a form. A field with a problem keeps only its
red edge (`aria-invalid`) and a visually hidden screen-reader note
(`aria-describedby`), with the words in the banner.

Round 1 (`git log --grep "Round 1"`, the SW1 and X-02 sweeps) moved about 230
action outcomes; it deliberately left FIELD errors under their fields. This
list is what remained on 7 November, plus the silent successes and arrival
moments that never had a word.

## How it is built (the patterns, use only these)

| Case | Pattern |
|---|---|
| Action outcome in a handler | `banner.success(words)`, `banner.error(result.error, { retry })` from `@/lib/ui/toast` |
| `useActionState` desk | `useActionBanner(state, { ok, retry })` (`components/ui/use-action-banner.ts`) |
| Outcome carried in the URL after a redirect | `<BannerOnArrival message tone />` (`components/ui/BannerOnArrival.tsx`) |
| Account moment (signed in, welcome, email confirmed, password changed, passcode) | `rememberSuccess(flag)` on the server or `showSuccess(flag)` on the client (`lib/ui/success-moments.ts`, `SuccessFlagHost`) |
| A field with a problem | `aria-invalid` on the control (red edge), the words in a visually hidden note named by `aria-describedby`, and the banner says them: `<FieldProblem id message />` (`components/ui/FieldProblem.tsx`, new, built on `banner`; several problems at once say the first in reading order). `Field` (components/ui/Field.tsx) does this itself for every form that uses it. |
| Copy in place (button turns to "Copied") | the button's tick stays (it is the control's own state) and `useCopyFlash` also says it in the banner |

Tone: success (tick), info, warning, error. Retry: "Try again" where a second
tap is safe (idempotent, or the server refuses a duplicate). Undo: only where
an undo exists in the code.

Owner is BANNER for every row unless named. Messages files
(`app/(app)/messages/**`, `components/app/messages/**`) are kept by the lead;
BANNER changes only how the outcome is said there.

Status: `todo`, `done` (with the batch), `kept` (with the reason), `skipped`
(with the reason).

## A. Shared components (one change covers many screens)

| # | File:line | Moment | Today | Banner words | Tone | Retry/Undo | Status |
|---|---|---|---|---|---|---|---|
| A1 | components/ui/Field.tsx:150 | Any field refused (every form on `Field`, `TextInput`, `TextArea`, `Select`) | red caption under the field, `role="alert"` | the field's own message | error | none (fix the field) | todo |
| A2 | components/auth/fields.tsx:88 | Auth field refused (email, password, name) | red caption, `role="alert"` | the field's own message | error | none | todo |
| A3 | components/auth/slate.tsx:213 | Slate field refused (welcome slates) | red caption, `role="alert"` | the field's own message | error | none | todo |
| A4 | components/auth/CodeInput.tsx:114 | Code boxes refused (wrong or short code) | red caption, `role="alert"` | the code's own message | error | none | todo |
| A5 | app/css/controls.css:266 | The red edge itself in dark mode | `border-color` only, hidden by the gradient border (Field.tsx explains) | n/a: the edge must show now that the words leave | n/a | n/a | todo |
| A6 | lib/ui/use-copy.ts:52 (`useCopyFlash`) | Link, code, invite copied from an in-place copy button (InviteShare, ListingCode, SuccessSheet, TableSeatingPanel, CryptoPaymentStatus, InviteTicket) | button label turns "Copied", nothing at the top | "Link copied" / "Code copied" / "Copied" | success | none | todo |
| A7 | app/admin/_components/MoneyDecisions.tsx:30 (`Refusal`) | Fee rate refused, KYC document decision refused | red line under the form | the server's sentence | error | Try again | todo |
| A8 | components/app/confirm/ConfirmPanel.tsx:190 | Any confirm sheet's action refused (cancel, remove, close) | red line inside the sheet | the error passed in | error | per caller | todo |
| A9 | components/ui/StepFrame.tsx:212 | Step frame notice | notice slot under the step | the step's notice (callers decide) | per caller | none | todo (audit callers) |
| A10 | components/ui/AIResponse.tsx:139 | Assistant answer failed | red line in the answer block | "That answer did not come through. Try again." | error | Try again | kept (the answer block is the content; assistant is another owner) |

## B. Account and arrival moments

| # | File:line | Moment | Today | Banner words | Tone | Retry/Undo | Status |
|---|---|---|---|---|---|---|---|
| B1 | lib/auth/email-code.ts:84 | Returning sign-in with an email code | no word (only a first sign-in earns "Welcome to Vallo") | "Signed in. Welcome back." (`signed-in`) | success | none | todo |
| B2 | lib/auth/phone-sign-in.ts:71 | Returning sign-in with a phone code | no word | "Signed in. Welcome back." | success | none | todo |
| B3 | components/auth/PasskeySignIn.tsx:65 | Signed in with a passkey or Face ID | no word | "Signed in. Welcome back." (`showSuccess("signed-in")`) | success | none | todo |
| B4 | lib/auth/actions.ts:947 (`completeEmailVerification`) | Returning Google or Apple sign-in, magic link sign-in | no word (link types `email`, OAuth carry none) | "Signed in. Welcome back." when the account is not new | success | none | todo |
| B5 | components/auth/AuthChoices.tsx:80 | Arrival notice on sign in (`?notice=link-expired`, signed out, etc.) | status line on the page | the notice's own sentence | info or warning | none | todo |
| B6 | components/auth/EmailAuthForm.tsx:217 | Arrival notice on the email form | status line | the notice's own sentence | info | none | todo |
| B7 | components/auth/ForgotPasswordForm.tsx:41 | Reset code sent | status paragraph replacing the form | "Check your email for a reset code" (the form's own words) | success | none | todo (the "check your inbox" panel stays as the page's next step) |
| B8 | components/auth/VerifyCodeForm.tsx:270 | New code sent (resend) | status line under the button | the resend message | success | none | todo |
| B9 | components/auth/EmailAuthForm.tsx:427 | Sign in or sign up refused (wrong password, limit) | red alert above the button | the server's sentence | error | none | todo |
| B10 | components/auth/VerifyCodeForm.tsx:242 | Sign-up code refused | red alert | the server's sentence | error | none | todo |
| B11 | components/auth/ResetCodeForm.tsx:103 | Reset code refused | red alert | the server's sentence | error | none | todo |
| B12 | components/auth/ResetPasswordForm.tsx:91 | New password refused | red alert | the server's sentence | error | none | todo |
| B13 | components/auth/ForgotPasswordForm.tsx:69 | Reset request refused | red alert | the server's sentence | error | none | todo |
| B14 | components/auth/FinishSetupForm.tsx:131 | Finish setup refused | red alert | the server's sentence | error | none | todo |
| B15 | components/auth/CodeSignInForm.tsx:133 | Code sign-in: sending refused | red notice | the refusal | error | none | todo |
| B16 | components/auth/CodeSignInForm.tsx:160 | Code sign-in: verify refused (limit, failed) | red notice | the refusal | error | none | todo |
| B17 | components/auth/PasskeySignIn.tsx:75 | Passkey sign-in failed | notice under the button | "That did not sign you in. Try again or use your password." (its own words) | error | Try again | todo |
| B18 | components/auth/NativeAppleSignIn.tsx:151 | Sign in with Apple failed | notice under the button | its own message | error | Try again | todo |
| B19 | components/auth/AcceptTerms.tsx:93 | Age not confirmed | red line under the box | its own words | error | none | todo (field: red edge + sr note) |
| B20 | components/auth/AcceptTerms.tsx:160 | Terms not accepted | red line under the box | its own words | error | none | todo (field) |
| B21 | components/auth/EmailTakenNotice.tsx:81 | Email already has an account | status panel with a sign-in link | kept: it carries the next step's link | info | n/a | kept (guidance with a link, not an outcome line) |
| B22 | app/(site)/delete-account/RestoreForm.tsx:57 | Account restore code refused | red alert under the form | the refusal | error | none | todo |
| B23 | app/(site)/delete-account/RestoreForm.tsx:24 | Account restored | record panel replaces the form | "Your account is restored" | success | none | todo (panel kept as the page's record, banner added) |

## C. Member side (app/(app), components/app, social, money, verification)

| # | File:line | Moment | Today | Banner words | Tone | Retry/Undo | Status |
|---|---|---|---|---|---|---|---|
| C1 | app/(app)/settings/MoneyLockGroup.tsx:335 | Money lock enrolment refused | red line in the enrol card | the refusal | error | none | todo |
| C2 | app/(app)/settings/DeleteAccountPanel.tsx:487 | Delete confirmation word wrong | red caption under the field | its words | error | none | todo (field) |
| C3 | app/(app)/settings/DeleteAccountPanel.tsx:527 | Delete request refused | red alert in the sheet | the refusal | error | Try again | todo |
| C4 | app/(app)/settings/privacy/PendingAddressMove.tsx:39 | Address move pending (warning card) | warning card with Cancel | kept: the page's own record of a pending change | warning | n/a | kept |
| C5 | app/(app)/settings/phone/PhoneConfirmForm.tsx:233 | Phone code send or verify refused | red line under the form | the refusal | error | Try again (send) | todo |
| C6 | app/(app)/settings/phone/PhoneConfirmForm.tsx:164 | Phone number confirmed | record face replaces the form | "Your phone number is confirmed" | success | none | todo (face kept, banner added) |
| C7 | app/(app)/settings/devices/DeviceList.tsx:204 | Device list read failed | panel | kept: a page state, not an action outcome | error | n/a | kept |
| C8 | app/(app)/settings/devices/NotMePanel.tsx:111 | "This was not me": account held, or failed | outcome sheet | the sheet stays (it explains next steps); a banner says "Your account is secured" or the failure | success / error | Try again on failure | todo |
| C9 | app/(app)/settings/privacy/blocked/BlockedList.tsx:98 | Member unblocked | status line under the row | "{name} is unblocked" | success | none | todo |
| C10 | app/(app)/rent/review/[paymentId]/TenancyReviewForm.tsx:193 | Review incomplete | red line under the form | "Answer every question to send your review" | error | none | todo |
| C11 | app/(app)/rent/review/[paymentId]/TenancyReviewForm.tsx:61 | Tenancy review sent | thank-you panel replaces the form | "Your review is sent" | success | none | todo (panel kept as record, banner added) |
| C12 | app/(app)/support/messages/[id]/TicketActions.tsx:162 | Rating needs stars | red caption | "Choose how many stars first" | error | none | todo |
| C13 | app/(app)/support/messages/[id]/TicketActions.tsx:48 | Ticket closed or reopened, rating sent | refresh only | "Your query is closed" / "Thanks for rating this answer" / "Your query is open again" | success | none | todo |
| C14 | app/(app)/support/new/NewQueryForm.tsx:234 | Topic not chosen | red caption under topics | its words | error | none | todo (field) |
| C15 | app/(app)/support/new/NewQueryForm.tsx:445 | Support query filed | receipt panel with reference | "Your query is sent" | success | none | kept panel + banner (receipt is the record) |
| C16 | app/(app)/listing/[id]/ReservePanel.tsx:538 | Table reservation refused | red line under the panel | the refusal | error | Try again | todo |
| C17 | app/(app)/listing/[id]/ReservePanel.tsx:623 | Stay hold refused | red line | the refusal | error | Try again | todo |
| C18 | app/(app)/listing/[id]/ReservePanel.tsx:666 | Rental request refused | red line | the refusal | error | Try again | todo |
| C19 | app/(app)/stay/[id]/StayDatesForm.tsx:74 | Dates note (nights, unavailable) | caption under the form | the note when it is a refusal | warning | none | todo (audit: a live summary stays) |
| C20 | app/(app)/profile/AccountBody.tsx:521 | Profile field refused | red caption | its words | error | none | todo (field) |
| C21 | app/(app)/checkout/[bookingId]/PayPanel.tsx:168 | Payment could not start | note under Pay | the note | error | Try again | todo |
| C22 | app/(app)/rent/pay/[inspectionId]/PayPanel.tsx:108 | Rent payment could not start | note under Pay | the note | error | Try again | todo |
| C23 | app/email/preferences/PreferencesForm.tsx:54 | Email preferences refused | red line | the refusal | error | Try again | todo |
| C24 | app/email/preferences/PreferencesForm.tsx | Email preferences saved | no word | "Your email choices are saved" | success | none | todo |
| C25 | components/money/balance/WithdrawScreen.tsx:305 | Withdraw destination refused | red line under the picker | the refusal | error | none | todo (field) |
| C26 | components/money/balance/WithdrawScreen.tsx:218 | Withdraw one-time code note | note under the code | the note | info/error | none | todo |
| C27 | components/money/balance/SendScreen.tsx:280 | Recipient not found | red line under the field | the refusal | error | none | todo (field) |
| C28 | components/money/balance/SendScreen.tsx:212 | Send one-time code note | note | the note | info/error | none | todo |
| C29 | components/money/WithdrawalMaths.tsx:65 | Withdrawal quote failed | line in the maths card | kept: the card's own state (quote unavailable) | n/a | n/a | kept |
| C30 | components/verification/KycFlow.tsx:552 | Verification gaps named | red panel listing the missing items | "Add {first gap} to continue" and the panel's list stays as the checklist | error | none | todo |
| C31 | components/verification/KycFlow.tsx:565 | Verification submission failed | red line | the failure | error | Try again | todo |
| C32 | components/verification/SelfieCapture.tsx:295 | Selfie upload or camera failed | red caption | the failure | error | Try again | todo |
| C33 | components/verification/RequestedPhotoPanel.tsx:91 | Requested photo send failed | red caption | the failure | error | Try again | todo |
| C34 | components/verification/RequestedPhotoPanel.tsx | Requested photo sent | no word | "Photo sent to the review team" | success | none | todo |
| C35 | components/verification/IdCapture.tsx:320 | ID photo refused | error line | the failure | error | Try again | todo |
| C36 | components/verification/DocumentUploader.tsx:255 | Document upload failed | red caption | the failure | error | Try again | todo |
| C37 | components/verification/DocumentUploader.tsx | Document uploaded | no word | "Document uploaded" | success | none | todo |
| C38 | components/verification/DojahPanel.tsx:137 | Identity check failed | red line | the failure | error | Try again | todo |
| C39 | components/verification/DojahPanel.tsx:102 | Identity check done | record panel | kept panel + "Identity check sent" | success | none | todo |
| C40 | components/app/money/MoneyStepUp.tsx:321 | Money step-up refused | red line | the refusal | error | none | todo |
| C41 | components/app/ai/AiConsentSheet.tsx:68 | AI consent not saved | line in the sheet | "Your choice was not saved. Try again." | error | Try again | todo |
| C42 | components/app/price/NextActions.tsx:97 | Price alert not saved | red caption | the refusal | error | Try again | todo |
| C43 | components/app/price/NextActions.tsx:72 | Price alert saved | inline status block | "Price alert saved" | success | none | todo |
| C44 | components/app/push/PushPrompt.tsx:185 | Notifications could not be turned on | red line | the failure | error | Try again | todo |
| C45 | components/app/welcome/FirstRun.tsx:878 | First run step not saved | red line | the failure | error | Try again | todo |
| C46 | components/app/referral/WithdrawFlow.tsx:196 | Rewards withdrawal refused | red line | the refusal | error | Try again | todo |
| C47 | components/app/referral/WithdrawFlow.tsx:142 | Rewards withdrawal requested | record panel | kept panel + "Withdrawal requested" | success | none | todo |
| C48 | components/app/referral/RewardsPayoutForm.tsx:47 | Rewards payout account saved | record panel | kept panel + "Payout account saved" | success | none | todo |
| C49 | components/app/briefs/BriefComposer.tsx:198 | Brief not posted | red line | the refusal | error | Try again | todo |
| C50 | components/app/briefs/BriefComposer.tsx:94 | Brief posted | status line | "Your brief is posted" | success | none | todo |
| C51 | components/app/briefs/MyBriefs.tsx:106 | Brief close or change failed | red list item | the refusal | error | Try again | todo |
| C52 | components/app/place/ChoicePicker.tsx:223 | Choice required | red caption | its words | error | none | todo (field) |
| C53 | components/app/doors/AgentLookupCard.tsx:111 | Agent lookup refused | red caption under the field | its words | error | none | todo (field) |
| C54 | components/app/doors/SafetyShareControl.tsx:208 | Safety check answered | green line | "Thanks. Your contact can see you are safe" | success | none | todo |
| C55 | components/app/arrival-check/ArrivalRuling.tsx:113 | Arrival ruling outcome | status line | the outcome | success / error | none | todo |
| C56 | components/app/inspections/TruthQuestions.tsx:121 | Truth answers not sent | red line | the refusal | error | Try again | todo |
| C57 | components/app/inspections/visit/VisitPlanner.tsx:367 | Visit plan refused | problem line | the problem | error | none | todo |
| C58 | components/app/inspections/ViewingSheets.tsx:58 | Viewing sheet action refused | red caption | the refusal | error | Try again | todo |
| C59 | components/app/inspections/GateHandshake.tsx:386 | Gate warning | warning block | kept: the handshake's own state | warning | n/a | kept |
| C60 | components/app/threads/ReservationFace.tsx:112 | Reservation step refused in a thread | red caption | the refusal | error | Try again | todo |
| C61 | components/app/threads/RentalFace.tsx:294 | Rental step refused | red caption | the refusal | error | Try again | todo |
| C62 | components/app/threads/RentalFace.tsx:499 | Rental action refused | red caption | the refusal | error | Try again | todo |
| C63 | components/app/payments/AddBankAccountSheet.tsx:157 | Bank account name check failed | red line | the refusal | error | Try again | todo |
| C64 | components/app/listing/ListingActions.tsx:385 | Save, share outcome on the listing hero | chip beside the actions | "Saved to your list" / "Removed from your list" / the failure | success / error | Undo on save | todo |
| C65 | components/app/ListingCard.tsx:607 | Save on a card | note on the card | "Saved to your list" / the failure | success / error | Undo | todo |
| C66 | components/app/search/MapDock.tsx:241 | Save from the map | red note | the failure | error | Try again | todo |
| C67 | components/app/price/ShareAreaButton.tsx:177 | Area link copied | label turns "Copied" | "Link copied" | success | none | todo |
| C68 | components/site/MoveInCalculator.tsx:115 | Calculator link copied | label turns "Copied" | "Link copied" | success | none | todo |
| C69 | components/ui/ExternalLinkSheet.tsx:127 | External link copied | label turns "Copied" | "Link copied" | success | none | todo |
| C70 | components/social/PlacePicker.tsx:264 | Place search failed | red line | the failure | error | Try again | todo |
| C71 | components/social/feed/ListingPicker.tsx:115 | Listing picker failed | note | the failure | error | Try again | todo |
| C72 | components/social/feed/Composer.tsx:661 | Post not published | red line | the refusal | error | Try again | todo |
| C73 | components/social/feed/Composer.tsx:654 | Post waiting (offline) | caption | "Saved on your device. It posts when you're back online" | info | none | todo |
| C74 | components/support/PhotoField.tsx:93 | Support photo refused | red caption | the refusal | error | none | todo |
| C75 | components/support/PhotoField.tsx:119 | Support photo upload failed | red caption | the failure | error | Try again | todo |
| C76 | components/passport/PassportThreadRows.tsx:118 | Passport share change failed | red caption | the failure | error | Try again | todo |
| C77 | components/passport/PassportSettings.tsx:101 | Passport setting not saved | red span | the failure | error | Try again | todo |
| C78 | components/passport/PassportSettings.tsx | Passport setting saved | no word | "Your passport setting is saved" | success | none | todo |
| C79 | components/site/NewsletterForm.tsx:62 | Newsletter email refused | red caption | its words | error | none | todo (field) |
| C80 | components/site/NewsletterForm.tsx:33 | Newsletter subscribed | status line replaces the form | kept panel + "You're on the list" | success | none | todo |
| C81 | components/app/safety/UnsafeSheet.tsx:154 | Unsafe report filed | record panel in the sheet | kept + "Your report is sent" | success | none | todo |
| C82 | components/app/assistant/PersonHandoff.tsx:145 | Handed to a person | record | kept (assistant owner) | n/a | n/a | kept |
| C83 | app/(app)/settings/invite/InviteShare.tsx:30 | Invite link copied | label "Copied" | "Invite link copied" (via A6) | success | none | todo |
| C84 | components/app/account/InviteTicket.tsx | Invite code or link copied | label "Copied" | "Invite link copied" (via A6) | success | none | todo |
| C85 | components/app/listing/ListingCode.tsx:71 | Listing code copied | label "Copied" | "Code copied" (via A6) | success | none | todo |
| C86 | components/app/payments/crypto/CryptoPaymentStatus.tsx:124 | Wallet address copied | label "Copied" | "Address copied" (via A6) | success | none | todo |
| C87 | components/app/payments/PaymentMethodsPanel.tsx:250 | Adding a card | status line while it works | kept: progress, not an outcome | n/a | n/a | kept |
| C88 | components/compliance/PepQuestion.tsx:45 | PEP answer saved | "Saved." in the card head | "Your answer is saved" | success | none | todo |
| C89 | components/compliance/PepQuestion.tsx:125 | PEP answer refused | caption | the refusal | error | Try again | todo |
| C90 | components/compliance/PepQuestion.tsx:84 | PEP field refused | caption under the field | its words | error | none | todo (field) |
| C91 | app/(app)/messages/new/FirstMessage.tsx:111 | First message not sent | caption | the refusal | error | Try again | todo (MSG file) |
| C92 | app/(app)/messages/share/SharePicker.tsx:251 | Share to a thread failed | red caption | the refusal | error | Try again | todo (MSG file) |
| C93 | app/(app)/messages/Inbox.tsx:860 | Inbox action failed | red line | the refusal | error | Try again | todo (MSG file) |
| C94 | components/app/messages/StageControl.tsx:150 | Stage change refused | red line | the refusal | error | Try again | todo (MSG file) |
| C95 | components/app/messages/StageControl.tsx:270 | Stage change refused (second form) | red line | the refusal | error | Try again | todo (MSG file) |
| C96 | components/app/messages/AvailabilityCard.tsx:128 | Availability answer refused | red line | the refusal | error | Try again | todo (MSG file) |
| C97 | components/app/messages/ForwardSheet.tsx:139 | Forward refused | red line | the refusal | error | Try again | todo (MSG file) |
| C98 | components/app/messages/ShareSheet.tsx:211 | Share failed | red caption | the refusal | error | Try again | todo (MSG file) |
| C99 | app/(app)/messages/[id]/ThreadOptionsSheet.tsx:337 | Thread option failed | alert in the sheet | the refusal | error | Try again | todo (MSG file) |
| C100 | components/calls/CallButtons.tsx:122 | Call could not start | note beside the call buttons | the note | error | Try again | todo |

## D. Agent workspace (app/agent, components/agent, supply)

| # | File:line | Moment | Today | Banner words | Tone | Retry/Undo | Status |
|---|---|---|---|---|---|---|---|
| D1 | app/agent/reviews/ReplyForm.tsx:75 | Review reply removal refused | warning caption | the refusal | error | Try again | todo |
| D2 | app/agent/reviews/ReplyForm.tsx:104 | Review reply refused | field error | its words | error | none | todo (field via A1) |
| D3 | app/agent/reviews/ReplyForm.tsx | Review reply posted, removed | the reply shows | "Your reply is posted" / "Your reply is removed" | success | none | todo |
| D4 | app/agent/bookings/ReservationsBoard.tsx:85 | Reservation decision refused | red caption | the refusal | error | none | todo |
| D5 | app/agent/bookings/ReservationsBoard.tsx | Reservation accepted or declined | refresh only | "Reservation updated" (the decision's own words) | success | none | todo |
| D6 | app/agent/listings/[listingId]/calendar/CalendarEditor.tsx:275 | Calendar block or open refused | red alert | the refusal | error | Try again | todo |
| D7 | app/agent/listings/[listingId]/calendar/CalendarEditor.tsx:61 | Dates blocked or opened | refresh only | "Dates blocked" / "Dates open again" | success | none | todo |
| D8 | app/agent/listings/OwnerAskStrip.tsx:76 | Owner ask refused | red caption | the refusal | error | Try again | todo |
| D9 | app/agent/listings/OwnerAskStrip.tsx:36 | Owner asked | green status line | "Request sent to the owner" | success | none | todo |
| D10 | app/agent/listings/CloseListingSheet.tsx:112 | Close listing refused | alert in the sheet | the refusal | error | Try again | todo |
| D11 | app/agent/portfolio/PortfolioControls.tsx:156 | Pitch refused | red caption | the refusal | error | Try again | todo |
| D12 | app/agent/portfolio/PortfolioControls.tsx:121 | Pitch sent | status line replaces the button | "Your pitch is sent" | success | none | todo |
| D13 | app/agent/listings/[listingId]/mandate/MandateForm.tsx:72 | Mandate sent | status line replaces the form | "Mandate sent for review" | success | none | todo |
| D14 | app/agent/listings/[listingId]/mandate/page.tsx:119 | Mandate renewal refused (record state) | red line on the page | kept: the mandate's recorded state | n/a | n/a | kept |
| D15 | app/agent/earnings/EarningsWorkspace.tsx:88 | Earnings read failed | alert | kept: page state | n/a | n/a | kept |
| D16 | app/agent/analytics/page.tsx:176 | Analytics read failed | alert | kept: page state | n/a | n/a | kept |
| D17 | app/agent/list/ListingWizard.tsx:520 | Listing wizard load error | error block | kept: page state | n/a | n/a | kept |
| D18 | app/agent/list/ListingWizard.tsx:2794 | Wizard notice (draft saved, refused) | note under the step | the notice | per notice | none | todo |
| D19 | app/agent/list/ListingWizard.tsx:3162 | Photo notice | note under photos | the notice | warning | none | todo |
| D20 | app/agent/list/ListingWizard.tsx:4673 | Publish notice | note at the end | the notice | per notice | none | todo |
| D21 | components/agent/UnitQuestions.tsx:62 | Unit answers not saved | red line | the refusal | error | Try again | todo |
| D22 | components/agent/ViewingWindows.tsx:203 | Viewing windows not saved | red line | the refusal | error | Try again | todo |
| D23 | components/agent/ViewingWindows.tsx | Viewing windows saved | no word | "Viewing times saved" | success | none | todo |
| D24 | components/agent/ApplyWizard.tsx:593 | Documents missing | red caption | its words | error | none | todo (field) |
| D25 | components/agent/ApplyWizard.tsx:647 | Terms not agreed | red caption | its words | error | none | todo (field) |
| D26 | components/agent/ApplyWizard.tsx:672 | Application refused | alert | the refusal | error | Try again | todo |
| D27 | components/agent/ApplyWizard.tsx:879 | Upload refused | red caption | the refusal | error | Try again | todo |
| D28 | components/agent/PayoutAccounts.tsx:253 | Payout account check refused | alert | the refusal | error | none | todo |
| D29 | components/agent/PayoutAccounts.tsx:343 | Payout account not saved | alert | the refusal | error | Try again | todo |
| D30 | components/agent/PayoutAccounts.tsx | Payout account added, removed, made default | refresh only | "Payout account added" / "Payout account removed" / "Default payout account changed" | success | none | todo |
| D31 | components/agent/CompoundQuestions.tsx:92 | Compound answers refused | red span | the refusal | error | none | todo |
| D32 | components/agent/intel/ConfirmAvailable.tsx:68 | Still available confirmed, or failed | status line under the button | "Marked as still available" / the failure | success / error | Try again | todo |
| D33 | components/agent/RespondToReview.tsx:43 | Response sent | record panel | kept panel + "Your response is posted" | success | none | todo |
| D34 | components/supply/UploadCard.tsx:206 | Registration upload refused | red caption | the refusal | error | Try again | todo |
| D35 | components/supply/AgentRegisterForm.tsx:540 | Agent registration refused | alert | the refusal | error | Try again | todo |
| D36 | components/supply/RegisterShell.tsx:133 | Registration step refused | alert | the refusal | error | none | todo |
| D37 | components/legal/WorkspaceAcceptance.tsx:85 | Workspace terms not accepted | red caption | its words | error | none | todo (field) |
| D38 | app/agent/promotion, components/promotion/PromotionResults.tsx:41 | Promotion notice (paid, cancelled) | notice block on the results page | the notice title | success / info | none | todo |

## E. Host (app/host, components/host, stays)

| # | File:line | Moment | Today | Banner words | Tone | Retry/Undo | Status |
|---|---|---|---|---|---|---|---|
| E1 | components/host/HostWizard.tsx:696 | Host wizard step refused | red line | the refusal | error | none | todo |
| E2 | components/host/HostWizard.tsx:827 | Host wizard notice (saved, sent) | notice block | the notice | success / error | none | todo |
| E3 | components/host/HostWizard.tsx:731 | Sent back by review | status panel | kept: the application's recorded state | n/a | n/a | kept |
| E4 | components/host/FacilitiesPicker.tsx:146 | Facilities saved or refused | notice under the picker | "Facilities saved" / the refusal | success / error | Try again | todo |
| E5 | components/host/RoomNightsEditor.tsx:177 | Room nights saved or refused | notice | "Room nights saved" / the refusal | success / error | Try again | todo |
| E6 | components/host/stays/FacilitiesStep.tsx:200 | Facilities step refused | note | the refusal | error | none | todo |
| E7 | components/host/stays/TablesStep.tsx:224 | Tables step refused | red note | the refusal | error | none | todo |
| E8 | components/host/stays/HotelStep.tsx:130 | Hotel step refused | note | the refusal | error | none | todo |
| E9 | components/host/dashboard/FrontDeskPanel.tsx:188 | Front desk mark refused | red span in the row | the refusal | error | Try again | todo |
| E10 | components/host/dashboard/FrontDeskPanel.tsx:92 | Guest checked in, checked out | the row mark changes | "Checked in" / "Checked out" | success | none | todo |
| E11 | components/host/reviews/HostReviewCard.tsx:220 | Host review reply refused | red line | the refusal | error | Try again | todo |
| E12 | components/stays/DoorChargeReport.tsx:20 | Door charge reported | green line replaces the form | "Report sent. Thank you" | success | none | todo |
| E13 | app/host/reservations/DepositSettingsCard.tsx:339 | Deposit settings problem | caption | its words | error | none | todo (field) |
| E14 | components/host/StatementView.tsx:79 | Statement read failed | line | kept: page state | n/a | n/a | kept |
| E15 | components/host/reviews/HostReviewsView.tsx:50 | Reviews read failed | line | kept: page state | n/a | n/a | kept |
| E16 | components/host/DecideView.tsx:57 | Decide view read failed | line | kept: page state | n/a | n/a | kept |
| E17 | app/host/bookings/page.tsx:81, app/host/calendar/page.tsx:116 | Read failed | line | kept: page state | n/a | n/a | kept |
| E18 | components/host/calendar/CalendarSync.tsx:99 | Calendar link copied | label turns "Copied" | already bannered | success | none | done (round 1) |

## F. Admin and staff (app/admin, components/compliance, components/calls/admin)

| # | File:line | Moment | Today | Banner words | Tone | Retry/Undo | Status |
|---|---|---|---|---|---|---|---|
| F1 | app/admin/weight-withheld/ClearStamp.tsx:108 | Clear note refused | red line under the form | the refusal | error | none | todo (field) |
| F2 | app/admin/retention/DestroyRecords.tsx:126 | Destroy confirmation wrong | red line | its words | error | none | todo (field) |
| F3 | app/admin/kyc/IdentityCheckDecision.tsx:91 | Identity decision reason refused | red line | its words | error | none | todo (field) |
| F4 | app/admin/kyc/IdentityCheckDecision.tsx:36 | Identity check approved or declined | refresh only | "Identity check approved" / "Identity check declined" | success | none | todo |
| F5 | app/admin/kyc/RequestSelfieWithId.tsx:95 | Selfie request message refused | red caption | its words | error | none | todo (field) |
| F6 | app/admin/kyc/RequestSelfieWithId.tsx:59 | Selfie with ID requested | refresh only | "Selfie with ID requested" | success | none | todo |
| F7 | app/admin/payments/MethodLookup.tsx:122 | Removal reason refused | red line | its words | error | none | todo (field) |
| F8 | app/admin/bookings/reservations/ReservationDecisions.tsx:181 | Decision reason refused | red line | its words | error | none | todo (field) |
| F9 | app/admin/blocked-terms/TermForms.tsx:157 | Term field refused | red caption | its words | error | none | todo (field) |
| F10 | app/admin/blocked-terms/TermForms.tsx:235 | Term form refused | red line | the refusal | error | none | todo |
| F11 | app/admin/referrals/ReferralControls.tsx:529 | Referral decision reason refused | red line | its words | error | none | todo (field) |
| F12 | app/admin/listings/[id]/ReviewActionBar.tsx:227 | Listing review decision refused | red line | the refusal | error | Try again | todo |
| F13 | app/admin/listings/[id]/ReviewActionBar.tsx:226 | "Recording the decision." progress line | line | kept: progress state | n/a | n/a | kept |
| F14 | app/admin/listings/MandateDecision.tsx:37 | Mandate approved or rejected | status line replaces the buttons | "Mandate approved" / "Mandate rejected" | success | none | todo |
| F15 | app/admin/stops/StopsDesk.tsx:237 | Member trading again | green status line | "{name} is trading again" | success | none | todo |
| F16 | app/admin/stops/StopsDesk.tsx:330 | Stop placed | green status line | the line's words | success | none | todo |
| F17 | app/admin/stops/RecallPanel.tsx:80 | Recall sent | status line | "Recall sent to {count} people" | success | none | todo |
| F18 | app/admin/settings/SampleEmails.tsx:68 | Sample emails sent | status note | the note | success / error | Try again | todo |
| F19 | app/admin/_lanes/HeldLane.tsx:302 | Held payment decision note | note | the note when it is an outcome | success / error | none | todo |
| F20 | app/admin/_review/parts.tsx:155 | Review panel note | note | the note when it is an outcome | per note | none | todo |
| F21 | app/admin/compliance/_lanes/SanctionsControls.tsx:75 | Sanctions list file too large | alert | "That file is too large" (its words) | error | none | todo |
| F22 | app/admin/compliance/_lanes/StrControls.tsx:403 | STR working | status | kept: progress | n/a | n/a | kept |
| F23 | components/compliance/RiskOverrideForm.tsx:61 | Risk override refused | caption | the refusal | error | none | todo |
| F24 | components/compliance/RiskOverrideForm.tsx:56 | Risk override saved | caption | "Risk override saved" | success | none | todo |
| F25 | components/compliance/ApproveForm.tsx:50 | EDD approve refused | caption | the refusal | error | none | todo |
| F26 | components/compliance/ApproveForm.tsx:45 | EDD approved | caption | "Approved" (the form's own saved words) | success | none | todo |
| F27 | components/compliance/EddReviewCard.tsx:119 | EDD review refused | caption | the refusal | error | none | todo |
| F28 | components/compliance/EddReviewCard.tsx:109 | EDD review saved | caption | its saved words | success | none | todo |
| F29 | components/compliance/PepFlagForm.tsx:61 | PEP flag refused | caption | the refusal | error | none | todo |
| F30 | components/compliance/PepFlagForm.tsx:56 | PEP flag saved | caption | its saved words | success | none | todo |
| F31 | components/compliance/ReopenEddButton.tsx:24 | EDD reopen refused | caption | the refusal | error | none | todo |
| F32 | components/compliance/ReopenEddButton.tsx:19 | EDD reopened | caption | its saved words | success | none | todo |
| F33 | components/calls/admin/RequestReviewCall.tsx:164 | Review call request refused | red line | the refusal | error | Try again | todo |
| F34 | components/calls/admin/ReviewOutcomeForm.tsx:86 | Review outcome field refused | red line | its words | error | none | todo (field) |
| F35 | components/calls/admin/ReviewOutcomeForm.tsx:110 | Review outcome refused | red line | the refusal | error | Try again | todo |
| F36 | components/calls/admin/ReviewDesk.tsx:148 | Review desk note | note | the note | per note | none | todo |
| F37 | components/calls/admin/ReviewDesk.tsx:259 | Review desk action refused | red line | the refusal | error | Try again | todo |
| F38 | components/calls/admin/ReviewDesk.tsx:301 | Review desk action refused | red line | the refusal | error | Try again | todo |
| F39 | components/calls/admin/ReviewDesk.tsx:381 | Review desk action refused | red line | the refusal | error | Try again | todo |
| F40 | components/calls/SubjectReviewCard.tsx:130 | Subject review refused | red line | the refusal | error | Try again | todo |
| F41 | components/calls/SubjectReviewCard.tsx:105 | Subject review saved | status line | its saved words | success | none | todo |
| F42 | components/calls/views.tsx:237 | Call view action refused | red line | the refusal | error | Try again | todo |
| F43 | components/calls/views.tsx:326 | Call view action refused | red line | the refusal | error | Try again | todo |
| F44 | app/admin/_lanes/SafetyHolds.tsx:28, app/admin/listings/[id]/FeeAcceptancePanel.tsx:23, app/admin/_components/ActingFor.tsx:40, app/admin/compliance/_lanes/{StrLane,PepLane,RiskLane,BeneficialOwnershipLane}.tsx, app/admin/compliance/error.tsx, app/admin/account-recovery/page.tsx:60, app/admin/people/[id]/MemberSections.tsx:42 | Desk could not be read | alert or line in the panel | kept: a page state, the panel has nothing else to show | n/a | n/a | kept |
| F45 | app/admin/compliance/_lanes/SanctionsLane.tsx:77,95,153 | Sanctions list facts (none loaded, list shrank) | alert lines | kept: facts about the list a reviewer must see while working | n/a | n/a | kept |
| F46 | app/(site)/landlord/[token]/ReplyActions.tsx:82 | Landlord reply refused | alert | the refusal | error | Try again | todo |
| F47 | app/(site)/landlord/[token]/ReplyActions.tsx:48 | Landlord answered or stopped messages | settled panel | kept panel + "Your answer is sent" / "Messages stopped" | success | none | todo |
| F48 | app/(site)/contact/ContactForm.tsx:176 | Contact form refused | alert | the refusal | error | none | todo |
| F49 | app/(site)/check/CheckForm.tsx:77 | Agent check refused | caption | the refusal | error | none | todo |

## Kept on purpose (records and page states)

A record panel is the page's own receipt or next step; it stays, and where
the moment had no banner one is added beside it (the banner says it happened,
the panel keeps the record). A page state is what a page shows when its data
could not be read; it is the content, not an action's outcome, and a banner
would leave an empty panel behind.

Listed in the tables with status `kept`; reasons are on each row.
