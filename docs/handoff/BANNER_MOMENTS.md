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
| A1 | components/ui/Field.tsx:150 | Any field refused (every form on `Field`, `TextInput`, `TextArea`, `Select`) | red caption under the field, `role="alert"` | the field's own message | error | none (fix the field) | done (batch 1) |
| A2 | components/auth/fields.tsx:88 | Auth field refused (email, password, name) | red caption, `role="alert"` | the field's own message | error | none | done (batch 1) |
| A3 | components/auth/slate.tsx:213 | Slate field refused (welcome slates) | red caption, `role="alert"` | the field's own message | error | none | done (batch 1) |
| A4 | components/auth/CodeInput.tsx:114 | Code boxes refused (wrong or short code) | red caption, `role="alert"` | the code's own message | error | none | done (batch 1) |
| A5 | app/css/controls.css:266 | The red edge itself in dark mode | `border-color` only, hidden by the gradient border (Field.tsx explains) | n/a: the edge must show now that the words leave | n/a | n/a | done (batch 1) |
| A6 | lib/ui/use-copy.ts:52 (`useCopyFlash`) | Link, code, invite copied from an in-place copy button (InviteShare, ListingCode, SuccessSheet, TableSeatingPanel, CryptoPaymentStatus, InviteTicket) | button label turns "Copied", nothing at the top | "Link copied" / "Code copied" / "Copied" | success | none | done (batch 1) |
| A7 | app/admin/_components/MoneyDecisions.tsx:30 (`Refusal`) | Fee rate refused, KYC document decision refused | red line under the form | the server's sentence | error | Try again | done (batch 1) |
| A8 | components/app/confirm/ConfirmPanel.tsx:190 | Any confirm sheet's action refused (cancel, remove, close) | red line inside the sheet | the error passed in | error | per caller | done (batch 1) |
| A9 | components/ui/StepFrame.tsx:212 | Step frame notice | notice slot under the step | the step's notice (callers decide) | per caller | none | done (audited: two callers, support topic handled in C14, phone gate link kept as an action) |
| A10 | components/ui/AIResponse.tsx:139 | Assistant answer failed | red line in the answer block | "That answer did not come through. Try again." | error | Try again | kept (the answer block is the content; assistant is another owner) |

## B. Account and arrival moments

