# PAGE LEDGER: every page, nothing forgotten (founder, 7 November 2026)

Generated from `apps/web/src/app/**/page.tsx` (dev previews left out): 267 pages.
Every page is passed by its owner and ticked here in the same change. A
tick means seen in a production build at 390 AND 360 wide, light AND dark,
on the one design system (PageFrame or StepFrame, the banner, the sheet,
the button ladder, empty and loading states in shape). Regenerate with
`python3 scripts/page-ledger.py apps/web/src/app docs/handoff/PAGE_LEDGER.md`
only to ADD new pages; never wipe ticks.

Columns: Frame (on PageFrame or StepFrame), Light, Dark, 360, Notes.

## Admin

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/admin` | FE |  |  |  |  |  |
| `/admin/account-recovery` | FE |  |  |  |  |  |
| `/admin/agents` | FE |  |  |  |  |  |
| `/admin/agreements` | FE |  |  |  |  |  |
| `/admin/agreements/settings` | FE |  |  |  |  |  |
| `/admin/alerts` | FE |  |  |  |  |  |
| `/admin/analytics` | FE |  |  |  |  |  |
| `/admin/audit` | FE |  |  |  |  |  |
| `/admin/blocked-terms` | FE |  |  |  |  |  |
| `/admin/bookings` | FE |  |  |  |  |  |
| `/admin/bookings/[bookingId]` | FE |  |  |  |  |  |
| `/admin/bookings/reservations` | FE |  |  |  |  |  |
| `/admin/bookings/visits` | FE |  |  |  |  |  |
| `/admin/businesses` | FE |  |  |  |  |  |
| `/admin/call-usage` | FE |  |  |  |  |  |
| `/admin/chargebacks` | FE |  |  |  |  |  |
| `/admin/chargebacks/[chargebackId]` | FE |  |  |  |  |  |
| `/admin/compliance` | FE |  |  |  |  |  |
| `/admin/crashes` | Lead |  |  |  |  |  |
| `/admin/examples` | FE |  |  |  |  |  |
| `/admin/fees` | FE |  |  |  |  |  |
| `/admin/field-speed` | FE |  |  |  |  |  |
| `/admin/front-door` | FE |  |  |  |  |  |
| `/admin/handbook` | FE |  |  |  |  |  |
| `/admin/handbook/position` | FE |  |  |  |  |  |
| `/admin/kyc` | FE |  |  |  |  |  |
| `/admin/kyc/guide` | FE |  |  |  |  |  |
| `/admin/listings` | FE |  |  |  |  |  |
| `/admin/listings/[id]` | FE |  |  |  |  |  |
| `/admin/lookup` | FE |  |  |  |  |  |
| `/admin/money` | FE |  |  |  |  |  |
| `/admin/operations` | FE |  |  |  |  |  |
| `/admin/operations/providers` | FE |  |  |  |  |  |
| `/admin/oversight` | FE |  |  |  |  |  |
| `/admin/payments` | FE |  |  |  |  |  |
| `/admin/people` | FE |  |  |  |  |  |
| `/admin/people/[id]` | FE |  |  |  |  |  |
| `/admin/queue` | FE |  |  |  |  |  |
| `/admin/reference` | FE |  |  |  |  |  |
| `/admin/referrals` | FE |  |  |  |  |  |
| `/admin/restaurant-fees` | FE |  |  |  |  |  |
| `/admin/retention` | FE |  |  |  |  |  |
| `/admin/review-calls` | FE |  |  |  |  |  |
| `/admin/review-calls/[id]` | FE |  |  |  |  |  |
| `/admin/settings` | FE |  |  |  |  |  |
| `/admin/social` | FE |  |  |  |  |  |
| `/admin/staff` | FE |  |  |  |  |  |
| `/admin/standing` | FE |  |  |  |  |  |
| `/admin/stops` | FE |  |  |  |  |  |
| `/admin/supply` | FE |  |  |  |  |  |
| `/admin/support` | FE |  |  |  |  |  |
| `/admin/switches` | FE |  |  |  |  |  |
| `/admin/weight-withheld` | FE |  |  |  |  |  |

## Agent workspace

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/agent/analytics` | FE |  |  |  |  |  |
| `/agent/analytics/[metric]` | FE |  |  |  |  |  |
| `/agent/analytics/listings/[listingId]` | FE |  |  |  |  |  |
| `/agent/assistant` | FE |  |  |  |  |  |
| `/agent/bookings` | FE |  |  |  |  |  |
| `/agent/dashboard` | FE |  |  |  |  |  |
| `/agent/earnings` | FE |  |  |  |  |  |
| `/agent/firm` | FE |  |  |  |  |  |
| `/agent/inspections` | FE |  |  |  |  |  |
| `/agent/list` | FE |  |  |  |  |  |
| `/agent/listings` | FE |  |  |  |  |  |
| `/agent/listings/[listingId]/arrival` | FE |  |  |  |  |  |
| `/agent/listings/[listingId]/board` | FE |  |  |  |  |  |
| `/agent/listings/[listingId]/calendar` | FE |  |  |  |  |  |
| `/agent/listings/[listingId]/health` | FE |  |  |  |  |  |
| `/agent/listings/[listingId]/mandate` | FE |  |  |  |  |  |
| `/agent/listings/[listingId]/promotion` | FE |  |  |  |  |  |
| `/agent/listings/[listingId]/status` | FE |  |  |  |  |  |
| `/agent/messages` | FE |  |  |  |  |  |
| `/agent/messages/[id]` | FE |  |  |  |  |  |
| `/agent/notifications` | FE |  |  |  |  |  |
| `/agent/portfolio` | FE |  |  |  |  |  |
| `/agent/promotion` | FE |  |  |  |  |  |
| `/agent/reviews` | FE |  |  |  |  |  |
| `/agent/settings` | FE |  |  |  |  |  |
| `/agent/verification` | FE |  |  |  |  |  |

