# PAGE LEDGER: every page, nothing forgotten (founder, 7 November 2026)

Generated from `apps/web/src/app/**/page.tsx` (dev previews left out): 275 pages.
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
| `/admin/bookings` | PAGES | PageHead |  |  |  | PageHead (AD-01: the one console header; DeskHeads wrap it). Not seen: needs a staff session |
| `/admin/bookings/[bookingId]` | PAGES | PageHead |  |  |  | PageHead (AD-01: the one console header; DeskHeads wrap it). Not seen: needs a staff session |
| `/admin/bookings/reservations` | FE |  |  |  |  |  |
| `/admin/bookings/visits` | FE |  |  |  |  |  |
| `/admin/businesses` | FE |  |  |  |  |  |
| `/admin/call-usage` | FE |  |  |  |  |  |
| `/admin/chargebacks` | PAGES | PageHead |  |  |  | PageHead (AD-01: the one console header; DeskHeads wrap it). Not seen: needs a staff session |
| `/admin/chargebacks/[chargebackId]` | FE |  |  |  |  |  |
| `/admin/compliance` | FE |  |  |  |  |  |
| `/admin/crashes` | Lead |  |  |  |  |  |
| `/admin/examples` | FE |  |  |  |  |  |
| `/admin/fees` | FE |  |  |  |  |  |
| `/admin/field-speed` | FE |  |  |  |  |  |
| `/admin/front-door` | FE |  |  |  |  |  |
| `/admin/handbook` | FE |  |  |  |  |  |
| `/admin/handbook/position` | FE |  |  |  |  |  |
| `/admin/kyc` | PAGES | PageHead |  |  |  | PageHead (AD-01: the one console header; DeskHeads wrap it). Not seen: needs a staff session |
| `/admin/kyc/guide` | PAGES | PageHead |  |  |  | PageHead (AD-01: the one console header; DeskHeads wrap it). Not seen: needs a staff session |
| `/admin/listings` | PAGES | PageHead |  |  |  | PageHead (AD-01: the one console header; DeskHeads wrap it). Not seen: needs a staff session |
| `/admin/listings/[id]` | PAGES | PageHead |  |  |  | PageHead (AD-01: the one console header; DeskHeads wrap it). Not seen: needs a staff session |
| `/admin/lookup` | FE |  |  |  |  |  |
| `/admin/money` | PAGES | PageHead |  |  |  | PageHead (AD-01: the one console header; DeskHeads wrap it). Not seen: needs a staff session |
| `/admin/operations` | FE |  |  |  |  |  |
| `/admin/operations/providers` | FE |  |  |  |  |  |
| `/admin/oversight` | FE |  |  |  |  |  |
| `/admin/payments` | PAGES | PageHead |  |  |  | PageHead (AD-01: the one console header; DeskHeads wrap it). Not seen: needs a staff session |
| `/admin/people` | FE |  |  |  |  |  |
| `/admin/people/[id]` | FE |  |  |  |  |  |
| `/admin/queue` | FE |  |  |  |  |  |
| `/admin/reference` | FE |  |  |  |  |  |
| `/admin/referrals` | FE |  |  |  |  |  |
| `/admin/restaurant-fees` | FE |  |  |  |  |  |
| `/admin/retention` | FE |  |  |  |  |  |
| `/admin/review-calls` | PAGES | PageHead |  |  |  | PageHead (AD-01: the one console header; DeskHeads wrap it). Not seen: needs a staff session |
| `/admin/review-calls/[id]` | PAGES | PageHead |  |  |  | PageHead (AD-01: the one console header; DeskHeads wrap it). Not seen: needs a staff session |
| `/admin/settings` | FE |  |  |  |  |  |
| `/admin/social` | FE |  |  |  |  |  |
| `/admin/staff` | FE |  |  |  |  |  |
| `/admin/standing` | FE |  |  |  |  |  |
| `/admin/stops` | FE |  |  |  |  |  |
| `/admin/supply` | PAGES | PageHead |  |  |  | PageHead (AD-01: the one console header; DeskHeads wrap it). Not seen: needs a staff session |
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
| `/agreements` | PAGES | PageFrame | yes | yes | yes | R3 job 1; seen through /preview/pages-frame (real page, signed-out or not-found state; no session here); no Back while it holds the dock slot (social off) |
| `/agreements/[id]` | PAGES | PageFrame |  |  |  | R3 job 1: on PageFrame in code; signed-in only (redirect or not-found without a session), needs a fixture harness to see |
| `/agreements/[id]/fund` | PAGES | PageFrame |  |  |  | R3 job 1: on PageFrame in code; signed-in only (redirect or not-found without a session), needs a fixture harness to see |
| `/agreements/[id]/held` | PAGES | PageFrame |  |  |  | R3 job 1: on PageFrame in code; signed-in only (redirect or not-found without a session), needs a fixture harness to see |

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
| `/around` | FE | full-bleed root (no PageFrame by design) | yes | yes | yes | 7 Nov (second pass, the founder's feed reference): the "Feed" head with its line, the place and the Circle door; stories at the top; For you, Friends, Properties, Stays, Restaurants chips over real posts; the composer line with photo and post doors; full-bleed featured listing cards with View property; one quiet action row at 18px; photo mosaic with +N; the embedded listing card; borderless cards. Seen 390 and 360, light and dark, in `/preview/feed-v2` on a production build. |
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
| `/bookings` | PAGES | PageFrame | yes | yes | yes | R3 job 1; seen through /preview/pages-frame (real page, signed-out or not-found state; no session here) |
| `/bookings/[bookingId]` | PAGES | PageFrame | yes | yes | yes | R3 job 1; seen through /preview/pages-frame (real page, signed-out or not-found state; no session here) |
| `/bookings/[bookingId]/review` | PAGES | PageFrame | yes | yes | yes | R3 job 1; seen through /preview/pages-frame (real page, signed-out or not-found state; no session here) |

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

## Member: circle

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/circle` | FEATURES | PageFrame | yes | yes | yes | 7 Nov: Circle home, LIVE counts from circle_home_stats, tabs in the URL, the first-run starter communities (real actions, nothing seeded). Seen in `/preview/features/circle` and `?first=1` at 390, 360, 768, 1280, light and dark, production build. The banner is a plain one until FE's shared banner lands. |
| `/circle/ask` | FEATURES | StepFrame | yes | yes | yes | 7 Nov: Ask the community, 4 steps with a device draft and a preview of the real card. Seen in `/preview/features/circle-ask` (steps 1 and 4) at 390 and 360, light and dark. |
| `/circle/c/[slug]` | FEATURES | PageFrame |  |  |  | 7 Nov: built on the same Circle parts; not yet seen in a harness (needs a deck with a sample community and thread). |
| `/circle/c/[slug]/manage` | FEATURES | PageFrame |  |  |  | 7 Nov: built on the same Circle parts; not yet seen in a harness (needs a deck with a sample community and thread). |
| `/circle/c/[slug]/new` | FEATURES | StepFrame |  |  |  | 7 Nov: the Ask flow in discussion mode for one community (same component as /circle/ask, which is seen); its own deck still to do. |
| `/circle/new` | FEATURES | StepFrame | yes | yes | yes | 7 Nov: Create a community, 5 steps, prefilled from the starter suggestions. Seen in `/preview/features/circle-new` (steps 1 and 5) at 390 and 360, light and dark. |
| `/circle/p/[id]` | FEATURES | PageFrame |  |  |  | 7 Nov: built on the same Circle parts; not yet seen in a harness (needs a deck with a sample community and thread). |

## Member: compare

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/compare` | PAGES | PageFrame | yes | yes | yes | R3 job 1; seen through /preview/pages-frame (real page, signed-out or not-found state; no session here) |

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
| `/directory` | PAGES | own | yes | yes | yes | DirectoryScreen draws PageHeader inside components/app/directory |

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
| `/inspections/gate/[id]` | PAGES | PageFrame | yes | yes | yes | R3 job 1; seen through /preview/pages-frame (real page, signed-out or not-found state; no session here) |

## Member: landlord

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/landlord/[token]` | FE |  |  |  |  |  |

## Member: leaderboard

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/leaderboard` | PAGES | own | yes | yes | yes | kept: LeaderboardScreen own header (components/app/leaderboard) |

## Member: legal

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/legal/disclaimer` | PAGES | PageFrame | yes | yes | yes | R3 job 1; seen through /preview/pages-frame (real page, signed-out or not-found state; no session here) |
| `/legal/privacy` | PAGES | PageFrame | yes | yes | yes | R3 job 1; seen through /preview/pages-frame (real page, signed-out or not-found state; no session here) |
| `/legal/terms` | PAGES | PageFrame | yes | yes | yes | R3 job 1; seen through /preview/pages-frame (real page, signed-out or not-found state; no session here) |

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
| `/notifications` | FE |  | yes | yes | yes | 8 Nov: the Needs you stack fixed (one card per row, no card inside a card, opaque front), families the lock screen's words (Messages, Bookings, Money, Activity, Offers, Calls), right glyph per row; seen in `/preview/fe-notifications`; the opaque front card awaits a re-shoot on a green build. |
| `/notifications/[id]` | FE |  |  |  |  |  |

## Member: offline

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/offline` | FE |  |  |  |  |  |

## Member: passport

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/passport/[who]` | PAGES | PageFrame | yes | yes | yes | R3 job 1; seen through /preview/pages-frame (real page, signed-out or not-found state; no session here) |

## Member: pay

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/pay/crypto/[reference]` | PAGES | PageFrame | yes | yes | yes | R3 job 1; seen through /preview/pages-frame (real page, signed-out or not-found state; no session here) |
| `/pay/deposit/[reservationId]` | PAGES | PageFrame | yes | yes | yes | R3 job 1; seen through /preview/pages-frame (real page, signed-out or not-found state; no session here) |

## Member: payments

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/payments` | PAGES | PageFrame | yes | yes | yes | R3 job 1; seen through /preview/pages-frame (real page, signed-out or not-found state; no session here) |

## Member: payouts

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/payouts` | PAGES | PageFrame | yes | yes | yes | R3 job 1; seen through /preview/pages-frame (real page, signed-out or not-found state; no session here) |

## Member: post

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/post/[id]` | FE |  |  |  |  |  7 Nov: its post card took the feed's new card (seen 390 light, 360 dark in `/preview/f4/post-thread`); the page pass itself is still to do. |

## Member: price

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/price` | PAGES | PageFrame | yes | yes | yes | R3 job 1; seen through /preview/pages-frame (real page, signed-out or not-found state; no session here) |
| `/price/area/[id]` | PAGES | PageFrame | yes | yes | yes | R3 job 1; seen through /preview/pages-frame (real page, signed-out or not-found state; no session here) |

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
| `/profile/application` | PAGES | PageFrame | yes | yes | yes | R3 job 1; seen through /preview/pages-frame (real page, signed-out or not-found state; no session here) |
| `/profile/setup` | PAGES |  |  |  |  | job 3: AddWorkspaceChooser onto OptionCards |
| `/profile/setup/[role]` | PAGES | PageFrame |  |  |  | PageFrame now; job 3 ApplyWizard onto StepFrame |
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
| `/receipts` | PAGES | PageFrame | yes | yes | yes | R3 job 1; seen through /preview/pages-frame (real page, signed-out or not-found state; no session here) |

## Member: record

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/record/[code]` | PAGES | PageFrame | yes | yes | yes | R3 job 1; seen through /preview/pages-frame (real page, signed-out or not-found state; no session here) |

## Member: refunds

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/refunds` | PAGES | PageFrame | yes | yes | yes | R3 job 1; seen through /preview/pages-frame (real page, signed-out or not-found state; no session here) |

## Member: rent

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/rent/move-in/[listingId]` | FE |  |  |  |  |  |
| `/rent/pay/[inspectionId]` | PAGES | PageFrame | yes | yes | yes | R3 job 1; seen through /preview/pages-frame (real page, signed-out or not-found state; no session here) |
| `/rent/review/[paymentId]` | PAGES | PageFrame | yes | yes | yes | R3 job 1; seen through /preview/pages-frame (real page, signed-out or not-found state; no session here) |
| `/rent/share/[id]` | PAGES | PageFrame | yes | yes | yes | R3 job 1; seen through /preview/pages-frame (real page, signed-out or not-found state; no session here) |

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
| `/rewards` | PAGES | PageFrame | yes | yes | yes | R3 job 1; seen through /preview/pages-frame (real page, signed-out or not-found state; no session here) |
| `/rewards/history` | PAGES | PageFrame | yes | yes | yes | R3 job 1; seen through /preview/pages-frame (real page, signed-out or not-found state; no session here) |
| `/rewards/referrals` | PAGES | PageFrame | yes | yes | yes | R3 job 1; seen through /preview/pages-frame (real page, signed-out or not-found state; no session here) |
| `/rewards/withdraw` | PAGES | PageFrame | yes | yes | yes | R3 job 1; seen through /preview/pages-frame (real page, signed-out or not-found state; no session here) |

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
| `/settings` | PAGES | PageFrame | yes | yes | yes | R3 job 1; seen through /preview/pages-frame (real page, signed-out or not-found state; no session here) |
| `/settings/accessibility` | PAGES | PageFrame | yes | yes | yes | R3 job 1; seen through /preview/pages-frame (real page, signed-out or not-found state; no session here) |
| `/settings/account` | PAGES | PageFrame | yes | yes | yes | R3 job 1; seen through /preview/pages-frame (real page, signed-out or not-found state; no session here) |
| `/settings/ai-assistant` | PAGES | PageFrame |  |  |  | R3 job 1: on PageFrame in code; signed-in only (redirect or not-found without a session), needs a fixture harness to see |
| `/settings/ai-assistant/consent` | PAGES | PageFrame |  |  |  | R3 job 1: on PageFrame in code; signed-in only (redirect or not-found without a session), needs a fixture harness to see |
| `/settings/appearance` | PAGES | PageFrame | yes | yes | yes | R3 job 1; seen through /preview/pages-frame (real page, signed-out or not-found state; no session here) |
| `/settings/devices` | PAGES | PageFrame | yes | yes | yes | R3 job 1; seen through /preview/pages-frame (real page, signed-out or not-found state; no session here) |
| `/settings/devices/alert` | PAGES | PageFrame | yes | yes | yes | R3 job 1; seen through /preview/pages-frame (real page, signed-out or not-found state; no session here) |
| `/settings/help` | PAGES | PageFrame | yes | yes | yes | R3 job 1; seen through /preview/pages-frame (real page, signed-out or not-found state; no session here) |
| `/settings/interests` | PAGES | PageFrame | yes | yes | yes | R3 job 1; seen through /preview/pages-frame (real page, signed-out or not-found state; no session here) |
| `/settings/invite` | PAGES | PageFrame | yes | yes | yes | R3 job 1; seen through /preview/pages-frame (real page, signed-out or not-found state; no session here) |
| `/settings/invite/how-it-works` | PAGES | PageFrame | yes | yes | yes | R3 job 1; seen through /preview/pages-frame (real page, signed-out or not-found state; no session here) |
| `/settings/invite/referrals` | PAGES | redirect |  |  |  | redirects to /rewards/referrals (D85) |
| `/settings/invite/referrals/[id]` | PAGES | redirect |  |  |  | redirects to /rewards/referrals (D85) |
| `/settings/notifications` | PAGES | PageFrame | yes | yes | yes | R3 job 1; seen through /preview/pages-frame (real page, signed-out or not-found state; no session here); Reminders row added (/settings/notifications/reminders) |
| `/settings/notifications/reminders` | FEATURES | PageFrame | yes | yes | yes | 7 Nov: A5 and A6 switches (SettingsGroup and RowSwitch). Seen in `/preview/features/reminders` at 390, 360, 768, 1280, light and dark. |
| `/settings/passcode` | PAGES | PageFrame | yes | yes | yes | R3 job 1; seen through /preview/pages-frame (real page, signed-out or not-found state; no session here) |
| `/settings/passport` | PAGES | PageFrame | yes | yes | yes | R3 job 1; seen through /preview/pages-frame (real page, signed-out or not-found state; no session here) |
| `/settings/payments` | PAGES | PageFrame | yes | yes | yes | R3 job 1; seen through /preview/pages-frame (real page, signed-out or not-found state; no session here) |
| `/settings/phone` | PAGES | PageFrame | yes | yes | yes | R3 job 1; seen through /preview/pages-frame (real page, signed-out or not-found state; no session here) |
| `/settings/place` | PAGES | PageFrame | yes | yes | yes | R3 job 1; seen through /preview/pages-frame (real page, signed-out or not-found state; no session here) |
| `/settings/privacy` | PAGES | PageFrame | yes | yes | yes | R3 job 1; seen through /preview/pages-frame (real page, signed-out or not-found state; no session here) |
| `/settings/privacy/ai` | PAGES | PageFrame | yes | yes | yes | R3 job 1; seen through /preview/pages-frame (real page, signed-out or not-found state; no session here) |
| `/settings/privacy/blocked` | PAGES | PageFrame | yes | yes | yes | R3 job 1; seen through /preview/pages-frame (real page, signed-out or not-found state; no session here) |
| `/settings/privacy/data` | PAGES | PageFrame | yes | yes | yes | R3 job 1; seen through /preview/pages-frame (real page, signed-out or not-found state; no session here) |
| `/settings/privacy/money-lock` | PAGES | PageFrame | yes | yes | yes | R3 job 1; seen through /preview/pages-frame (real page, signed-out or not-found state; no session here) |
| `/settings/region` | PAGES | PageFrame | yes | yes | yes | R3 job 1; seen through /preview/pages-frame (real page, signed-out or not-found state; no session here) |

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
| `/support` | PAGES | own | yes | yes | yes | kept: SupportHero greeting top; floating Back to move into a header (job 6) |
| `/support/messages` | MSG |  |  |  |  |  |
| `/support/messages/[id]` | MSG |  |  |  |  |  |
| `/support/new` | PAGES | StepFrame |  |  |  | R3 job 3: four steps on StepFrame (kind as OptionCards); screenshots with job 3 |

## Member: tenancy

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/tenancy/[id]` | PAGES | PageFrame | yes | yes | yes | R3 job 1; seen through /preview/pages-frame (real page, signed-out or not-found state; no session here) |
| `/tenancy/[id]/complaint` | PAGES | PageFrame | yes | yes | yes | R3 job 1; seen through /preview/pages-frame (real page, signed-out or not-found state; no session here) |

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
| `/wallet` | PAGES | own | yes | yes | yes | kept: WalletHeader (the wallet own top, 9 callers in components/money); recommend a PageFrame decision |
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