| # | File:line | Moment | Today | Banner words | Tone | Retry/Undo | Status |
|---|---|---|---|---|---|---|---|
| B1 | lib/auth/email-code.ts:84 | Returning sign-in with an email code | no word (only a first sign-in earns "Welcome to Vallo") | "Signed in. Welcome back." (`signed-in`) | success | none | done (batch 1) |
| B2 | lib/auth/phone-sign-in.ts:71 | Returning sign-in with a phone code | no word | "Signed in. Welcome back." | success | none | done (batch 1) |
| B3 | components/auth/PasskeySignIn.tsx:65 | Signed in with a passkey or Face ID | no word | "Signed in. Welcome back." (`showSuccess("signed-in")`) | success | none | done (batch 1) |
| B4 | lib/auth/actions.ts:947 (`completeEmailVerification`) | Returning Google or Apple sign-in, magic link sign-in | no word (link types `email`, OAuth carry none) | "Signed in. Welcome back." when the account is not new | success | none | done (batch 1) |
| B5 | components/auth/AuthChoices.tsx:80 | Arrival notice on sign in (`?notice=link-expired`, signed out, etc.) | status line on the page | the notice's own sentence | info or warning | none | done (batch 1) |
| B6 | components/auth/EmailAuthForm.tsx:217 | Arrival notice on the email form | status line | the notice's own sentence | info | none | done (batch 1) |
| B7 | components/auth/ForgotPasswordForm.tsx:41 | Reset code sent | status paragraph replacing the form | "Check your email for a reset code" (the form's own words) | success | none | done (batch 1) |
| B8 | components/auth/VerifyCodeForm.tsx:270 | New code sent (resend) | status line under the button | the resend message | success | none | done (batch 1) |
| B9 | components/auth/EmailAuthForm.tsx:427 | Sign in or sign up refused (wrong password, limit) | red alert above the button | the server's sentence | error | none | done (batch 1) |
| B10 | components/auth/VerifyCodeForm.tsx:242 | Sign-up code refused | red alert | the server's sentence | error | none | done (batch 1) |
| B11 | components/auth/ResetCodeForm.tsx:103 | Reset code refused | red alert | the server's sentence | error | none | done (batch 1) |
| B12 | components/auth/ResetPasswordForm.tsx:91 | New password refused | red alert | the server's sentence | error | none | done (batch 1) |
| B13 | components/auth/ForgotPasswordForm.tsx:69 | Reset request refused | red alert | the server's sentence | error | none | done (batch 1) |
| B14 | components/auth/FinishSetupForm.tsx:131 | Finish setup refused | red alert | the server's sentence | error | none | done (batch 1) |
| B15 | components/auth/CodeSignInForm.tsx:133 | Code sign-in: sending refused | red notice | the refusal | error | none | done (batch 1) |
| B16 | components/auth/CodeSignInForm.tsx:160 | Code sign-in: verify refused (limit, failed) | red notice | the refusal | error | none | done (batch 1) |
| B17 | components/auth/PasskeySignIn.tsx:75 | Passkey sign-in failed | notice under the button | "That did not sign you in. Try again or use your password." (its own words) | error | Try again | done (batch 1) |
| B18 | components/auth/NativeAppleSignIn.tsx:151 | Sign in with Apple failed | notice under the button | its own message | error | Try again | done (batch 1) |
| B19 | components/auth/AcceptTerms.tsx:93 | Age not confirmed | red line under the box | its own words | error | none | done (batch 1) |
| B20 | components/auth/AcceptTerms.tsx:160 | Terms not accepted | red line under the box | its own words | error | none | done (batch 1) |
| B21 | components/auth/EmailTakenNotice.tsx:81 | Email already has an account | status panel with a sign-in link | kept: it carries the next step's link | info | n/a | kept (guidance with a link, not an outcome line) |
| B22 | app/(site)/delete-account/RestoreForm.tsx:57 | Account restore code refused | red alert under the form | the refusal | error | none | done (batch 1) |
| B23 | app/(site)/delete-account/RestoreForm.tsx:24 | Account restored | record panel replaces the form | "Your account is restored" | success | none | done (panel kept as the record, banner beside it) |

## C. Member side (app/(app), components/app, social, money, verification)

| # | File:line | Moment | Today | Banner words | Tone | Retry/Undo | Status |
|---|---|---|---|---|---|---|---|
| C1 | app/(app)/settings/MoneyLockGroup.tsx:335 | Money lock enrolment refused | red line in the enrol card | the refusal | error | none | done (batch 2) |
| C2 | app/(app)/settings/DeleteAccountPanel.tsx:487 | Delete confirmation word wrong | red caption under the field | its words | error | none | done (batch 2) |
| C3 | app/(app)/settings/DeleteAccountPanel.tsx:527 | Delete request refused | red alert in the sheet | the refusal | error | Try again | done (batch 2) |
| C4 | app/(app)/settings/privacy/PendingAddressMove.tsx:39 | Address move pending (warning card) | warning card with Cancel | kept: the page's own record of a pending change | warning | n/a | kept |
| C5 | app/(app)/settings/phone/PhoneConfirmForm.tsx:233 | Phone code send or verify refused | red line under the form | the refusal | error | Try again (send) | done (batch 2) |
| C6 | app/(app)/settings/phone/PhoneConfirmForm.tsx:164 | Phone number confirmed | record face replaces the form | "Your phone number is confirmed" | success | none | done (batch 2) |
| C7 | app/(app)/settings/devices/DeviceList.tsx:204 | Device list read failed | panel | kept: a page state, not an action outcome | error | n/a | kept |
| C8 | app/(app)/settings/devices/NotMePanel.tsx:111 | "This was not me": account held, or failed | outcome sheet | the sheet stays (it explains next steps); a banner says "Your account is secured" or the failure | success / error | Try again on failure | kept (an outcome SHEET with next steps, not inline text) |
| C9 | app/(app)/settings/privacy/blocked/BlockedList.tsx:98 | Member unblocked | status line under the row | "{name} is unblocked" | success | none | done (batch 2) |
| C10 | app/(app)/rent/review/[paymentId]/TenancyReviewForm.tsx:193 | Review incomplete | red line under the form | "Answer every question to send your review" | error | none | done (batch 2) |
| C11 | app/(app)/rent/review/[paymentId]/TenancyReviewForm.tsx:61 | Tenancy review sent | thank-you panel replaces the form | "Your review is sent" | success | none | done (batch 2) |
| C12 | app/(app)/support/messages/[id]/TicketActions.tsx:162 | Rating needs stars | red caption | "Choose how many stars first" | error | none | done (batch 2) |
| C13 | app/(app)/support/messages/[id]/TicketActions.tsx:48 | Ticket closed or reopened, rating sent | refresh only | "Your query is closed" / "Thanks for rating this answer" / "Your query is open again" | success | none | done (batch 2) |
| C14 | app/(app)/support/new/NewQueryForm.tsx:234 | Topic not chosen | red caption under topics | its words | error | none | done (batch 2) |
| C15 | app/(app)/support/new/NewQueryForm.tsx:445 | Support query filed | receipt panel with reference | "Your query is sent" | success | none | done (batch 2) |
| C16 | app/(app)/listing/[id]/ReservePanel.tsx:538 | Table reservation refused | red line under the panel | the refusal | error | Try again | done (batch 2) |
| C17 | app/(app)/listing/[id]/ReservePanel.tsx:623 | Stay hold refused | red line | the refusal | error | Try again | done (batch 2) |
| C18 | app/(app)/listing/[id]/ReservePanel.tsx:666 | Rental request refused | red line | the refusal | error | Try again | done (batch 2) |
| C19 | app/(app)/stay/[id]/StayDatesForm.tsx:74 | Dates note (nights, unavailable) | caption under the form | the note when it is a refusal | warning | none | kept (a caller's guidance note, not an outcome) |
| C20 | app/(app)/profile/AccountBody.tsx:521 | Profile field refused | red caption | its words | error | none | done (batch 2) |
| C21 | app/(app)/checkout/[bookingId]/PayPanel.tsx:168 | Payment could not start | note under Pay | the note | error | Try again | kept (a caller's guidance note about card payment, not an outcome) |
| C22 | app/(app)/rent/pay/[inspectionId]/PayPanel.tsx:108 | Rent payment could not start | note under Pay | the note | error | Try again | kept (a caller's guidance note, not an outcome) |
| C23 | app/email/preferences/PreferencesForm.tsx:54 | Email preferences refused | red line | the refusal | error | Try again | done (batch 1) |
| C24 | app/email/preferences/PreferencesForm.tsx | Email preferences saved | no word | "Your email choices are saved" | success | none | done (batch 1) |
| C25 | components/money/balance/WithdrawScreen.tsx:305 | Withdraw destination refused | red line under the picker | the refusal | error | none | done (batch 2) |
| C26 | components/money/balance/WithdrawScreen.tsx:218 | Withdraw one-time code note | note under the code | the note | info/error | none | done (batch 2) |
| C27 | components/money/balance/SendScreen.tsx:280 | Recipient not found | red line under the field | the refusal | error | none | done (batch 2) |
| C28 | components/money/balance/SendScreen.tsx:212 | Send one-time code note | note | the note | info/error | none | done (batch 2) |
| C29 | components/money/WithdrawalMaths.tsx:65 | Withdrawal quote failed | line in the maths card | kept: the card's own state (quote unavailable) | n/a | n/a | kept |
| C30 | components/verification/KycFlow.tsx:552 | Verification gaps named | red panel listing the missing items | "Add {first gap} to continue" and the panel's list stays as the checklist | error | none | kept (the review step's own checklist of what is missing; a submit refusal goes to the banner, C31) |
| C31 | components/verification/KycFlow.tsx:565 | Verification submission failed | red line | the failure | error | Try again | done (batch 2) |
| C32 | components/verification/SelfieCapture.tsx:295 | Selfie upload or camera failed | red caption | the failure | error | Try again | done (batch 2) |
| C33 | components/verification/RequestedPhotoPanel.tsx:91 | Requested photo send failed | red caption | the failure | error | Try again | done (batch 2) |
| C34 | components/verification/RequestedPhotoPanel.tsx | Requested photo sent | no word | "Photo sent to the review team" | success | none | done (batch 2) |
| C35 | components/verification/IdCapture.tsx:320 | ID photo refused | error line | the failure | error | Try again | done (batch 2) |
| C36 | components/verification/DocumentUploader.tsx:255 | Document upload failed | red caption | the failure | error | Try again | done (batch 2) |
| C37 | components/verification/DocumentUploader.tsx | Document uploaded | no word | "Document uploaded" | success | none | done (batch 2) |
| C38 | components/verification/DojahPanel.tsx:137 | Identity check failed | red line | the failure | error | Try again | done (batch 2) |
| C39 | components/verification/DojahPanel.tsx:102 | Identity check done | record panel | kept panel + "Identity check sent" | success | none | done (batch 2) |
| C40 | components/app/money/MoneyStepUp.tsx:321 | Money step-up refused | red line | the refusal | error | none | done (batch 2) |
| C41 | components/app/ai/AiConsentSheet.tsx:68 | AI consent not saved | line in the sheet | "Your choice was not saved. Try again." | error | Try again | done (batch 2) |
| C42 | components/app/price/NextActions.tsx:97 | Price alert not saved | red caption | the refusal | error | Try again | done (batch 2) |
| C43 | components/app/price/NextActions.tsx:72 | Price alert saved | inline status block | "Price alert saved" | success | none | done (batch 2) |
| C44 | components/app/push/PushPrompt.tsx:185 | Notifications could not be turned on | red line | the failure | error | Try again | done (batch 2) |
| C45 | components/app/welcome/FirstRun.tsx:878 | First run step not saved | red line | the failure | error | Try again | done (batch 2) |
| C46 | components/app/referral/WithdrawFlow.tsx:196 | Rewards withdrawal refused | red line | the refusal | error | Try again | done (batch 2) |
| C47 | components/app/referral/WithdrawFlow.tsx:142 | Rewards withdrawal requested | record panel | kept panel + "Withdrawal requested" | success | none | done (batch 2) |
| C48 | components/app/referral/RewardsPayoutForm.tsx:47 | Rewards payout account saved | record panel | kept panel + "Payout account saved" | success | none | done (batch 2) |
| C49 | components/app/briefs/BriefComposer.tsx:198 | Brief not posted | red line | the refusal | error | Try again | done (batch 2) |
| C50 | components/app/briefs/BriefComposer.tsx:94 | Brief posted | status line | "Your brief is posted" | success | none | done (batch 2) |
| C51 | components/app/briefs/MyBriefs.tsx:106 | Brief close or change failed | red list item | the refusal | error | Try again | done (batch 2) |
| C52 | components/app/place/ChoicePicker.tsx:223 | Choice required | red caption | its words | error | none | done (batch 2) |
| C53 | components/app/doors/AgentLookupCard.tsx:111 | Agent lookup refused | red caption under the field | its words | error | none | done (batch 2) |
| C54 | components/app/doors/SafetyShareControl.tsx:208 | Safety check answered | green line | "Thanks. Your contact can see you are safe" | success | none | done (batch 2) |
| C55 | components/app/arrival-check/ArrivalRuling.tsx:113 | Arrival ruling outcome | status line | the outcome | success / error | none | done (batch 2) |
| C56 | components/app/inspections/TruthQuestions.tsx:121 | Truth answers not sent | red line | the refusal | error | Try again | done (batch 2) |
| C57 | components/app/inspections/visit/VisitPlanner.tsx:367 | Visit plan refused | problem line | the problem | error | none | done (batch 2) |
| C58 | components/app/inspections/ViewingSheets.tsx:58 | Viewing sheet action refused | red caption | the refusal | error | Try again | done (batch 2) |
| C59 | components/app/inspections/GateHandshake.tsx:386 | Gate warning | warning block | kept: the handshake's own state | warning | n/a | kept |
| C60 | components/app/threads/ReservationFace.tsx:112 | Reservation step refused in a thread | red caption | the refusal | error | Try again | done (batch 2) |
| C61 | components/app/threads/RentalFace.tsx:294 | Rental step refused | red caption | the refusal | error | Try again | done (batch 2) |
| C62 | components/app/threads/RentalFace.tsx:499 | Rental action refused | red caption | the refusal | error | Try again | done (batch 2) |
| C63 | components/app/payments/AddBankAccountSheet.tsx:157 | Bank account name check failed | red line | the refusal | error | Try again | kept (the bank list load failure with its own Try again button inside the sheet; the number field now speaks through Field, A1) |
| C64 | components/app/listing/ListingActions.tsx:385 | Save, share outcome on the listing hero | chip beside the actions | "Saved to your list" / "Removed from your list" / the failure | success / error | Undo on save | done (batch 2) |
| C65 | components/app/ListingCard.tsx:607 | Save on a card | note on the card | "Saved to your list" / the failure | success / error | Undo | done (round 1 already: SaveControl says it in the banner) |
| C66 | components/app/search/MapDock.tsx:241 | Save from the map | red note | the failure | error | Try again | done (batch 2) |
| C67 | components/app/price/ShareAreaButton.tsx:177 | Area link copied | label turns "Copied" | "Link copied" | success | none | done (batch 2) |
| C68 | components/site/MoveInCalculator.tsx:115 | Calculator link copied | label turns "Copied" | "Link copied" | success | none | done (batch 2) |
| C69 | components/ui/ExternalLinkSheet.tsx:127 | External link copied | label turns "Copied" | "Link copied" | success | none | done (batch 2) |
| C70 | components/social/PlacePicker.tsx:264 | Place search failed | red line | the failure | error | Try again | done (batch 3) |
| C71 | components/social/feed/ListingPicker.tsx:115 | Listing picker failed | note | the failure | error | Try again | done (batch 3) |
| C72 | components/social/feed/Composer.tsx:661 | Post not published | red line | the refusal | error | Try again | done (batch 3) |
| C73 | components/social/feed/Composer.tsx:654 | Post waiting (offline) | caption | "Saved on your device. It posts when you're back online" | info | none | done (batch 3) |
| C74 | components/support/PhotoField.tsx:93 | Support photo refused | red caption | the refusal | error | none | done (batch 3) |
| C75 | components/support/PhotoField.tsx:119 | Support photo upload failed | red caption | the failure | error | Try again | done (batch 3) |
| C76 | components/passport/PassportThreadRows.tsx:118 | Passport share change failed | red caption | the failure | error | Try again | done (batch 3) |
| C77 | components/passport/PassportSettings.tsx:101 | Passport setting not saved | red span | the failure | error | Try again | done (batch 3) |
| C78 | components/passport/PassportSettings.tsx | Passport setting saved | no word | "Your passport setting is saved" | success | none | done (batch 3) |
| C79 | components/site/NewsletterForm.tsx:62 | Newsletter email refused | red caption | its words | error | none | done (batch 3) |
| C80 | components/site/NewsletterForm.tsx:33 | Newsletter subscribed | status line replaces the form | kept panel + "You're on the list" | success | none | done (batch 3) |
| C81 | components/app/safety/UnsafeSheet.tsx:154 | Unsafe report filed | record panel in the sheet | kept + "Your report is sent" | success | none | done (batch 3) |
| C82 | components/app/assistant/PersonHandoff.tsx:145 | Handed to a person | record | kept (assistant owner) | n/a | n/a | kept |
| C83 | app/(app)/settings/invite/InviteShare.tsx:30 | Invite link copied | label "Copied" | "Invite link copied" (via A6) | success | none | done (batch 1) |
| C84 | components/app/account/InviteTicket.tsx | Invite code or link copied | label "Copied" | "Invite link copied" (via A6) | success | none | done (already through useCopy) |
| C85 | components/app/listing/ListingCode.tsx:71 | Listing code copied | label "Copied" | "Code copied" (via A6) | success | none | done (batch 1) |
| C86 | components/app/payments/crypto/CryptoPaymentStatus.tsx:124 | Wallet address copied | label "Copied" | "Address copied" (via A6) | success | none | todo |
| C87 | components/app/payments/PaymentMethodsPanel.tsx:250 | Adding a card | status line while it works | kept: progress, not an outcome | n/a | n/a | kept |
| C88 | components/compliance/PepQuestion.tsx:45 | PEP answer saved | "Saved." in the card head | "Your answer is saved" | success | none | done (batch 3) |
| C89 | components/compliance/PepQuestion.tsx:125 | PEP answer refused | caption | the refusal | error | Try again | done (batch 3) |
| C90 | components/compliance/PepQuestion.tsx:84 | PEP field refused | caption under the field | its words | error | none | done (batch 3) |
| C91 | app/(app)/messages/new/FirstMessage.tsx:111 | First message not sent | caption | the refusal | error | Try again | done (batch 3) |
| C92 | app/(app)/messages/share/SharePicker.tsx:251 | Share to a thread failed | red caption | the refusal | error | Try again | done (batch 3) |
| C93 | app/(app)/messages/Inbox.tsx:860 | Inbox action failed | red line | the refusal | error | Try again | done (batch 3) |
| C94 | components/app/messages/StageControl.tsx:150 | Stage change refused | red line | the refusal | error | Try again | done (batch 3) |
| C95 | components/app/messages/StageControl.tsx:270 | Stage change refused (second form) | red line | the refusal | error | Try again | done (batch 3) |
| C96 | components/app/messages/AvailabilityCard.tsx:128 | Availability answer refused | red line | the refusal | error | Try again | done (batch 3) |
| C97 | components/app/messages/ForwardSheet.tsx:139 | Forward refused | red line | the refusal | error | Try again | done (batch 3) |
| C98 | components/app/messages/ShareSheet.tsx:211 | Share failed | red caption | the refusal | error | Try again | kept (the QR could not be drawn, in place of the QR) |
| C99 | app/(app)/messages/[id]/ThreadOptionsSheet.tsx:337 | Thread option failed | alert in the sheet | the refusal | error | Try again | done (batch 3) |
| C100 | components/calls/CallButtons.tsx:122 | Call could not start | note beside the call buttons | the note | error | Try again | done (batch 3) |

## D. Agent workspace (app/agent, components/agent, supply)

| # | File:line | Moment | Today | Banner words | Tone | Retry/Undo | Status |
|---|---|---|---|---|---|---|---|
| D1 | app/agent/reviews/ReplyForm.tsx:75 | Review reply removal refused | warning caption | the refusal | error | Try again | done (batch 3) |
| D2 | app/agent/reviews/ReplyForm.tsx:104 | Review reply refused | field error | its words | error | none | done (batch 3) |
| D3 | app/agent/reviews/ReplyForm.tsx | Review reply posted, removed | the reply shows | "Your reply is posted" / "Your reply is removed" | success | none | done (batch 3) |
| D4 | app/agent/bookings/ReservationsBoard.tsx:85 | Reservation decision refused | red caption | the refusal | error | none | done (batch 3) |
| D5 | app/agent/bookings/ReservationsBoard.tsx | Reservation accepted or declined | refresh only | "Reservation updated" (the decision's own words) | success | none | done (batch 3) |
| D6 | app/agent/listings/[listingId]/calendar/CalendarEditor.tsx:275 | Calendar block or open refused | red alert | the refusal | error | Try again | done (batch 3) |
| D7 | app/agent/listings/[listingId]/calendar/CalendarEditor.tsx:61 | Dates blocked or opened | refresh only | "Dates blocked" / "Dates open again" | success | none | done (batch 3) |
| D8 | app/agent/listings/OwnerAskStrip.tsx:76 | Owner ask refused | red caption | the refusal | error | Try again | done (batch 3) |
| D9 | app/agent/listings/OwnerAskStrip.tsx:36 | Owner asked | green status line | "Request sent to the owner" | success | none | done (batch 3) |
| D10 | app/agent/listings/CloseListingSheet.tsx:112 | Close listing refused | alert in the sheet | the refusal | error | Try again | done (batch 3) |
| D11 | app/agent/portfolio/PortfolioControls.tsx:156 | Pitch refused | red caption | the refusal | error | Try again | done (batch 3) |
| D12 | app/agent/portfolio/PortfolioControls.tsx:121 | Pitch sent | status line replaces the button | "Your pitch is sent" | success | none | done (batch 3) |
| D13 | app/agent/listings/[listingId]/mandate/MandateForm.tsx:72 | Mandate sent | status line replaces the form | "Mandate sent for review" | success | none | done (batch 3) |
| D14 | app/agent/listings/[listingId]/mandate/page.tsx:119 | Mandate renewal refused (record state) | red line on the page | kept: the mandate's recorded state | n/a | n/a | kept |
| D15 | app/agent/earnings/EarningsWorkspace.tsx:88 | Earnings read failed | alert | kept: page state | n/a | n/a | kept |
| D16 | app/agent/analytics/page.tsx:176 | Analytics read failed | alert | kept: page state | n/a | n/a | kept |
| D17 | app/agent/list/ListingWizard.tsx:520 | Listing wizard load error | error block | kept: page state | n/a | n/a | kept |
| D18 | app/agent/list/ListingWizard.tsx:2794 | Wizard notice (draft saved, refused) | note under the step | the notice | per notice | none | todo (ListingWizard notices: field errors done in batch 3, the step notices not yet) |
| D19 | app/agent/list/ListingWizard.tsx:3162 | Photo notice | note under photos | the notice | warning | none | todo (ListingWizard photo notice) |
| D20 | app/agent/list/ListingWizard.tsx:4673 | Publish notice | note at the end | the notice | per notice | none | todo (ListingWizard publish notice) |
| D21 | components/agent/UnitQuestions.tsx:62 | Unit answers not saved | red line | the refusal | error | Try again | done (batch 3) |
| D22 | components/agent/ViewingWindows.tsx:203 | Viewing windows not saved | red line | the refusal | error | Try again | done (batch 3) |
| D23 | components/agent/ViewingWindows.tsx | Viewing windows saved | no word | "Viewing times saved" | success | none | done (batch 3) |
| D24 | components/agent/ApplyWizard.tsx:593 | Documents missing | red caption | its words | error | none | done (batch 3) |
| D25 | components/agent/ApplyWizard.tsx:647 | Terms not agreed | red caption | its words | error | none | done (batch 3) |
| D26 | components/agent/ApplyWizard.tsx:672 | Application refused | alert | the refusal | error | Try again | done (batch 3) |
| D27 | components/agent/ApplyWizard.tsx:879 | Upload refused | red caption | the refusal | error | Try again | done (batch 3) |
| D28 | components/agent/PayoutAccounts.tsx:253 | Payout account check refused | alert | the refusal | error | none | done (batch 3) |
| D29 | components/agent/PayoutAccounts.tsx:343 | Payout account not saved | alert | the refusal | error | Try again | done (batch 3) |
| D30 | components/agent/PayoutAccounts.tsx | Payout account added, removed, made default | refresh only | "Payout account added" / "Payout account removed" / "Default payout account changed" | success | none | done (batch 3) |
| D31 | components/agent/CompoundQuestions.tsx:92 | Compound answers refused | red span | the refusal | error | none | done (batch 3) |
| D32 | components/agent/intel/ConfirmAvailable.tsx:68 | Still available confirmed, or failed | status line under the button | "Marked as still available" / the failure | success / error | Try again | done (batch 3) |
| D33 | components/agent/RespondToReview.tsx:43 | Response sent | record panel | kept panel + "Your response is posted" | success | none | done (round 1 already: banner.error; the record panel stays) |
| D34 | components/supply/UploadCard.tsx:206 | Registration upload refused | red caption | the refusal | error | Try again | done (batch 3) |
| D35 | components/supply/AgentRegisterForm.tsx:540 | Agent registration refused | alert | the refusal | error | Try again | done (batch 3) |
| D36 | components/supply/RegisterShell.tsx:133 | Registration step refused | alert | the refusal | error | none | done (batch 3) |
| D37 | components/legal/WorkspaceAcceptance.tsx:85 | Workspace terms not accepted | red caption | its words | error | none | done (batch 3) |
| D38 | app/agent/promotion, components/promotion/PromotionResults.tsx:41 | Promotion notice (paid, cancelled) | notice block on the results page | the notice title | success / info | none | kept (a page notice that no promotion has run: content) |

## E. Host (app/host, components/host, stays)

| # | File:line | Moment | Today | Banner words | Tone | Retry/Undo | Status |
|---|---|---|---|---|---|---|---|
| E1 | components/host/HostWizard.tsx:696 | Host wizard step refused | red line | the refusal | error | none | done (batch 3) |
| E2 | components/host/HostWizard.tsx:827 | Host wizard notice (saved, sent) | notice block | the notice | success / error | none | done (batch 3) |
| E3 | components/host/HostWizard.tsx:731 | Sent back by review | status panel | kept: the application's recorded state | n/a | n/a | kept (the application's recorded state) |
| E4 | components/host/FacilitiesPicker.tsx:146 | Facilities saved or refused | notice under the picker | "Facilities saved" / the refusal | success / error | Try again | done (batch 3) |
| E5 | components/host/RoomNightsEditor.tsx:177 | Room nights saved or refused | notice | "Room nights saved" / the refusal | success / error | Try again | done (batch 3) |
| E6 | components/host/stays/FacilitiesStep.tsx:200 | Facilities step refused | note | the refusal | error | none | done (batch 3) |
| E7 | components/host/stays/TablesStep.tsx:224 | Tables step refused | red note | the refusal | error | none | done (batch 3) |
| E8 | components/host/stays/HotelStep.tsx:130 | Hotel step refused | note | the refusal | error | none | done (batch 3) |
| E9 | components/host/dashboard/FrontDeskPanel.tsx:188 | Front desk mark refused | red span in the row | the refusal | error | Try again | done (batch 3) |
| E10 | components/host/dashboard/FrontDeskPanel.tsx:92 | Guest checked in, checked out | the row mark changes | "Checked in" / "Checked out" | success | none | done (batch 3) |
| E11 | components/host/reviews/HostReviewCard.tsx:220 | Host review reply refused | red line | the refusal | error | Try again | done (batch 3) |
| E12 | components/stays/DoorChargeReport.tsx:20 | Door charge reported | green line replaces the form | "Report sent. Thank you" | success | none | done (batch 3) |
| E13 | app/host/reservations/DepositSettingsCard.tsx:339 | Deposit settings problem | caption | its words | error | none | done (batch 3) |
| E14 | components/host/StatementView.tsx:79 | Statement read failed | line | kept: page state | n/a | n/a | kept |
| E15 | components/host/reviews/HostReviewsView.tsx:50 | Reviews read failed | line | kept: page state | n/a | n/a | kept |
| E16 | components/host/DecideView.tsx:57 | Decide view read failed | line | kept: page state | n/a | n/a | kept |
| E17 | app/host/bookings/page.tsx:81, app/host/calendar/page.tsx:116 | Read failed | line | kept: page state | n/a | n/a | kept |
| E18 | components/host/calendar/CalendarSync.tsx:99 | Calendar link copied | label turns "Copied" | already bannered | success | none | done (round 1) |

## F. Admin and staff (app/admin, components/compliance, components/calls/admin)

| # | File:line | Moment | Today | Banner words | Tone | Retry/Undo | Status |
|---|---|---|---|---|---|---|---|
| F1 | app/admin/weight-withheld/ClearStamp.tsx:108 | Clear note refused | red line under the form | the refusal | error | none | done (batch 1) |
| F2 | app/admin/retention/DestroyRecords.tsx:126 | Destroy confirmation wrong | red line | its words | error | none | done (batch 1) |
| F3 | app/admin/kyc/IdentityCheckDecision.tsx:91 | Identity decision reason refused | red line | its words | error | none | done (batch 1) |
| F4 | app/admin/kyc/IdentityCheckDecision.tsx:36 | Identity check approved or declined | refresh only | "Identity check approved" / "Identity check declined" | success | none | done (batch 1) |
| F5 | app/admin/kyc/RequestSelfieWithId.tsx:95 | Selfie request message refused | red caption | its words | error | none | done (batch 1) |
| F6 | app/admin/kyc/RequestSelfieWithId.tsx:59 | Selfie with ID requested | refresh only | "Selfie with ID requested" | success | none | done (batch 1) |
| F7 | app/admin/payments/MethodLookup.tsx:122 | Removal reason refused | red line | its words | error | none | done (batch 1) |
| F8 | app/admin/bookings/reservations/ReservationDecisions.tsx:181 | Decision reason refused | red line | its words | error | none | done (batch 1) |
| F9 | app/admin/blocked-terms/TermForms.tsx:157 | Term field refused | red caption | its words | error | none | done (batch 1) |
| F10 | app/admin/blocked-terms/TermForms.tsx:235 | Term form refused | red line | the refusal | error | none | done (batch 3) |
| F11 | app/admin/referrals/ReferralControls.tsx:529 | Referral decision reason refused | red line | its words | error | none | done (batch 1) |
| F12 | app/admin/listings/[id]/ReviewActionBar.tsx:227 | Listing review decision refused | red line | the refusal | error | Try again | done (batch 3) |
| F13 | app/admin/listings/[id]/ReviewActionBar.tsx:226 | "Recording the decision." progress line | line | kept: progress state | n/a | n/a | kept (progress line) |
| F14 | app/admin/listings/MandateDecision.tsx:37 | Mandate approved or rejected | status line replaces the buttons | "Mandate approved" / "Mandate rejected" | success | none | done (batch 3) |
| F15 | app/admin/stops/StopsDesk.tsx:237 | Member trading again | green status line | "{name} is trading again" | success | none | done (batch 3) |
| F16 | app/admin/stops/StopsDesk.tsx:330 | Stop placed | green status line | the line's words | success | none | done (batch 3) |
| F17 | app/admin/stops/RecallPanel.tsx:80 | Recall sent | status line | "Recall sent to {count} people" | success | none | done (round 1 already) |
| F18 | app/admin/settings/SampleEmails.tsx:68 | Sample emails sent | status note | the note | success / error | Try again | done (round 1 already; the running count stays as progress) |
| F19 | app/admin/_lanes/HeldLane.tsx:302 | Held payment decision note | note | the note when it is an outcome | success / error | none | kept (a static note prop, guidance) |
| F20 | app/admin/_review/parts.tsx:155 | Review panel note | note | the note when it is an outcome | per note | none | kept (a static note prop, guidance) |
| F21 | app/admin/compliance/_lanes/SanctionsControls.tsx:75 | Sanctions list file too large | alert | "That file is too large" (its words) | error | none | done (batch 3) |
| F22 | app/admin/compliance/_lanes/StrControls.tsx:403 | STR working | status | kept: progress | n/a | n/a | kept |
| F23 | components/compliance/RiskOverrideForm.tsx:61 | Risk override refused | caption | the refusal | error | none | done (batch 3) |
| F24 | components/compliance/RiskOverrideForm.tsx:56 | Risk override saved | caption | "Risk override saved" | success | none | done (batch 3) |
| F25 | components/compliance/ApproveForm.tsx:50 | EDD approve refused | caption | the refusal | error | none | done (batch 3) |
| F26 | components/compliance/ApproveForm.tsx:45 | EDD approved | caption | "Approved" (the form's own saved words) | success | none | done (batch 3) |
| F27 | components/compliance/EddReviewCard.tsx:119 | EDD review refused | caption | the refusal | error | none | done (batch 3) |
| F28 | components/compliance/EddReviewCard.tsx:109 | EDD review saved | caption | its saved words | success | none | done (batch 3) |
| F29 | components/compliance/PepFlagForm.tsx:61 | PEP flag refused | caption | the refusal | error | none | done (batch 3) |
| F30 | components/compliance/PepFlagForm.tsx:56 | PEP flag saved | caption | its saved words | success | none | done (batch 3) |
| F31 | components/compliance/ReopenEddButton.tsx:24 | EDD reopen refused | caption | the refusal | error | none | done (batch 3) |
| F32 | components/compliance/ReopenEddButton.tsx:19 | EDD reopened | caption | its saved words | success | none | done (batch 3) |
| F33 | components/calls/admin/RequestReviewCall.tsx:164 | Review call request refused | red line | the refusal | error | Try again | done (batch 3) |
| F34 | components/calls/admin/ReviewOutcomeForm.tsx:86 | Review outcome field refused | red line | its words | error | none | done (batch 3) |
| F35 | components/calls/admin/ReviewOutcomeForm.tsx:110 | Review outcome refused | red line | the refusal | error | Try again | done (batch 3) |
| F36 | components/calls/admin/ReviewDesk.tsx:148 | Review desk note | note | the note | per note | none | done (batch 3) |
| F37 | components/calls/admin/ReviewDesk.tsx:259 | Review desk action refused | red line | the refusal | error | Try again | done (batch 3) |
| F38 | components/calls/admin/ReviewDesk.tsx:301 | Review desk action refused | red line | the refusal | error | Try again | done (batch 3) |
| F39 | components/calls/admin/ReviewDesk.tsx:381 | Review desk action refused | red line | the refusal | error | Try again | done (batch 3) |
| F40 | components/calls/SubjectReviewCard.tsx:130 | Subject review refused | red line | the refusal | error | Try again | done (batch 3) |
| F41 | components/calls/SubjectReviewCard.tsx:105 | Subject review saved | status line | its saved words | success | none | done (batch 3) |
| F42 | components/calls/views.tsx:237 | Call view action refused | red line | the refusal | error | Try again | kept (the call screen's own live status over the call) |
| F43 | components/calls/views.tsx:326 | Call view action refused | red line | the refusal | error | Try again | kept (the call screen's own live status) |
| F44 | app/admin/_lanes/SafetyHolds.tsx:28, app/admin/listings/[id]/FeeAcceptancePanel.tsx:23, app/admin/_components/ActingFor.tsx:40, app/admin/compliance/_lanes/{StrLane,PepLane,RiskLane,BeneficialOwnershipLane}.tsx, app/admin/compliance/error.tsx, app/admin/account-recovery/page.tsx:60, app/admin/people/[id]/MemberSections.tsx:42 | Desk could not be read | alert or line in the panel | kept: a page state, the panel has nothing else to show | n/a | n/a | kept |
| F45 | app/admin/compliance/_lanes/SanctionsLane.tsx:77,95,153 | Sanctions list facts (none loaded, list shrank) | alert lines | kept: facts about the list a reviewer must see while working | n/a | n/a | kept |
| F46 | app/(site)/landlord/[token]/ReplyActions.tsx:82 | Landlord reply refused | alert | the refusal | error | Try again | done (batch 1) |
| F47 | app/(site)/landlord/[token]/ReplyActions.tsx:48 | Landlord answered or stopped messages | settled panel | kept panel + "Your answer is sent" / "Messages stopped" | success | none | kept (a ResultScreen replaces the form: the result is its own record) |
| F48 | app/(site)/contact/ContactForm.tsx:176 | Contact form refused | alert | the refusal | error | none | done (batch 1) |
| F49 | app/(site)/check/CheckForm.tsx:77 | Agent check refused | caption | the refusal | error | none | done (batch 1) |

## Kept on purpose (records and page states)

A record panel is the page's own receipt or next step; it stays, and where
the moment had no banner one is added beside it (the banner says it happened,
the panel keeps the record). A page state is what a page shows when its data
could not be read; it is the content, not an action's outcome, and a banner
would leave an empty panel behind.

Listed in the tables with status `kept`; reasons are on each row.

## D. Admin desk actions (audit round 2)

| # | File:line | Moment | Today | Banner words | Tone | Retry/Undo | Status |
|---|---|---|---|---|---|---|---|
| D1 | lib/admin/agreements-actions.ts:41 | decide agreement | silent / inline | per action | success/error | Try again | todo |
| D2 | lib/admin/agreements-actions.ts:70 | save risk settings | silent / inline | per action | success/error | Try again | todo |
| D3 | lib/admin/agreements-actions.ts:86 | set review kill switch | silent / inline | per action | success/error | Try again | todo |
| D4 | lib/admin/agreements-actions.ts:111 | pause release | silent / inline | per action | success/error | Try again | todo |
| D5 | lib/admin/agreements-actions.ts:127 | resume release | silent / inline | per action | success/error | Try again | todo |
| D6 | lib/admin/agreements-actions.ts:163 | resolve held payment | silent / inline | per action | success/error | Try again | todo |
| D7 | lib/admin/agreements-actions.ts:229 | decide claim | silent / inline | per action | success/error | Try again | todo |
| D8 | lib/admin/agreements-actions.ts:273 | mark claim paid | silent / inline | per action | success/error | Try again | todo |
| D9 | lib/admin/blocked-terms-actions.ts:55 | put blocked term | silent / inline | per action | success/error | Try again | todo |
| D10 | lib/admin/blocked-terms-actions.ts:84 | retire blocked term | silent / inline | per action | success/error | Try again | todo |
| D11 | lib/admin/bookings-actions.ts:359 | refund booking as admin | silent / inline | per action | success/error | Try again | todo |
| D12 | lib/admin/bookings-actions.ts:513 | decide reservation as admin | silent / inline | per action | success/error | Try again | todo |
| D13 | lib/admin/business-actions.ts:247 | approve business | silent / inline | per action | success/error | Try again | todo |
| D14 | lib/admin/business-actions.ts:252 | request more info | silent / inline | per action | success/error | Try again | todo |
| D15 | lib/admin/business-actions.ts:260 | reject business | silent / inline | per action | success/error | Try again | todo |
| D16 | lib/admin/business-actions.ts:289 | publish accommodation | silent / inline | per action | success/error | Try again | todo |
| D17 | lib/admin/business-actions.ts:543 | publish restaurant | silent / inline | per action | success/error | Try again | todo |
| D18 | lib/admin/business-actions.ts:650 | record business rung | silent / inline | per action | success/error | Try again | todo |
| D19 | lib/admin/business-actions.ts:797 | record identity check | silent / inline | per action | success/error | Try again | todo |
| D20 | lib/admin/business-actions.ts:802 | record registration check | silent / inline | per action | success/error | Try again | todo |
| D21 | lib/admin/business-actions.ts:807 | record payout check | silent / inline | per action | success/error | Try again | todo |
| D22 | lib/admin/business-actions.ts:812 | record on site check | silent / inline | per action | success/error | Try again | todo |
| D23 | lib/admin/caution-desk-actions.ts:32 | rule caution dispute | silent / inline | per action | success/error | Try again | todo |
| D24 | lib/admin/caution-desk-actions.ts:62 | rule caution return | silent / inline | per action | success/error | Try again | todo |
| D25 | lib/admin/chargeback-actions.ts:95 | open chargeback | silent / inline | per action | success/error | Try again | todo |
| D26 | lib/admin/chargeback-actions.ts:156 | move chargeback | silent / inline | per action | success/error | Try again | todo |
| D27 | lib/admin/chargeback-actions.ts:228 | add chargeback note | silent / inline | per action | success/error | Try again | todo |
| D28 | lib/admin/chargeback-actions.ts:269 | override chargeback hold | silent / inline | per action | success/error | Try again | todo |
| D29 | lib/admin/desk-reads/crash-log-actions.ts:20 | set crash status | silent / inline | per action | success/error | Try again | todo |
| D30 | lib/admin/desk-reads/retention-actions.ts:34 | destroy expired money records | silent / inline | per action | success/error | Try again | todo |
| D31 | lib/admin/desk-reads/weight-withheld-actions.ts:37 | clear weight withheld | silent / inline | per action | success/error | Try again | todo |
| D32 | lib/admin/email-recovery-actions.ts:77 | open email recovery | silent / inline | per action | success/error | Try again | todo |
| D33 | lib/admin/email-recovery-actions.ts:111 | complete email recovery | silent / inline | per action | success/error | Try again | todo |
| D34 | lib/admin/email-recovery-actions.ts:202 | resend recovery notice | silent / inline | per action | success/error | Try again | todo |
| D35 | lib/admin/email-recovery-actions.ts:230 | owner cancel email recovery | silent / inline | per action | success/error | Try again | todo |
| D36 | lib/admin/identity-check-actions.ts:39 | decide identity check | silent / inline | per action | success/error | Try again | todo |
| D37 | lib/admin/key-roster-actions.ts:42 | clear console keys | silent / inline | per action | success/error | Try again | todo |
| D38 | lib/admin/key-roster-actions.ts:68 | set internal account | silent / inline | per action | success/error | Try again | todo |
| D39 | lib/admin/key-roster-actions.ts:96 | mark internal by email | silent / inline | per action | success/error | Try again | todo |
| D40 | lib/admin/kyc-actions.ts:40 | review kyc document | silent / inline | per action | success/error | Try again | todo |
| D41 | lib/admin/kyc-actions.ts:149 | request selfie with id | silent / inline | per action | success/error | Try again | todo |
| D42 | lib/admin/member-actions.ts:18 | add member note | silent / inline | per action | success/error | Try again | todo |
| D43 | lib/admin/moderation-actions.ts:59 | decide held item | silent / inline | per action | success/error | Try again | todo |
| D44 | lib/admin/money-actions.ts:54 | set fee rate | silent / inline | per action | success/error | Try again | todo |
| D45 | lib/admin/notes-actions.ts:22 | add member note | silent / inline | per action | success/error | Try again | todo |
| D46 | lib/admin/payments-actions.ts:59 | retire example listings | silent / inline | per action | success/error | Try again | todo |
| D47 | lib/admin/payments-actions.ts:166 | remove payment method as admin | silent / inline | per action | success/error | Try again | todo |
| D48 | lib/admin/payments-actions.ts:173 | remove bank account as admin | silent / inline | per action | success/error | Try again | todo |
| D49 | lib/admin/person-actions.ts:16 | uphold stop as fraud | silent / inline | per action | success/error | Try again | todo |
| D50 | lib/admin/queue-desk-actions.ts:53 | take row | silent / inline | per action | success/error | Try again | todo |
| D51 | lib/admin/queue-desk-actions.ts:67 | release row | silent / inline | per action | success/error | Try again | todo |
| D52 | lib/admin/queue-desk-actions.ts:79 | bulk act | silent / inline | per action | success/error | Try again | todo |
| D53 | lib/admin/queue-desk-actions.ts:199 | save view | silent / inline | per action | success/error | Try again | todo |
| D54 | lib/admin/queue-desk-actions.ts:213 | delete view | silent / inline | per action | success/error | Try again | todo |
| D55 | lib/admin/recall-actions.ts:38 | send recall | silent / inline | per action | success/error | Try again | todo |
| D56 | lib/admin/reference-actions.ts:79 | save occupation | silent / inline | per action | success/error | Try again | todo |
| D57 | lib/admin/reference-actions.ts:129 | save local government | silent / inline | per action | success/error | Try again | todo |
| D58 | lib/admin/referral-actions.ts:63 | set referral budget | silent / inline | per action | success/error | Try again | todo |
| D59 | lib/admin/referral-actions.ts:109 | decide referral | silent / inline | per action | success/error | Try again | todo |
| D60 | lib/admin/referral-actions.ts:163 | decide payout | silent / inline | per action | success/error | Try again | todo |
| D61 | lib/admin/review-contest-actions.ts:30 | decide review contest | silent / inline | per action | success/error | Try again | todo |
| D62 | lib/admin/staff-actions.ts:52 | acknowledge handbook | silent / inline | per action | success/error | Try again | todo |
| D63 | lib/admin/staff-actions.ts:68 | grant staff | silent / inline | per action | success/error | Try again | todo |
| D64 | lib/admin/staff-actions.ts:108 | revoke staff | silent / inline | per action | success/error | Try again | todo |
| D65 | lib/admin/staff-actions.ts:148 | add to support | silent / inline | per action | success/error | Try again | todo |
| D66 | lib/admin/staff-actions.ts:175 | remove from support | silent / inline | per action | success/error | Try again | todo |
| D67 | lib/admin/standing-actions.ts:59 | grant standing badge | silent / inline | per action | success/error | Try again | todo |
| D68 | lib/admin/standing-actions.ts:150 | revoke standing badge | silent / inline | per action | success/error | Try again | todo |
| D69 | lib/admin/str-actions.ts:45 | open str case | silent / inline | per action | success/error | Try again | todo |
| D70 | lib/admin/str-actions.ts:62 | decide str | silent / inline | per action | success/error | Try again | todo |
| D71 | lib/admin/str-actions.ts:70 | approve str | silent / inline | per action | success/error | Try again | todo |
| D72 | lib/admin/str-actions.ts:86 | record str filing | silent / inline | per action | success/error | Try again | todo |
| D73 | lib/admin/str-actions.ts:98 | link str | silent / inline | per action | success/error | Try again | todo |
| D74 | lib/admin/str-actions.ts:106 | hold str subject | silent / inline | per action | success/error | Try again | todo |
| D75 | lib/admin/str-actions.ts:114 | release str hold | silent / inline | per action | success/error | Try again | todo |
| D76 | lib/admin/str-actions.ts:123 | approve str release | silent / inline | per action | success/error | Try again | todo |
| D77 | lib/admin/support-desk-actions.ts:29 | take ticket | silent / inline | per action | success/error | Try again | todo |
| D78 | lib/admin/support-desk-actions.ts:45 | release ticket | silent / inline | per action | success/error | Try again | todo |
| D79 | lib/admin/support-workbench-actions.ts:59 | send support reply | silent / inline | per action | success/error | Try again | todo |
| D80 | lib/admin/support-workbench-actions.ts:116 | escalate support ticket | silent / inline | per action | success/error | Try again | todo |
| D81 | lib/admin/support-workbench-actions.ts:147 | return support escalation | silent / inline | per action | success/error | Try again | todo |
| D82 | lib/admin/suspension-actions.ts:122 | stop agent trading | silent / inline | per action | success/error | Try again | todo |
| D83 | lib/admin/suspension-actions.ts:194 | lift agent stop | silent / inline | per action | success/error | Try again | todo |
| D84 | lib/admin/verification-actions.ts:54 | record verification check | silent / inline | per action | success/error | Try again | todo |

## E. Agent and host actions (audit round 2)

| # | File:line | Moment | Today | Banner words | Tone | Retry/Undo | Status |
|---|---|---|---|---|---|---|---|
| E1 | lib/agent/bookings-actions.ts:176 | accept booking | silent / inline | per action | success/error | Try again | todo |
| E2 | lib/agent/bookings-actions.ts:224 | decline booking | silent / inline | per action | success/error | Try again | todo |
| E3 | lib/agent/bookings-actions.ts:366 | record stay | silent / inline | per action | success/error | Try again | todo |
| E4 | lib/agent/broadcast-actions.ts:42 | draft from broadcast | silent / inline | per action | success/error | Try again | todo |
| E5 | lib/agent/calendar-actions.ts:73 | block nights | silent / inline | per action | success/error | Try again | todo |
| E6 | lib/agent/calendar-actions.ts:138 | unblock nights | silent / inline | per action | success/error | Try again | todo |
| E7 | lib/agent/duplicate-actions.ts:37 | duplicate listing | silent / inline | per action | success/error | Try again | todo |
| E8 | lib/agent/freshness-actions.ts:16 | confirm listings available | silent / inline | per action | success/error | Try again | todo |
| E9 | lib/agent/listings-actions.ts:205 | save draft | silent / inline | per action | success/error | Try again | todo |
| E10 | lib/agent/listings-actions.ts:678 | add photo | silent / inline | per action | success/error | Try again | todo |
| E11 | lib/agent/listings-actions.ts:941 | remove photo | silent / inline | per action | success/error | Try again | todo |
| E12 | lib/agent/listings-actions.ts:993 | reorder photos | silent / inline | per action | success/error | Try again | todo |
| E13 | lib/agent/listings-actions.ts:1042 | reorder media | silent / inline | per action | success/error | Try again | todo |
| E14 | lib/agent/listings-actions.ts:1170 | add video | silent / inline | per action | success/error | Try again | todo |
| E15 | lib/agent/listings-actions.ts:1332 | remove video | silent / inline | per action | success/error | Try again | todo |
| E16 | lib/agent/listings-actions.ts:1377 | set amenities | silent / inline | per action | success/error | Try again | todo |
| E17 | lib/agent/listings-actions.ts:1434 | set listing access | silent / inline | per action | success/error | Try again | todo |
| E18 | lib/agent/listings-actions.ts:1494 | submit listing | silent / inline | per action | success/error | Try again | todo |
| E19 | lib/agent/listings-actions.ts:1607 | unpublish listing | silent / inline | per action | success/error | Try again | todo |
| E20 | lib/agent/listings-actions.ts:1641 | delete listing | silent / inline | per action | success/error | Try again | todo |
| E21 | lib/agent/payout-actions.ts:67 | resolve payout account | silent / inline | per action | success/error | Try again | todo |
| E22 | lib/agent/payout-actions.ts:99 | add payout account | silent / inline | per action | success/error | Try again | todo |
| E23 | lib/agent/payout-actions.ts:231 | set default payout account | silent / inline | per action | success/error | Try again | todo |
| E24 | lib/agent/payout-actions.ts:275 | remove payout account | silent / inline | per action | success/error | Try again | todo |
| E25 | lib/agent/reviews-actions.ts:72 | reply to review | silent / inline | per action | success/error | Try again | todo |
| E26 | lib/agent/reviews-actions.ts:125 | remove review reply | silent / inline | per action | success/error | Try again | todo |
| E27 | lib/agent/tools-actions.ts:34 | create reply template | silent / inline | per action | success/error | Try again | todo |
| E28 | lib/agent/tools-actions.ts:54 | delete reply template | silent / inline | per action | success/error | Try again | todo |
| E29 | lib/agent/tools-actions.ts:67 | save agent hours | silent / inline | per action | success/error | Try again | todo |
| E30 | lib/host/calendar-actions.ts:126 | set night price | silent / inline | per action | success/error | Try again | todo |
| E31 | lib/host/calendar-actions.ts:167 | set nights closed | silent / inline | per action | success/error | Try again | todo |
| E32 | lib/host/calendar-actions.ts:207 | set nights rooms | silent / inline | per action | success/error | Try again | todo |
| E33 | lib/host/calendar-actions.ts:269 | update rate plan | silent / inline | per action | success/error | Try again | todo |
| E34 | lib/host/calendar-sync-actions.ts:66 | make calendar feed | silent / inline | per action | success/error | Try again | todo |
| E35 | lib/host/calendar-sync-actions.ts:98 | add calendar import | silent / inline | per action | success/error | Try again | todo |
| E36 | lib/host/calendar-sync-actions.ts:123 | remove calendar import | silent / inline | per action | success/error | Try again | todo |
| E37 | lib/host/calendar-sync-actions.ts:140 | set calendar import enabled | silent / inline | per action | success/error | Try again | todo |
| E38 | lib/host/front-desk-actions.ts:24 | mark stay | silent / inline | per action | success/error | Try again | todo |
| E39 | lib/host/review-actions.ts:51 | answer hotel review | silent / inline | per action | success/error | Try again | todo |
| E40 | lib/host/review-actions.ts:73 | withdraw hotel review answer | silent / inline | per action | success/error | Try again | todo |
| E41 | lib/host/review-actions.ts:102 | contest hotel review | silent / inline | per action | success/error | Try again | todo |
| E42 | lib/host/room-booking-actions.ts:102 | accept room request | silent / inline | per action | success/error | Try again | todo |
| E43 | lib/host/room-booking-actions.ts:107 | decline room request | silent / inline | per action | success/error | Try again | todo |
| E44 | lib/landlord/admin-actions.ts:33 | record principal consent | silent / inline | per action | success/error | Try again | todo |
| E45 | lib/landlord/admin-actions.ts:67 | decide property match | silent / inline | per action | success/error | Try again | todo |
| E46 | lib/landlord/admin-actions.ts:87 | split from property | silent / inline | per action | success/error | Try again | todo |
| E47 | lib/landlord/admin-actions.ts:99 | reopen closed listing | silent / inline | per action | success/error | Try again | todo |
| E48 | lib/landlord/close-actions.ts:37 | close listing with reason | silent / inline | per action | success/error | Try again | todo |
| E49 | lib/landlord/close-actions.ts:77 | answer owner heartbeat | silent / inline | per action | success/error | Try again | todo |
| E50 | lib/landlord/portfolio-actions.ts:25 | invite agents | silent / inline | per action | success/error | Try again | todo |
| E51 | lib/landlord/portfolio-actions.ts:40 | withdraw invitation | silent / inline | per action | success/error | Try again | todo |
| E52 | lib/landlord/portfolio-actions.ts:51 | award mandate | silent / inline | per action | success/error | Try again | todo |
| E53 | lib/landlord/portfolio-actions.ts:62 | pitch for mandate | silent / inline | per action | success/error | Try again | todo |

## F. Member actions: money, payments, bookings, saved, social (audit round 2)

| # | File:line | Moment | Today | Banner words | Tone | Retry/Undo | Status |
|---|---|---|---|---|---|---|---|
| F1 | app/(app)/checkout/[bookingId]/saved-card-action.ts:19 | charge saved card for | silent / inline | per action | success/error | Try again | todo |
| F2 | app/(app)/rent/pay/[inspectionId]/saved-card-action.ts:14 | charge rent saved card for | silent / inline | per action | success/error | Try again | todo |
| F3 | lib/after-gate/refund-decision-actions.ts:30 | decline refund request | silent / inline | per action | success/error | Try again | todo |
| F4 | lib/after-gate/refund-request-actions.ts:27 | request refund | silent / inline | per action | success/error | Try again | todo |
| F5 | lib/ai/consent-actions.ts:54 | withdraw ai consent | silent / inline | per action | success/error | Try again | todo |
| F6 | lib/assistant/action-actions.ts:62 | assistant listing photos | silent / inline | per action | success/error | Try again | todo |
| F7 | lib/assistant/action-actions.ts:75 | assistant viewing slots | silent / inline | per action | success/error | Try again | todo |
| F8 | lib/assistant/action-actions.ts:96 | assistant propose viewing | silent / inline | per action | success/error | Try again | todo |
| F9 | lib/assistant/action-actions.ts:121 | assistant save | silent / inline | per action | success/error | Try again | todo |
| F10 | lib/assistant/action-actions.ts:145 | assistant propose cancel viewing | silent / inline | per action | success/error | Try again | todo |
| F11 | lib/assistant/action-actions.ts:160 | assistant move slots | silent / inline | per action | success/error | Try again | todo |
| F12 | lib/assistant/action-actions.ts:180 | assistant propose move | silent / inline | per action | success/error | Try again | todo |
| F13 | lib/assistant/action-actions.ts:218 | assistant decide | silent / inline | per action | success/error | Try again | todo |
| F14 | lib/assistant/action-actions.ts:326 | assistant payment status | silent / inline | per action | success/error | Try again | todo |
| F15 | lib/assistant/action-actions.ts:346 | assistant retry | silent / inline | per action | success/error | Try again | todo |
| F16 | lib/assistant/settings-actions.ts:79 | activate assistant | silent / inline | per action | success/error | Try again | todo |
| F17 | lib/assistant/settings-actions.ts:96 | deactivate assistant | silent / inline | per action | success/error | Try again | todo |
| F18 | lib/assistant/settings-actions.ts:109 | set assistant permission | silent / inline | per action | success/error | Try again | todo |
| F19 | lib/assistant/settings-actions.ts:126 | clear learned preferences | silent / inline | per action | success/error | Try again | todo |
| F20 | lib/assistant/settings-actions.ts:138 | set learned preference | silent / inline | per action | success/error | Try again | todo |
| F21 | lib/calls/review-actions.ts:67 | request review call | silent / inline | per action | success/error | Try again | todo |
| F22 | lib/calls/review-actions.ts:91 | reschedule review call | silent / inline | per action | success/error | Try again | todo |
| F23 | lib/calls/review-actions.ts:111 | start review call | silent / inline | per action | success/error | Try again | todo |
| F24 | lib/calls/review-actions.ts:126 | add review entry | silent / inline | per action | success/error | Try again | todo |
| F25 | lib/calls/review-actions.ts:150 | complete review call | silent / inline | per action | success/error | Try again | todo |
| F26 | lib/calls/review-actions.ts:196 | respond to review call | silent / inline | per action | success/error | Try again | todo |
| F27 | lib/compliance/beneficial-ownership-actions.ts:42 | file listing mandate | silent / inline | per action | success/error | Try again | todo |
| F28 | lib/compliance/beneficial-ownership-actions.ts:80 | decide listing mandate | silent / inline | per action | success/error | Try again | todo |
| F29 | lib/compliance/edd-actions.ts:40 | decide edd review | silent / inline | per action | success/error | Try again | todo |
| F30 | lib/compliance/edd-actions.ts:71 | approve edd decision | silent / inline | per action | success/error | Try again | todo |
| F31 | lib/compliance/edd-actions.ts:89 | reopen edd review | silent / inline | per action | success/error | Try again | todo |
| F32 | lib/compliance/pep-actions.ts:31 | answer pep question | silent / inline | per action | success/error | Try again | todo |
| F33 | lib/compliance/pep-actions.ts:65 | flag pep person | silent / inline | per action | success/error | Try again | todo |
| F34 | lib/compliance/pep-actions.ts:114 | approve pep clear | silent / inline | per action | success/error | Try again | todo |
| F35 | lib/compliance/risk-actions.ts:24 | override risk class | silent / inline | per action | success/error | Try again | todo |
| F36 | lib/compliance/risk-actions.ts:65 | approve risk override | silent / inline | per action | success/error | Try again | todo |
| F37 | lib/compliance/threshold-actions.ts:36 | decide threshold event | silent / inline | per action | success/error | Try again | todo |
| F38 | lib/compliance/threshold-actions.ts:63 | approve threshold decision | silent / inline | per action | success/error | Try again | todo |
| F39 | lib/doors/agent-check-actions.ts:102 | set checkable number | silent / inline | per action | success/error | Try again | todo |
| F40 | lib/doors/safety-actions.ts:25 | create safety share | silent / inline | per action | success/error | Try again | todo |
| F41 | lib/doors/safety-actions.ts:48 | mark safety done | silent / inline | per action | success/error | Try again | todo |
| F42 | lib/doors/safety-actions.ts:60 | stop safety share | silent / inline | per action | success/error | Try again | todo |
| F43 | lib/email/preferences-actions.ts:15 | save email preferences | silent / inline | per action | success/error | Try again | todo |
| F44 | lib/enquiry/followup-actions.ts:52 | set enquiry followup | silent / inline | per action | success/error | Try again | todo |
| F45 | lib/identity/dojah-actions.ts:37 | dojah check ready | silent / inline | per action | success/error | Try again | todo |
| F46 | lib/identity/dojah-actions.ts:51 | start dojah check | silent / inline | per action | success/error | Try again | todo |
| F47 | lib/identity/dojah-actions.ts:80 | dojah check status | silent / inline | per action | success/error | Try again | todo |
| F48 | lib/inspections/handshake-actions.ts:29 | prepare handshake | silent / inline | per action | success/error | Try again | todo |
| F49 | lib/inspections/handshake-actions.ts:60 | name delegate | silent / inline | per action | success/error | Try again | todo |
| F50 | lib/inspections/handshake-actions.ts:91 | answer delegation | silent / inline | per action | success/error | Try again | todo |
| F51 | lib/inspections/no-show-actions.ts:55 | report no show | silent / inline | per action | success/error | Try again | todo |
| F52 | lib/inspections/no-show-actions.ts:70 | dispute no show | silent / inline | per action | success/error | Try again | todo |
| F53 | lib/inspections/no-show-actions.ts:105 | resolve no show | silent / inline | per action | success/error | Try again | todo |
| F54 | lib/inspections/truth-actions.ts:45 | answer truth questions | silent / inline | per action | success/error | Try again | todo |
| F55 | lib/listings/commute-actions.ts:14 | report commute | silent / inline | per action | success/error | Try again | todo |
| F56 | lib/listings/shot-list-actions.ts:23 | set photo slot | silent / inline | per action | success/error | Try again | todo |
| F57 | lib/messages/direct-actions.ts:37 | send direct message | silent / inline | per action | success/error | Try again | todo |
| F58 | lib/messages/message-actions.ts:24 | delete message | silent / inline | per action | success/error | Try again | todo |
| F59 | lib/messages/message-actions.ts:44 | forward message | silent / inline | per action | success/error | Try again | todo |
| F60 | lib/messages/notifications-actions.ts:24 | mark notifications read | silent / inline | per action | success/error | Try again | todo |
| F61 | lib/messages/prefs-actions.ts:48 | pin conversation | silent / inline | per action | success/error | Try again | todo |
| F62 | lib/messages/prefs-actions.ts:56 | mute conversation | silent / inline | per action | success/error | Try again | todo |
| F63 | lib/messages/reaction-actions.ts:40 | set reaction | silent / inline | per action | success/error | Try again | todo |
| F64 | lib/messages/reaction-actions.ts:63 | clear reaction | silent / inline | per action | success/error | Try again | todo |
| F65 | lib/messages/show-me-actions.ts:12 | request show me | silent / inline | per action | success/error | Try again | todo |
| F66 | lib/messages/show-me-actions.ts:33 | answer show me | silent / inline | per action | success/error | Try again | todo |
| F67 | lib/money/arrangement-actions.ts:31 | release held payment | silent / inline | per action | success/error | Try again | todo |
| F68 | lib/money/fund-actions.ts:39 | fund escrow payment | silent / inline | per action | success/error | Try again | todo |
| F69 | lib/money/fund-fallback-actions.ts:43 | switch escrow to card | silent / inline | per action | success/error | Try again | todo |
| F70 | lib/money/member-wallet-actions.ts:110 | open balance account | silent / inline | per action | success/error | Try again | todo |
| F71 | lib/money/member-wallet-actions.ts:245 | prepare withdrawal | silent / inline | per action | success/error | Try again | todo |
| F72 | lib/money/member-wallet-actions.ts:308 | confirm balance movement | silent / inline | per action | success/error | Try again | todo |
| F73 | lib/money/member-wallet-actions.ts:376 | prepare deposit | silent / inline | per action | success/error | Try again | todo |
| F74 | lib/money/member-wallet-actions.ts:412 | confirm deposit paid | silent / inline | per action | success/error | Try again | todo |
| F75 | lib/money/member-wallet-actions.ts:495 | prepare send | silent / inline | per action | success/error | Try again | todo |
| F76 | lib/native/widget-actions.ts:57 | widget token live | silent / inline | per action | success/error | Try again | todo |
| F77 | lib/native/widget-actions.ts:77 | revoke widget tokens | silent / inline | per action | success/error | Try again | todo |
| F78 | lib/passport/passport-actions.ts:33 | save passport settings | silent / inline | per action | success/error | Try again | todo |
| F79 | lib/payments/attempt-actions.ts:40 | release card attempt | silent / inline | per action | success/error | Try again | todo |
| F80 | lib/payments/bank-accounts-actions.ts:124 | resolve bank account | silent / inline | per action | success/error | Try again | todo |
| F81 | lib/payments/bank-accounts-actions.ts:158 | add bank account | silent / inline | per action | success/error | Try again | todo |
| F82 | lib/payments/bank-accounts-actions.ts:328 | set default bank account | silent / inline | per action | success/error | Try again | todo |
| F83 | lib/payments/bank-accounts-actions.ts:401 | remove bank account | silent / inline | per action | success/error | Try again | todo |
| F84 | lib/payments/methods-actions.ts:148 | set default payment method | silent / inline | per action | success/error | Try again | todo |
| F85 | lib/payments/methods-actions.ts:233 | remove payment method | silent / inline | per action | success/error | Try again | todo |
| F86 | lib/payments/methods-actions.ts:314 | start card setup | silent / inline | per action | success/error | Try again | todo |
| F87 | lib/payments/methods-actions.ts:492 | confirm card setup | silent / inline | per action | success/error | Try again | todo |
| F88 | lib/payments/rail-choice-actions.ts:30 | choose payment rail | silent / inline | per action | success/error | Try again | todo |
| F89 | lib/photo-hash/backfill-action.ts:10 | run photo backfill | silent / inline | per action | success/error | Try again | todo |
| F90 | lib/price-check/wizard-actions.ts:86 | wizard price guide | silent / inline | per action | success/error | Try again | todo |
| F91 | lib/pricing/fee-acceptance-actions.ts:58 | quote fee terms | silent / inline | per action | success/error | Try again | todo |
| F92 | lib/pricing/fee-acceptance-actions.ts:73 | accept fee terms | silent / inline | per action | success/error | Try again | todo |
| F93 | lib/pricing/rate-agreement-actions.ts:46 | quote listing rate | silent / inline | per action | success/error | Try again | todo |
| F94 | lib/pricing/rate-agreement-actions.ts:62 | accept listing rate | silent / inline | per action | success/error | Try again | todo |
| F95 | lib/push/devices-actions.ts:51 | revoke push device | silent / inline | per action | success/error | Try again | todo |
| F96 | lib/push/devices-actions.ts:67 | revoke all push devices | silent / inline | per action | success/error | Try again | todo |
| F97 | lib/referral/withdraw-action.ts:16 | withdraw rewards | silent / inline | per action | success/error | Try again | todo |
| F98 | lib/reports/withdraw-action.ts:14 | withdraw my report | silent / inline | per action | success/error | Try again | todo |
| F99 | lib/reservations/deposit-actions.ts:94 | pay reservation deposit | silent / inline | per action | success/error | Try again | todo |
| F100 | lib/reservations/deposit-actions.ts:193 | confirm deposit return | silent / inline | per action | success/error | Try again | todo |
| F101 | lib/reservations/deposit-settings-actions.ts:69 | save deposit settings | silent / inline | per action | success/error | Try again | todo |
| F102 | lib/reservations/seating-actions.ts:77 | seat by code | silent / inline | per action | success/error | Try again | todo |
| F103 | lib/reservations/seating-actions.ts:88 | answer did you dine | silent / inline | per action | success/error | Try again | todo |
| F104 | lib/reservations/seating-actions.ts:102 | leave table review | silent / inline | per action | success/error | Try again | todo |
| F105 | lib/reservations/seating-actions.ts:123 | enter table bill | silent / inline | per action | success/error | Try again | todo |
| F106 | lib/reservations/seating-actions.ts:136 | confirm table bill | silent / inline | per action | success/error | Try again | todo |
| F107 | lib/reservations/seating-actions.ts:190 | resolve seating dispute | silent / inline | per action | success/error | Try again | todo |
| F108 | lib/reservations/seating-actions.ts:222 | pay table bill | silent / inline | per action | success/error | Try again | todo |
| F109 | lib/reservations/seating-actions.ts:307 | confirm table bill return | silent / inline | per action | success/error | Try again | todo |
| F110 | lib/safety/blocks-actions.ts:46 | block user safely | silent / inline | per action | success/error | Try again | todo |
| F111 | lib/safety/blocks-actions.ts:85 | unblock user safely | silent / inline | per action | success/error | Try again | todo |
| F112 | lib/safety/unsafe-actions.ts:33 | feel unsafe | silent / inline | per action | success/error | Try again | todo |
| F113 | lib/saved/collections-actions.ts:33 | create collection | silent / inline | per action | success/error | Try again | todo |
| F114 | lib/saved/collections-actions.ts:50 | delete collection | silent / inline | per action | success/error | Try again | todo |
| F115 | lib/saved/collections-actions.ts:61 | set in collection | silent / inline | per action | success/error | Try again | todo |
| F116 | lib/saved/places-actions.ts:51 | save place | silent / inline | per action | success/error | Try again | todo |
| F117 | lib/saved/places-actions.ts:107 | unsave place | silent / inline | per action | success/error | Try again | todo |
| F118 | lib/saved/places-actions.ts:182 | save stay | silent / inline | per action | success/error | Try again | todo |
| F119 | lib/saved/places-actions.ts:187 | unsave stay | silent / inline | per action | success/error | Try again | todo |
| F120 | lib/saved/places-actions.ts:192 | save restaurant | silent / inline | per action | success/error | Try again | todo |
| F121 | lib/saved/places-actions.ts:197 | unsave restaurant | silent / inline | per action | success/error | Try again | todo |
| F122 | lib/saved/searches-actions.ts:102 | save search | silent / inline | per action | success/error | Try again | todo |
| F123 | lib/saved/searches-actions.ts:179 | rename saved search | silent / inline | per action | success/error | Try again | todo |
| F124 | lib/saved/searches-actions.ts:205 | delete saved search | silent / inline | per action | success/error | Try again | todo |
| F125 | lib/saved/searches-actions.ts:238 | set saved search alert | silent / inline | per action | success/error | Try again | todo |
| F126 | lib/security/device-alert-actions.ts:67 | report not me | silent / inline | per action | success/error | Try again | todo |
| F127 | lib/security/device-alert-actions.ts:119 | end session group | silent / inline | per action | success/error | Try again | todo |
| F128 | lib/security/money-step-up-actions.ts:46 | step up status | silent / inline | per action | success/error | Try again | todo |
| F129 | lib/security/money-step-up-actions.ts:56 | begin money confirm | silent / inline | per action | success/error | Try again | todo |
| F130 | lib/security/money-step-up-actions.ts:73 | finish money confirm | silent / inline | per action | success/error | Try again | todo |
| F131 | lib/security/money-step-up-actions.ts:120 | send fallback code | silent / inline | per action | success/error | Try again | todo |
| F132 | lib/security/money-step-up-actions.ts:131 | confirm with fallback | silent / inline | per action | success/error | Try again | todo |
| F133 | lib/security/money-step-up-actions.ts:184 | begin enrol | silent / inline | per action | success/error | Try again | todo |
| F134 | lib/security/money-step-up-actions.ts:210 | finish enrol | silent / inline | per action | success/error | Try again | todo |
| F135 | lib/security/money-step-up-actions.ts:223 | remove money credential | silent / inline | per action | success/error | Try again | todo |
| F136 | lib/security/sessions-actions.ts:67 | end session | silent / inline | per action | success/error | Try again | todo |
| F137 | lib/security/sessions-actions.ts:104 | end other sessions | silent / inline | per action | success/error | Try again | todo |
| F138 | lib/social/admin-actions.ts:90 | decide area | silent / inline | per action | success/error | Try again | todo |
| F139 | lib/social/admin-actions.ts:198 | decide moderator application | silent / inline | per action | success/error | Try again | todo |
| F140 | lib/social/admin-actions.ts:308 | set area paused | silent / inline | per action | success/error | Try again | todo |
| F141 | lib/social/areas-actions.ts:71 | propose area | silent / inline | per action | success/error | Try again | todo |
| F142 | lib/social/areas-actions.ts:147 | enter place | silent / inline | per action | success/error | Try again | todo |
| F143 | lib/social/areas-actions.ts:197 | join area | silent / inline | per action | success/error | Try again | todo |
| F144 | lib/social/areas-actions.ts:240 | leave area | silent / inline | per action | success/error | Try again | todo |
| F145 | lib/social/areas-actions.ts:269 | apply to moderate | silent / inline | per action | success/error | Try again | todo |
| F146 | lib/social/areas-actions.ts:316 | withdraw moderator application | silent / inline | per action | success/error | Try again | todo |
| F147 | lib/social/bot-actions.ts:270 | summon bot | silent / inline | per action | success/error | Try again | todo |
| F148 | lib/social/follows-actions.ts:73 | toggle follow | silent / inline | per action | success/error | Try again | todo |
| F149 | lib/social/follows-actions.ts:214 | more follows | silent / inline | per action | success/error | Try again | todo |
| F150 | lib/social/posts-actions.ts:93 | drop post | silent / inline | per action | success/error | Try again | todo |
| F151 | lib/social/posts-actions.ts:149 | reply to post | silent / inline | per action | success/error | Try again | todo |
| F152 | lib/social/posts-actions.ts:207 | attach post media | silent / inline | per action | success/error | Try again | todo |
| F153 | lib/social/posts-actions.ts:259 | toggle mark | silent / inline | per action | success/error | Try again | todo |
| F154 | lib/social/posts-actions.ts:315 | toggle repost | silent / inline | per action | success/error | Try again | todo |
| F155 | lib/social/posts-actions.ts:402 | edit post | silent / inline | per action | success/error | Try again | todo |
| F156 | lib/social/posts-actions.ts:464 | remove post | silent / inline | per action | success/error | Try again | todo |
| F157 | lib/social/posts-actions.ts:548 | report post | silent / inline | per action | success/error | Try again | todo |
| F158 | lib/social/posts-actions.ts:602 | report profile | silent / inline | per action | success/error | Try again | todo |
| F159 | lib/social/posts-actions.ts:683 | block user | silent / inline | per action | success/error | Try again | todo |
| F160 | lib/social/posts-actions.ts:687 | unblock user | silent / inline | per action | success/error | Try again | todo |
| F161 | lib/social/posts-actions.ts:692 | mute target | silent / inline | per action | success/error | Try again | todo |
| F162 | lib/social/posts-actions.ts:715 | unmute target | silent / inline | per action | success/error | Try again | todo |
| F163 | lib/social/profiles-actions.ts:69 | save social profile | silent / inline | per action | success/error | Try again | todo |
| F164 | lib/social/profiles-actions.ts:215 | set social cover | silent / inline | per action | success/error | Try again | todo |
| F165 | lib/social/stories-actions.ts:57 | publish story | silent / inline | per action | success/error | Try again | todo |
| F166 | lib/social/stories-actions.ts:118 | toggle story mark | silent / inline | per action | success/error | Try again | todo |
| F167 | lib/social/stories-actions.ts:175 | comment on story | silent / inline | per action | success/error | Try again | todo |
| F168 | lib/social/stories-actions.ts:225 | report story comment | silent / inline | per action | success/error | Try again | todo |
| F169 | lib/social/stories-actions.ts:286 | delete story comment | silent / inline | per action | success/error | Try again | todo |
| F170 | lib/social/stories-actions.ts:329 | toggle story comment like | silent / inline | per action | success/error | Try again | todo |
| F171 | lib/social/stories-actions.ts:390 | remove story | silent / inline | per action | success/error | Try again | todo |
| F172 | lib/stays/arrival-actions.ts:30 | declare arrival charges | silent / inline | per action | success/error | Try again | todo |
| F173 | lib/stays/arrival-actions.ts:75 | report door charge | silent / inline | per action | success/error | Try again | todo |
| F174 | lib/stays/arrival-check-actions.ts:37 | answer arrival check | silent / inline | per action | success/error | Try again | todo |
| F175 | lib/stays/arrival-check-actions.ts:73 | rule arrival check | silent / inline | per action | success/error | Try again | todo |
| F176 | lib/stays/room-booking-actions.ts:63 | request room stay | silent / inline | per action | success/error | Try again | todo |
| F177 | lib/supply/registration-actions.ts:105 | submit supply registration | silent / inline | per action | success/error | Try again | todo |
| F178 | lib/tenancy/review-actions.ts:20 | submit tenancy review | silent / inline | per action | success/error | Try again | todo |
| F179 | lib/tenancy/share-actions.ts:49 | add rent contributor | silent / inline | per action | success/error | Try again | todo |
| F180 | lib/tenancy/share-actions.ts:87 | remove rent contributor | silent / inline | per action | success/error | Try again | todo |
| F181 | lib/tenancy/share-actions.ts:106 | answer rent share | silent / inline | per action | success/error | Try again | todo |

## G. Page-level actions (audit round 2)

| # | File:line | Moment | Today | Banner words | Tone | Retry/Undo | Status |
|---|---|---|---|---|---|---|---|
| G1 | app/(app)/checkout/[bookingId]/saved-card-action.ts:19 | charge saved card for | silent / inline | per action | success/error | Try again | todo |
| G2 | app/(app)/messages/[id]/card-actions.ts:43 | resolve live card | silent / inline | per action | success/error | Try again | todo |
| G3 | app/(app)/rent/pay/[inspectionId]/saved-card-action.ts:14 | charge rent saved card for | silent / inline | per action | success/error | Try again | todo |
| G4 | components/app/messages/media-actions.ts:57 | save media | silent / inline | per action | success/error | Try again | todo |
| G5 | components/app/messages/media-actions.ts:83 | share media | silent / inline | per action | success/error | Try again | todo |

## Also built beyond the rows (batch 3)

ProfileEditor (handle, bio, pronouns, link, home area: red edge + banner),
ListingWizard field errors (the shared field wrapper, size, floor, amenities,
power hours, tenure), TermForms (term, reason, refusal), ChargebackActions
fields, ShareAreaButton and PriceCheckScreen failures ("notify me" saved or
refused), MoveInCalculator fields, HostReviewCard (answer posted, removed,
contest sent), PortfolioControls withdraw ("Invitation withdrawn").

## The guard (job 3)

`apps/web/src/lib/ui/no-inline-outcome.test.ts` with
`apps/web/src/lib/ui/inline-outcomes.ts`: fails when a page or component
gains `role="alert"` or a line in the error ink outside its allow-list, and
fails when an allowed file drops one until its row comes down. Rows marked
TO CONVERT NEXT there are outcomes still waiting: PhoneField's live hint,
SupportChat's escalation line, VninPanel's message.

## Left for the next pass

- D18 to D20 ListingWizard step, photo and publish notices.
- PhoneField, SupportChat, VninPanel (in the guard as TO CONVERT NEXT).
- A field refused twice with the very same words re-says it only where the
  caller passes `when` (a `useActionState` answer); client-side checks that
  set the same string twice stay quiet the second time (the red edge stays).
- The audit round 2 rows (sections D to G after "Kept on purpose", found by
  the lead per server action) are not ticked here: many of their callers
  were built in batches 1 to 3 (for example payout accounts, review replies,
  front desk marks, blocks, passport settings, briefs, calendar blocks), so
  the next pass should tick those against the code first, then build the
  rest. Their IDs repeat the letters of sections A to F; name them "R2-D14"
  and so on in hand-offs to avoid confusion.

