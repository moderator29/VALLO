# DOCUMENTATION COVERAGE (Agent DOCS, 11 November 2026)

The platform-wide documentation sweep (`DOCS_AND_PRESENCE_UPGRADE.md` 8C,
`OFFERS_AND_DEAL_ROOM.md` 13). The machine-checked source of this table is
`apps/web/src/lib/docs/coverage.ts`; `apps/web/src/lib/docs/coverage.test.ts`
fails when a page exists in the app or the page ledger with no entry here, when
an entry names a page that is gone, when a documentation entry points at a page
that does not exist, and when a document button points at a route that does
not exist. Add a page to the app and you add a line to `coverage.ts` in the
same change.

## How "true" was checked

Three levels, stated plainly so nobody reads more into a date than it earns:

| Level | Meaning | Pages |
|---|---|---|
| A. Written 11 Nov from source | Written this pass from the screen's own source: its route header comment, the modules holding its words and rules (imported, not retyped). Carries a "Last updated" date. NOT exercised in a browser or against a live account (none exists here). | The 20 new chapters, the 9 staff manual pages |
| B. Corrected 11 Nov | An existing chapter whose claims contradicted the code or the money rules, fixed. Dated only where wholly re-read. | `paying-on-vallo`, `refunds-and-cancellations` (escrow section), `agreements-and-paying`, `for-owners`, `facts.ts` and every sentence built from it (help, FAQ, guides) |
| C. Existing, not re-verified line by line | The other 22 existing chapters, the five guides, the help answers. They were searched for stale terms (payment-rail claims, retired products, foreign mailboxes, `example.com`) and none was found beyond B, but they were not each re-read against their screens. They carry NO "Last updated" date on purpose. | the rest |

## What changed because the code is right (stale words fixed)

1. **Protected payment was described as available.** `facts.ts` said rent and
   shortlets "choose Escrow, which is selected for you, or Pay by card" and that
   "a sale is always paid through escrow". The code says the live rail is
   `direct` (`lib/money/rails.ts`, `LIVE_RAIL`), protected payment is not live
   (`lib/money/copy.ts`), and a purchase takes no money through Vallo
   (`OFFERS_AND_DEAL_ROOM.md` 7). Reworded: today, card through the payment
   partner; protected payment is "not live yet" and drawn in a "not live" callout;
   a purchase is not paid through Vallo. The constant `SALE_IS_ESCROW` was
   renamed `SALE_TAKES_NO_MONEY` everywhere (it no longer meant what it said).
   This flows to the help answers, the FAQ and the guides, which import the constants.
2. `paying-on-vallo`: the "Pay with Escrow" section became "Protected payment (not
   live yet)" with its diagram labelled "designed to move"; the list of how each
   deal is paid and the lister payout lines were corrected to match.
3. `agreements-and-paying` and `for-agents`/`for-owners` summary lines no longer
   say "paying with Escrow or by card".
4. The old contents rail (`OnThisPage`) and the old search field (`DocsSearch`) and
   the `.nf-guides`/`.nf-guide-card` and `.nf-doc-rail*` styles were deleted:
   replaced by `DocToc`, the search sheet and `DocCards`. Nothing referenced them.

## Findings I did NOT change (decisions for the lead or the founder)

- **Staff handbook text** (`lib/admin/staff-handbook.ts`) says "never describe a
  wallet, a balance or escrow". A Wallet screen exists (`/wallet`), showing money a
  licensed partner holds. Changing the handbook needs a version bump and every
  staff member's re-acknowledgement, so it is a founder call.
- **Fees**: `app/admin/fees` says every rate is zero today by the owner's
  decision; `docs/facts.ts` states a hotel commission of 10 percent, with a note
  that it lives in `scoped_commission_rates`. I could not read the live rates here.
  The fee calculator reads `fee_rates` at request time, so it shows whatever is
  real; the typed 10 percent in `facts.ts` is the one figure still typed by hand.