## Host workspace

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/host` | FE |  |  |  |  |  |
| `/host/apply` | FE |  |  |  |  |  |
| `/host/arrival` | FE |  |  |  |  |  |
| `/host/assistant` | FE |  |  |  |  |  |
| `/host/bookings` | FE |  |  |  |  |  |
| `/host/calendar` | FE |  |  |  |  |  |
| `/host/decide` | FE |  |  |  |  |  |
| `/host/earnings` | FE |  |  |  |  |  |
| `/host/earnings/statement` | FE |  |  |  |  |  |
| `/host/notifications` | FE |  |  |  |  |  |
| `/host/photos` | FE |  |  |  |  |  |
| `/host/reservations` | FE |  |  |  |  |  |
| `/host/reviews` | FE |  |  |  |  |  |
| `/host/rooms` | FE |  |  |  |  |  |
| `/host/settings` | FE |  |  |  |  |  |
| `/host/start` | FE |  |  |  |  |  |
| `/host/transfer` | FE |  |  |  |  |  |

## Member: about

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/about` | FE |  |  |  |  |  |

## Member: agreements

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/agreements` | FE |  |  |  |  |  |
| `/agreements/[id]` | FE |  |  |  |  |  |
| `/agreements/[id]/fund` | FE |  |  |  |  |  |
| `/agreements/[id]/held` | FE |  |  |  |  |  |

## Member: ai

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/ai/permissions` | FE |  |  |  |  |  |
| `/ai/privacy` | FE |  |  |  |  |  |
| `/ai/security` | FE |  |  |  |  |  |
| `/ai/terms` | FE |  |  |  |  |  |

## Member: areas

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/areas/[state]/[area]` | FE |  |  |  |  |  |

## Member: around

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/around` | FE | full-bleed root (no PageFrame by design) | yes | yes | yes | 7 Nov: the feed's Vallo look (lens masthead with Circle not open, story tiles, the one-line way to post, For you row with the place, calm cards, concentric media, live counts, skeleton in shape). Seen in the preview harness `/preview/feed-v2` on a production build. |
| `/around/[slug]` | FE |  |  |  |  |  |
| `/around/manage` | FE |  |  |  |  |  |
| `/around/new` | FE |  |  |  |  |  |
| `/around/people` | FE |  |  |  |  |  |
| `/around/settings` | FE |  |  |  |  |  |

## Member: assistant

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/assistant` | MSG |  |  |  |  |  |
| `/assistant/person` | MSG |  |  |  |  |  |

## Member: auth

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/auth/callback` | FE |  |  |  |  |  |

## Member: bookings

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/bookings` | FE |  |  |  |  |  |
| `/bookings/[bookingId]` | FE |  |  |  |  |  |
| `/bookings/[bookingId]/review` | FE |  |  |  |  |  |

## Member: calls

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/calls/reviews` | FE |  |  |  |  |  |
| `/calls/reviews/[id]` | FE |  |  |  |  |  |

## Member: cancellations

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/cancellations` | FE |  |  |  |  |  |

## Member: careers

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/careers` | FE |  |  |  |  |  |

## Member: check

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/check` | FE |  |  |  |  |  |

## Member: checkout

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/checkout` | FE |  |  |  |  |  |
| `/checkout/[bookingId]` | FE |  |  |  |  |  |

## Member: compare

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/compare` | FE |  |  |  |  |  |

## Member: contact

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/contact` | FE |  |  |  |  |  |

## Member: delete-account

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/delete-account` | FE |  |  |  |  |  |

## Member: directory

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/directory` | FE |  |  |  |  |  |

## Member: disclaimer

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/disclaimer` | FE |  |  |  |  |  |

## Member: docs

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/docs` | FE |  |  |  |  |  |
| `/docs/[slug]` | FE |  |  |  |  |  |

