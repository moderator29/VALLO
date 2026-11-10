# Store privacy answers: Apple App Privacy and Google Play Data safety

Derived from the code on 24 September 2026 (branch fix/a4), not from memory.
Each answer names the code or table it comes from, so the next change to what
is collected changes this file in the same commit. The privacy notice
(`apps/web/src/lib/legal/privacy.tsx`, version 2026-09-24) says the same
things in prose. **If this file and the notice ever disagree, the store forms
are wrong. Stop and reconcile before submitting.** A mismatch on Play's Data
safety form is grounds for suspension.

## Re-verified 6 October 2026 (directive D41): the two answers that move

**A wrong privacy answer is both a rejection risk and a compliance problem.**
Apple and Google each compare the form against what the build does and against
the privacy policy, and a mismatch can reject the submission or, on Play,
suspend the listing. Separately, a data type that is collected but not
declared is an inaccurate statement to the people whose data it is, which is a
transparency problem under data protection law (the NDPA 2023, Nigeria's data
protection statute; see `docs/LEGAL_AND_NDPC_READINESS.md`). Treat both as a
correctness issue, not as form-filling.

1. **Diagnostics > Performance Data is YES, not linked to the user, not used
   for tracking, purpose App Functionality (Apple); App info and performance >
   Diagnostics is YES (Play).** Verified: the table `public.web_vitals_samples`
   exists, created in
   `supabase/migrations/20260928225532_v80_speed_measured_on_the_phones_people_actually_use.sql:23`.
   Its columns are `route`, `metric` (LCP, INP, CLS, FCP, TTFB), `value`,
   `effective_type`, `save_data`, `transfer_kb` and `at`, and it has **no user
   id column** (lines 23 to 32), which is why "not linked" holds. A purge
   deletes rows older than 30 days (same file, line 103). Written by
   `apps/web/src/app/api/vitals/route.ts`. The iOS privacy manifest already
   lists `NSPrivacyCollectedDataTypePerformanceData`
   (`apps/web/ios/App/App/PrivacyInfo.xcprivacy:216`). An older revision of the
   answer in the native audit said No; the rows below already say Yes.
2. **Diagnostics > Crash Data (Apple) and Crash logs (Play) are NO today, and
   are YES the day `SENTRY_DSN` is set in Vercel Production.** The code
   (`apps/web/src/lib/observability/report.ts`) sends nothing while it is
   unset (`docs/ENVIRONMENT.md:133`). Whether it is set right now is UNKNOWN
   from the repository: the last recorded reading was NOT SET (`docs/THE_AUDIT.md:49`,
   23 September; the native audit repeated it on 28 September). The founder
   must read Vercel Production on submission day. If it is set, answer Yes on
   both forms AND add `NSPrivacyCollectedDataTypeCrashData` (not linked, App
   Functionality) to `PrivacyInfo.xcprivacy`, in the same change.

**A mismatch this file cannot fix.** The privacy notice
(`apps/web/src/lib/legal/privacy.tsx`) has no mention of page speed samples,
performance measurement or diagnostics (a search for "speed", "performance",
"page load" and "diagnostic" finds nothing in it), yet this file now declares
them to both stores. The rule below says that when the notice and these forms
disagree the forms are wrong; here the forms are right about the code and the
notice is the one that is short. The notice needs a sentence, and
`PRIVACY_VERSION` (`apps/web/src/lib/legal/versions.ts:41`, currently
`2026-09-25`) moves with it. That edit is outside this file and is a legal
wording decision for the founder and counsel. Also note: the header of this
file says notice version 2026-09-24, while the code says 2026-09-25.

Facts that apply to every row:

- **Tracking: NO, for every data type.** There is no advertising SDK, no IDFA
  or Android advertising ID, no third-party analytics, and no data is shared
  with data brokers (`grep -rn -i "firebase-analytics\|mixpanel\|segment\.io\|gtag(\|fbq(\|googletagmanager\|posthog\|@vercel/analytics" apps/web/src apps/web/package.json` finds no SDK, only unrelated prose). So on iOS there is no App
  Tracking Transparency prompt and no `NSUserTrackingUsageDescription`.
- **Encrypted in transit: YES.** HTTPS only, HSTS with preload (`next.config.ts`
  headers), `cleartext: false` in the shell.