- **Contact address**: `SUPPORT_EMAIL` (`lib/support-email.ts`) is null unless an
  environment variable is set, and the `/contact` page, which is not in my paths,
  prints that mailbox only when set. Every document of mine uses the one constant
  `lib/docs/contact.ts` (`hello@vallospaces.com`). `/contact` should import it.
- **Pending SQL**: Roommates (`roommates_*.sql`) and Offers (`offers_*.sql`) are in
  `supabase/migrations/pending/`. Their documentation describes the feature as it
  will be once applied; publish the two together.
- **Ledger rows for pages that no longer exist**: `/around/manage`,
  `/profile/setup/firm`, `/sign-up/phone` (listed in `RETIRED_IN_LEDGER`).

## Known gaps (the test caps these at 3 routes)

| Route | Why |
|---|---|
| `/pay/crypto/[reference]` | A page exists for notification deep links; no member flow in the docs offers crypto. The founder should say whether it is offered. |
| `/calls/reviews`, `/calls/reviews/[id]` | Review call invitations for the person a case is about. Needs a short section in Trust and safety. |

## Route to documentation map

Every page in the app (298 at the time of writing, 275 in the ledger).

| Pages | Status | Where documented, or why none is needed |
|---|---|---|
| `/about`, `/careers`, `/community`, `/cancellations`, `/disclaimer`, `/eula`, `/legal/disclaimer`, `/legal/privacy`, `/legal/terms`, `/privacy`, `/terms`, `/standards`, `/safety`, `/host-agreement`, `/docs`, `/docs/[slug]`, `/guides`, `/guides/[slug]`, `/help`, `/ai/permissions`, `/ai/privacy`, `/ai/security`, `/ai/terms`, `/delete-account`, `/support`, `/settings/help` | needs none | These pages ARE the written surface: the documents, policies and their indexes. |
| `/styleguide` | needs none | Internal or developer-only surface, not met by a member. |
| `/auth/callback`, `/offline`, `/first-run/[feature]`, `/sign-in/email`, `/sign-in/phone`, `/sign-up/finish`, `/welcome` | needs none | Page plumbing a member passes through without a decision: a callback, a code step, the offline card, a first-run card. |
| `/`, `/sign-in`, `/sign-in/code`, `/sign-up`, `/sign-up/email`, `/sign-up/verify`, `/forgot-password`, `/forgot-password/code`, `/reset-password`, `/home`, `/profile`, `/profile/application`, `/profile/setup`, `/profile/setup/[role]`, `/profile/setup/agent`, `/profile/setup/owner` | documented | `/docs/getting-started` |
| `/contact` | documented | `/docs/getting-around` |
| `/settings`, `/settings/accessibility`, `/settings/account`, `/settings/appearance`, `/settings/devices`, `/settings/devices/alert`, `/settings/interests`, `/settings/passcode`, `/settings/passport`, `/settings/payments`, `/settings/phone`, `/settings/place`, `/settings/privacy`, `/settings/privacy/ai`, `/settings/privacy/blocked`, `/settings/privacy/data`, `/settings/privacy/money-lock`, `/settings/region`, `/settings/standing` | documented | `/docs/settings` |
| `/assistant`, `/assistant/person`, `/settings/ai-assistant`, `/settings/ai-assistant/consent`, `/agent/assistant`, `/host/assistant` | documented | `/docs/ai-assistant` |
| `/notifications`, `/notifications/[id]`, `/settings/notifications`, `/settings/notifications/reminders`, `/email/preferences`, `/agent/notifications`, `/host/notifications` | documented | `/docs/notifications` |
| `/verification`, `/agent/verification` | documented | `/docs/badges-and-verification` |
| `/u`, `/u/[handle]`, `/u/[handle]/edit`, `/u/[handle]/followers`, `/u/[handle]/following`, `/u/[handle]/message`, `/passport/[who]`, `/directory` | documented | `/docs/profiles-and-passport` |
| `/rewards`, `/rewards/history`, `/rewards/referrals`, `/rewards/withdraw`, `/leaderboard`, `/settings/invite`, `/settings/invite/how-it-works`, `/settings/invite/referrals`, `/settings/invite/referrals/[id]`, `/r`, `/r/[code]` | documented | `/docs/rewards-and-referrals` |
| `/search`, `/stays`, `/stays/search` | documented | `/docs/finding-a-place` |
| `/listing/[id]`, `/listing/[id]/trust`, `/stay/[id]`, `/areas/[state]/[area]` | documented | `/docs/understanding-a-listing` |
| `/saved`, `/saved/searches`, `/compare` | documented | `/docs/saved-and-compare` |
| `/price`, `/price/area/[id]` | documented | `/docs/price-check` |
| `/move-in-cost`, `/check`, `/record/[code]`, `/s/[token]`, `/safe/[token]`, `/landlord/[token]` | documented | `/docs/tools-without-an-account` |
| `/listing/[id]/visit`, `/listing/[id]/visit/[inspectionId]`, `/inspections/gate/[id]` | documented | `/docs/viewings` |
| `/agreements`, `/agreements/[id]`, `/agreements/[id]/fund`, `/agreements/[id]/held` | documented | `/docs/agreements-and-paying` |
| `/rent/move-in/[listingId]`, `/rent/pay/[inspectionId]`, `/rent/review/[paymentId]`, `/rent/share/[id]`, `/tenancy/[id]`, `/tenancy/[id]/complaint` | documented | `/docs/tenancy-and-move-in` |
| `/bookings`, `/bookings/[bookingId]`, `/checkout`, `/checkout/[bookingId]` | documented | `/docs/booking-a-stay` |
| `/bookings/[bookingId]/review` | documented | `/docs/reviews` |
| `/restaurants`, `/restaurant/[id]`, `/pay/deposit/[reservationId]` | documented | `/docs/restaurants` |
| `/wallet`, `/wallet/add`, `/wallet/send`, `/wallet/settings`, `/wallet/transactions`, `/wallet/withdraw`, `/payments`, `/payouts`, `/receipts`, `/refunds` | documented | `/docs/wallet` |
| `/pro`, `/pro/confirm` | documented | `/docs/what-vallo-costs` |
| `/listing/[id]/offer` | documented | `/docs/making-an-offer` |
| `/offers`, `/offers/[id]` | documented | `/docs/the-deal-room` |
| `/messages`, `/messages/[id]`, `/messages/new`, `/messages/share/[kind]/[id]`, `/support/messages`, `/support/messages/[id]`, `/support/new`, `/agent/messages`, `/agent/messages/[id]` | documented | `/docs/messages-and-notifications` |
| `/around`, `/around/[slug]`, `/around/new`, `/around/people`, `/around/settings`, `/post/[id]`, `/stories/[id]`, `/stories/new` | documented | `/docs/around` |
| `/circle`, `/circle/ask`, `/circle/c/[slug]`, `/circle/c/[slug]/manage`, `/circle/c/[slug]/new`, `/circle/new`, `/circle/p/[id]` | documented | `/docs/circle` |
| `/roommates`, `/roommates/campus`, `/roommates/campus/[slug]`, `/roommates/discover`, `/roommates/groups`, `/roommates/groups/[id]`, `/roommates/groups/new`, `/roommates/me`, `/roommates/new`, `/roommates/nysc`, `/roommates/p/[userId]`, `/roommates/profile`, `/roommates/r/[id]`, `/roommates/r/[id]/edit`, `/roommates/safety`, `/roommates/split`, `/roommates/verify` | documented | `/docs/roommates` |
| `/for-agents` | documented | `/docs/for-agents` |
| `/for-landlords` | documented | `/docs/for-owners` |
| `/for-hosts`, `/host`, `/host/apply`, `/host/start` | documented | `/docs/hosting` |
| `/host/arrival`, `/host/bookings`, `/host/calendar`, `/host/decide`, `/host/earnings`, `/host/earnings/statement`, `/host/photos`, `/host/reservations`, `/host/reviews`, `/host/rooms`, `/host/settings`, `/host/transfer` | documented | `/docs/host-workspace` |
| `/agent/analytics`, `/agent/analytics/[metric]`, `/agent/analytics/listings/[listingId]`, `/agent/bookings`, `/agent/dashboard`, `/agent/earnings`, `/agent/firm`, `/agent/inspections`, `/agent/list`, `/agent/listings`, `/agent/listings/[listingId]/arrival`, `/agent/listings/[listingId]/board`, `/agent/listings/[listingId]/calendar`, `/agent/listings/[listingId]/health`, `/agent/listings/[listingId]/mandate`, `/agent/listings/[listingId]/promotion`, `/agent/listings/[listingId]/sharing`, `/agent/listings/[listingId]/status`, `/agent/portfolio`, `/agent/promotion`, `/agent/reviews`, `/agent/settings` | documented | `/docs/agent-workspace` |
| `/pay/crypto/[reference]` | KNOWN GAP | Crypto payment pages exist for notification deep links; no member flow in the docs offers it. Not documented until the founder says whether it is offered. |
| `/calls/reviews`, `/calls/reviews/[id]` | KNOWN GAP | Review call invitations for the person a case is about; needs a short section in Trust and safety. |
| `/admin`, `/admin/handbook`, `/admin/handbook/position`, `/admin/handbook/manual`, `/admin/handbook/manual/[slug]`, `/admin/lookup`, `/admin/staff`, `/admin/audit`, `/admin/oversight`, `/admin/queue` | documented | `/admin/handbook/manual/desks-and-access` |
| `/admin/kyc`, `/admin/kyc/guide`, `/admin/agents`, `/admin/businesses`, `/admin/review-calls`, `/admin/review-calls/[id]`, `/admin/account-recovery` | documented | `/admin/handbook/manual/identity-and-applications` |
| `/admin/listings`, `/admin/listings/[id]`, `/admin/examples`, `/admin/supply`, `/admin/people`, `/admin/people/[id]`, `/admin/stops`, `/admin/reference` | documented | `/admin/handbook/manual/listings-and-supply` |
| `/admin/agreements`, `/admin/agreements/settings`, `/admin/bookings`, `/admin/bookings/[bookingId]`, `/admin/bookings/reservations`, `/admin/bookings/visits` | documented | `/admin/handbook/manual/agreements-and-bookings` |
| `/admin/money`, `/admin/payments`, `/admin/chargebacks`, `/admin/chargebacks/[chargebackId]`, `/admin/fees`, `/admin/restaurant-fees`, `/admin/referrals` | documented | `/admin/handbook/manual/money-and-fees` |
| `/admin/trust`, `/admin/cases`, `/admin/cases/[id]`, `/admin/alerts`, `/admin/appeals`, `/admin/standing`, `/admin/weight-withheld`, `/admin/blocked-terms`, `/admin/circle`, `/admin/social`, `/admin/roommates` | documented | `/admin/handbook/manual/cases-and-safety` |
| `/admin/support` | documented | `/admin/handbook/manual/support-desk` |
| `/admin/offers`, `/admin/offers/[id]` | documented | `/admin/handbook/manual/offers-and-deals-desk` |
| `/admin/operations`, `/admin/operations/providers`, `/admin/crashes`, `/admin/field-speed`, `/admin/call-usage`, `/admin/analytics`, `/admin/front-door`, `/admin/retention`, `/admin/compliance`, `/admin/switches`, `/admin/settings` | documented | `/admin/handbook/manual/operations-and-tools` |

## Documentation pages added

Member (`/docs/...`): `how-offers-work`, `making-an-offer`, `receiving-offers`,
`counteroffers-and-negotiation`, `the-deal-room`, `offer-inspections-and-checks`,
`offer-documents`, `offer-fees`, `circle`, `roommates`, `saved-and-compare`,
`notifications`, `settings`, `wallet`, `rewards-and-referrals`, `host-workspace`,
`agent-workspace`, `tenancy-and-move-in`, `tools-without-an-account`,
`profiles-and-passport`.

Staff (`/admin/handbook/manual/...`, behind the console): `desks-and-access`,
`identity-and-applications`, `listings-and-supply`, `agreements-and-bookings`,
`money-and-fees`, `cases-and-safety`, `support-desk`, `offers-and-deals-desk`,
`operations-and-tools`.