## Member: email

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/email/preferences` | FE |  |  |  |  |  |

## Member: eula

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/eula` | FE |  |  |  |  |  |

## Member: first-run

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/first-run/[feature]` | FE |  |  |  |  |  |

## Member: for-agents

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/for-agents` | FE |  |  |  |  |  |

## Member: for-hosts

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/for-hosts` | FE |  |  |  |  |  |

## Member: for-landlords

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/for-landlords` | FE |  |  |  |  |  |

## Member: forgot-password

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/forgot-password` | FE |  |  |  |  |  |
| `/forgot-password/code` | FE |  |  |  |  |  |

## Member: guides

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/guides` | FE |  |  |  |  |  |
| `/guides/[slug]` | FE |  |  |  |  |  |

## Member: help

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/help` | FE |  |  |  |  |  |

## Member: home

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/home` | FE |  |  |  |  |  |

## Member: host-agreement

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/host-agreement` | FE |  |  |  |  |  |

## Member: inspections

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/inspections/gate/[id]` | FE |  |  |  |  |  |

## Member: landlord

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/landlord/[token]` | FE |  |  |  |  |  |

## Member: leaderboard

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/leaderboard` | FE |  |  |  |  |  |

## Member: legal

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/legal/disclaimer` | FE |  |  |  |  |  |
| `/legal/privacy` | FE |  |  |  |  |  |
| `/legal/terms` | FE |  |  |  |  |  |

## Member: listing

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/listing/[id]` | FE |  |  |  |  |  |
| `/listing/[id]/trust` | FE |  |  |  |  |  |
| `/listing/[id]/visit` | FE |  |  |  |  |  |
| `/listing/[id]/visit/[inspectionId]` | FE |  |  |  |  |  |

## Member: messages

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/messages` | MSG |  |  |  |  |  |
| `/messages/[id]` | MSG |  |  |  |  |  |
| `/messages/new` | MSG |  |  |  |  |  |
| `/messages/share/[kind]/[id]` | MSG |  |  |  |  |  |

## Member: move-in-cost

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/move-in-cost` | FE |  |  |  |  |  |

## Member: notifications

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/notifications` | FE |  |  |  |  |  |
| `/notifications/[id]` | FE |  |  |  |  |  |

## Member: offline

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/offline` | FE |  |  |  |  |  |

## Member: passport

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/passport/[who]` | FE |  |  |  |  |  |

## Member: pay

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/pay/crypto/[reference]` | FE |  |  |  |  |  |
| `/pay/deposit/[reservationId]` | FE |  |  |  |  |  |

## Member: payments

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/payments` | FE |  |  |  |  |  |

## Member: payouts

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/payouts` | FE |  |  |  |  |  |

## Member: post

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/post/[id]` | FE |  |  |  |  |  7 Nov: its post card took the feed's new card (seen 390 light, 360 dark in `/preview/f4/post-thread`); the page pass itself is still to do. |

## Member: price

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/price` | FE |  |  |  |  |  |
| `/price/area/[id]` | FE |  |  |  |  |  |

## Member: privacy

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/privacy` | FE |  |  |  |  |  |

## Member: pro

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/pro` | FE |  |  |  |  |  |
| `/pro/confirm` | FE |  |  |  |  |  |

## Member: profile

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/profile` | FE |  |  |  |  |  |
| `/profile/application` | FE |  |  |  |  |  |
| `/profile/setup` | FE |  |  |  |  |  |
| `/profile/setup/[role]` | FE |  |  |  |  |  |
| `/profile/setup/agent` | FE |  |  |  |  |  |
| `/profile/setup/firm` | FE |  |  |  |  |  |
| `/profile/setup/owner` | FE |  |  |  |  |  |

## Member: r

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/r` | FE |  |  |  |  |  |
| `/r/[code]` | FE |  |  |  |  |  |

## Member: receipts

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/receipts` | FE |  |  |  |  |  |

## Member: record

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/record/[code]` | FE |  |  |  |  |  |

## Member: refunds

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/refunds` | FE |  |  |  |  |  |

## Member: rent

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/rent/move-in/[listingId]` | FE |  |  |  |  |  |
| `/rent/pay/[inspectionId]` | FE |  |  |  |  |  |
| `/rent/review/[paymentId]` | FE |  |  |  |  |  |
| `/rent/share/[id]` | FE |  |  |  |  |  |

## Member: reset-password

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/reset-password` | FE |  |  |  |  |  |

## Member: restaurant

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/restaurant/[id]` | FE |  |  |  |  |  |

## Member: restaurants

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/restaurants` | FE |  |  |  |  |  |

## Member: rewards

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/rewards` | FE |  |  |  |  |  |
| `/rewards/history` | FE |  |  |  |  |  |
| `/rewards/referrals` | FE |  |  |  |  |  |
| `/rewards/withdraw` | FE |  |  |  |  |  |