- **Deletion: YES.** In the app: Settings → Account → Delete my account. On the
  web, with no install and no sign-in needed: `https://www.vallospaces.com/delete-account`.
  Some data is kept after deletion for legal reasons, and Play's form allows
  for that:
  - Transaction records are kept for five years with the name and contact
    details removed.
  - An approved agent's identification is kept for five years under the AML
    rules.

  The notice (§7) and `/delete-account` say both.
- **Processors are service providers, not "sharing".** Supabase, Vercel,
  Paystack, Resend, Anthropic, OpenFreeMap, FCM/APNs and Sentry process
  data on our instructions. Under Play's definitions that is not sharing.
  Showing your booking details to the lister you booked with is a transfer the
  user starts, which Play also exempts. **So "Shared" is NO for every type.**

---

## Part A: Apple App Store Connect → App Privacy

### Q1. "Do you or your third-party partners collect data from this app?"
**Yes, we collect data from this app.**

### Q2. The data types we collect, with the three follow-up questions for each

For each type Apple asks: (a) how it is used, (b) is it linked to the user's
identity, (c) is it used for tracking. **(c) is No for every row.**

| Apple category → type | Collected? | (a) Purposes to tick | (b) Linked to the user? | Where in the code |
|---|---|---|---|---|
| Contact Info → **Name** | Yes | App Functionality | Yes | `profiles.first_name/surname/display_name`, `agent_applications.full_name` |
| Contact Info → **Email Address** | Yes | App Functionality, Customer Support | Yes | `auth.users.email`, `support_tickets.email` |
| Contact Info → **Phone Number** | Yes | App Functionality | Yes | `profiles.phone` (optional), `agent_applications.phone` |
| Contact Info → **Physical Address** | Yes | App Functionality | Yes | `agent_applications.residential_address` (agents), the address of a listed property |
| Contact Info → Other User Contact Info | No | | | |
| Health & Fitness (both) | No | | | |
| Financial Info → **Payment Info** | Yes | App Functionality | Yes | `payment_methods` keeps Paystack's card token, card type, last four digits and expiry. The full card number never reaches us. |
| Financial Info → Credit Info | No | | | |
| Financial Info → **Other Financial Info** | Yes | App Functionality | Yes | `payout_accounts` (the bank account a lister's share and Guarantee payouts go to), `transactions` with each payment's split, `deal_agreements`, `guarantee_claims`. No wallet or balance is kept (Track A, 25 September 2026). |
| Location → **Precise Location** | Yes | App Functionality | Yes | Listing and stay pin from "use my location"; `price_check_watches.lat/lng` (3 decimals, about 110 m, which Apple counts as precise). Only when the person taps; never in the background. |
| Location → Coarse Location | No | | | State and local government are typed or picked by the person, not derived from the device. That is User Content, not Location. |
| Sensitive Info | No | | | Nothing about race, religion, health, sexuality, politics, biometrics or genetics is collected. |
| Contacts | No | | | No address-book access (no `NSContactsUsageDescription`). |
| User Content → **Emails or Text Messages** | Yes | App Functionality | Yes | In-app messages between members (`messages`). |
| User Content → **Photos or Videos** | Yes | App Functionality | Yes | Listing photos and walkthrough videos, avatars and covers, photos sent in a thread, post and story media. |
| User Content → Audio Data | No | | | The only sound is in a walkthrough video, which is already declared under Photos or Videos. Nothing records audio on its own. |
| User Content → Gameplay Content | No | | | |
| User Content → **Customer Support** | Yes | Customer Support | Yes | `support_tickets`, the support chat |
| User Content → **Other User Content** | Yes | App Functionality | Yes | posts, comments, stories, reviews, listings' descriptions, questions typed to the AI assistant (`ai_conversations`), bio |
| Browsing History | No | | | |
| Search History | **Yes** | App Functionality | Yes | `saved_searches`, `price_check_events` (area and property searched) |
| Identifiers → **User ID** | Yes | App Functionality | Yes | the account id |
| Identifiers → **Device ID** | Yes | App Functionality | Yes | `push_tokens` (APNs or FCM token, if notifications are on); `known_devices.fingerprint` (a code derived from the device, used for new-sign-in warnings) |
| Purchases → **Purchase History** | Yes | App Functionality | Yes | bookings, reservations, payments |
| Usage Data → **Product Interaction** | **Yes** | Analytics | Yes | `price_check_events.stage` records how far a person got in the price check. This is the only usage record. Declare it; do not answer "no usage data". |
| Usage Data → Advertising Data | No | | | |
| Usage Data → Other Usage Data | No | | | |
| Diagnostics → **Crash Data** | **No while `SENTRY_DSN` is unset; Yes the day it is set** (current state UNKNOWN, see the 6 October note above; last recorded reading NOT SET) | App Functionality | **No** | `lib/observability/report.ts` scrubs identifiers before sending. Read Vercel Production on submission day, answer to match, and change it the day it is switched on. |
| Diagnostics → **Performance Data** | **Yes** | App Functionality | **No** | `web_vitals_samples` (migration `20260928225532_v80_...sql:23`): page speed figures (route template, metric, connection type), no user id column, purged after 30 days. Collected in the app too. Corrected 30 September 2026 (C15) and re-verified 6 October; the iOS privacy manifest says the same (`PrivacyInfo.xcprivacy:216`). |
| Diagnostics → Other Diagnostic Data | No | | | |
| Surroundings, Body | No | | | |
| Other Data → **Other Data Types** | Yes | App Functionality | Yes | Government ID and NIN, business registration documents (agents and hosts); occupation and interests (optional, on the profile) |

### Q3. "Does your app use data for tracking?"
**No.**

### The privacy policy URL
`https://www.vallospaces.com/privacy`

### Things to know on submission day
- **Third-party AI (guideline 5.1.2(i)).** Say in the review notes: "The in-app
  assistant and support chat use Anthropic. The app discloses this and asks
  for agreement before the first message. Without agreement nothing is sent,
  and the server refuses. Support by a person, with no AI, is at /contact."
- **Sign-in.** Email and password only (Google is off, and Sign in with Apple
  turns on only when configured), so guideline 4.8 does not apply.

---

## Part B: Google Play Console → App content → Data safety

### Section 1: Data collection and security

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **Yes** |
| Is all of the user data collected by your app encrypted in transit? | **Yes** |
| Do you provide a way for users to request that their data is deleted? | **Yes.** In the app, and at `https://www.vallospaces.com/delete-account` |

### Section 2: Data types

For each type Play asks: **Collected?** / **Shared?** (No for every row; see
the top of this file) / **Processed ephemerally?** (No for every row: all of it
is stored) / **Required or optional?** / **Purposes**.

| Play category → type | Collected | Required / optional | Purposes to tick |
|---|---|---|---|
| Location → Approximate location | **No** | | |
| Location → **Precise location** | Yes | Optional (only when the person taps "use my location" or saves a price-check spot) | App functionality |
| Personal info → **Name** | Yes | Required | App functionality, Account management |
| Personal info → **Email address** | Yes | Required | App functionality, Account management, Developer communications |
| Personal info → **User IDs** | Yes | Required | App functionality, Account management |
| Personal info → **Address** | Yes | Optional (agents and listers only) | App functionality |
| Personal info → **Phone number** | Yes | Optional | App functionality, Account management |
| Personal info → Race and ethnicity, Political or religious beliefs, Sexual orientation | **No** | | |
| Personal info → **Other info** | Yes | Optional | App functionality, Fraud prevention, security and compliance (Government ID / NIN, business registration, occupation) |
| Financial info → **User payment info** | Yes | Optional (only if a card is saved) | App functionality (Paystack card token, last four digits) |
| Financial info → **Purchase history** | Yes | Optional | App functionality |
| Financial info → Credit score | **No** | | |
| Financial info → **Other financial info** | Yes | Optional | App functionality (payment splits, agreements, Guarantee claims, payout bank account) |
| Health and fitness (both) | **No** | | |
| Messages → Emails | **No** | | We send emails. We do not read the user's email. |
| Messages → SMS or MMS | **No** | | |
| Messages → **Other in-app messages** | Yes | Optional | App functionality |
| Photos and videos → **Photos** | Yes | Optional | App functionality |
| Photos and videos → **Videos** | Yes | Optional | App functionality |
| Audio → Voice or sound recordings / Music / Other audio | **No** | | Video sound is part of Videos. |
| Files and docs → **Files and docs** | Yes | Optional (agents and hosts) | App functionality, Fraud prevention, security and compliance (identity and business documents) |
| Calendar | **No** | | |
| Contacts | **No** | | |
| App activity → **App interactions** | Yes | Optional | Analytics (price-check steps, `price_check_events`) |
| App activity → **In-app search history** | Yes | Optional | App functionality (saved searches, price-check areas) |
| App activity → Installed apps | **No** | | |
| App activity → **Other user-generated content** | Yes | Optional | App functionality (posts, reviews, listings, questions to the AI assistant) |
| App activity → Other actions | **No** | | |
| Web browsing → Web browsing history | **No** | | |
| App info and performance → **Crash logs** | Yes if `SENTRY_DSN` is set at submission, otherwise No | Optional | App functionality |
| App info and performance → **Diagnostics** | **Yes** (corrected 30 September 2026, C15: page speed samples) | Required | Analytics, App functionality |
| Device or other IDs → **Device or other IDs** | Yes | Optional | App functionality, Fraud prevention, security and compliance (FCM token; new-device fingerprint) |

### Section 3: Security practices (shown on the listing)
- Data is encrypted in transit: **Yes**
- You can request that data be deleted: **Yes**
- Committed to Play Families Policy: **No** (18+ only; see the Terms)
- Independent security review: **No**

### Other Play declarations that must agree with this
- **Financial features:** Vallo holds no money (Track A). Customer funds in the wallet are held by our licensed payments provider. Digital wallet: **yes**, provided through our licensed payments provider. Counsel to confirm this declaration before submission.
  P2P transfer: **no**. Payments for rentals and stays through a licensed
  processor, split at the moment of payment: yes. Crypto: no. Loans: no.
- **Target audience:** 18 and over.
- **Ads:** "No, my app does not contain ads."

---

## When to change this file
Change this file in the same commit as any of the following:
- a new table or column holding personal data;
- a new third-party host in `apps/web/src`;
- a new permission in `Info.plist` or `AndroidManifest.xml`;
- Sentry being switched on or off.

`apps/web/src/lib/legal/privacy-truth.test.ts` fails if the code starts
calling a processor the notice does not name. It does not read this file:
reconciling this file is the job of the person who makes the change.

---

## If Vallo adds advertising later

Nothing below applies today. The app has no advertising SDK, no advertising identifier and no tracking, so the answers above stay as they are. Before any ad SDK, attribution tool or advertising identifier is added, the following must change in the same release:

- **Apple:** Q3 becomes **Yes**. Add Advertising Data and Device ID with the purpose Developer's Advertising or Marketing. Request App Tracking Transparency and add `NSUserTrackingUsageDescription`.
- **Google Play:** declare the advertising ID under Data safety, and update the ads declaration in App content.
- **Privacy notice** (`apps/web/src/lib/legal/privacy.tsx`) and this file must describe the same data, purposes and partners.
- **Review notes:** say which SDK does what, and that the user can refuse tracking.

Declaring advertising or tracking before it exists is also a mismatch, so do not pre-declare it.

---

## Apple App Privacy as submitted (9 October 2026)

This is what App Store Connect shows as published. It does **not** match the
answers above, and it must not be treated as correct.

**Linked to you (as submitted):** Financial Info; Location (Precise);
User Content; Contact Info (Name, Email, Phone, Physical Address).

**Not linked to you (as submitted):** Location (Coarse); Identifiers;
Usage Data; Diagnostics; Search History; Browsing History.

**Mismatches with the answers above, to fix before the next publish:**
- **Advertising Data** and the purposes **Developer's Advertising or
  Marketing** are listed. The app has no advertising.
- **Coarse Location, Audio Data, Browsing History, Other Usage Data** are
  listed. The answers above say No for each.
- **Analytics** and **Product Personalization** are listed for most types.
  Only Product Interaction is Analytics; everything else is App Functionality
  (Customer Support for email and support).
- **Other Financial Info, Purchase History, Other User Content and Other Data
  Types** are missing. The answers above say Yes for each.
- **Other Purposes** is listed for email and support.
- **Device ID, User ID, Search History and Product Interaction** are under
  "not linked". The answers above say linked for User ID, Device ID and
  Search History, and Product Interaction is linked too.

Tracking is No for every type in both places. Counsel should confirm the
final answers against the privacy notice before the next publish.