## Member: s

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/s/[token]` | FE |  |  |  |  |  |

## Member: safe

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/safe/[token]` | FE |  |  |  |  |  |

## Member: safety

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/safety` | FE |  |  |  |  |  |

## Member: saved

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/saved` | FE |  |  |  |  |  |
| `/saved/searches` | FE |  |  |  |  |  |

## Member: search

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/search` | FE |  |  |  |  |  |

## Member: settings

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/settings` | FE |  |  |  |  |  |
| `/settings/accessibility` | FE |  |  |  |  |  |
| `/settings/account` | FE |  |  |  |  |  |
| `/settings/ai-assistant` | FE |  |  |  |  |  |
| `/settings/ai-assistant/consent` | FE |  |  |  |  |  |
| `/settings/appearance` | FE |  |  |  |  |  |
| `/settings/devices` | FE |  |  |  |  |  |
| `/settings/devices/alert` | FE |  |  |  |  |  |
| `/settings/help` | FE |  |  |  |  |  |
| `/settings/interests` | FE |  |  |  |  |  |
| `/settings/invite` | FE |  |  |  |  |  |
| `/settings/invite/how-it-works` | FE |  |  |  |  |  |
| `/settings/invite/referrals` | FE |  |  |  |  |  |
| `/settings/invite/referrals/[id]` | FE |  |  |  |  |  |
| `/settings/notifications` | FE |  |  |  |  |  |
| `/settings/passcode` | FE |  |  |  |  |  |
| `/settings/passport` | FE |  |  |  |  |  |
| `/settings/payments` | FE |  |  |  |  |  |
| `/settings/phone` | FE |  |  |  |  |  |
| `/settings/place` | FE |  |  |  |  |  |
| `/settings/privacy` | FE |  |  |  |  |  |
| `/settings/privacy/ai` | FE |  |  |  |  |  |
| `/settings/privacy/blocked` | FE |  |  |  |  |  |
| `/settings/privacy/data` | FE |  |  |  |  |  |
| `/settings/privacy/money-lock` | FE |  |  |  |  |  |
| `/settings/region` | FE |  |  |  |  |  |

## Member: sign-in

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/sign-in` | FE |  |  |  |  |  |
| `/sign-in/code` | FE |  |  |  |  |  |
| `/sign-in/email` | FE |  |  |  |  |  |
| `/sign-in/phone` | FE |  |  |  |  |  |

## Member: sign-up

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/sign-up` | FE |  |  |  |  |  |
| `/sign-up/email` | FE |  |  |  |  |  |
| `/sign-up/finish` | FE |  |  |  |  |  |
| `/sign-up/phone` | FE |  |  |  |  |  |
| `/sign-up/verify` | FE |  |  |  |  |  |

## Member: standards

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/standards` | FE |  |  |  |  |  |

## Member: stay

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/stay/[id]` | FE |  |  |  |  |  |

## Member: stays

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/stays` | FE |  |  |  |  |  |
| `/stays/search` | FE |  |  |  |  |  |

## Member: stories

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/stories/[id]` | FE |  |  |  |  |  |
| `/stories/new` | FE |  |  |  |  |  |

## Member: styleguide

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/styleguide` | FE |  |  |  |  |  |

## Member: support

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/support` | FE |  |  |  |  |  |
| `/support/messages` | MSG |  |  |  |  |  |
| `/support/messages/[id]` | MSG |  |  |  |  |  |
| `/support/new` | FE |  |  |  |  |  |

## Member: tenancy

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/tenancy/[id]` | FE |  |  |  |  |  |
| `/tenancy/[id]/complaint` | FE |  |  |  |  |  |

## Member: terms

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/terms` | FE |  |  |  |  |  |

## Member: u

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/u` | FE |  |  |  |  |  |
| `/u/[handle]` | FE |  |  |  |  |  |
| `/u/[handle]/edit` | FE |  |  |  |  |  |
| `/u/[handle]/followers` | FE |  |  |  |  |  |
| `/u/[handle]/following` | FE |  |  |  |  |  |
| `/u/[handle]/message` | FE |  |  |  |  |  |

## Member: verification

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/verification` | FE |  |  |  |  |  |

## Member: wallet

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/wallet` | FE |  |  |  |  |  |
| `/wallet/add` | FE |  |  |  |  |  |
| `/wallet/send` | FE |  |  |  |  |  |
| `/wallet/settings` | FE |  |  |  |  |  |
| `/wallet/transactions` | FE |  |  |  |  |  |
| `/wallet/withdraw` | FE |  |  |  |  |  |

## Member: welcome

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/welcome` | FE |  |  |  |  |  |

## Public

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/` | FE |  |  |  |  |  |
