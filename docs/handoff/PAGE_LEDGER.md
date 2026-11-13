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
| `/admin` | FE | PageHead |  |  |  | PageHead (AD-01): was a screen-reader-only h1; staff front page on it too. Not seen: needs a staff session |
| `/admin/account-recovery` | FE | PageHead |  |  |  | PageHead (AD-01); own loading added. Not seen: needs a staff session |
| `/admin/agents` | FE | PageHead |  |  |  | PageHead (AD-01), waiting count as trail. Not seen: needs a staff session |
| `/admin/agreements` | FE | PageHead |  |  |  | PageHead (AD-01). Not seen: needs a staff session |
| `/admin/agreements/settings` | FE | PageHead |  |  |  | PageHead (AD-01); own loading added. Not seen: needs a staff session |
| `/admin/alerts` | FE | PageHead |  |  |  | PageHead (AD-01), waiting count as trail. Not seen: needs a staff session |
| `/admin/analytics` | FE | PageHead |  |  |  | PageHead (AD-01); own loading added. Not seen: needs a staff session |
| `/admin/audit` | FE | PageHead |  |  |  | PageHead (AD-01). Not seen: needs a staff session |
| `/admin/blocked-terms` | FE | PageHead |  |  |  | PageHead (AD-01); own loading added. Not seen: needs a staff session |
| `/admin/bookings` | PAGES | PageHead |  |  |  | PageHead (AD-01: the one console header; DeskHeads wrap it). Not seen: needs a staff session |
| `/admin/bookings/[bookingId]` | PAGES | PageHead |  |  |  | PageHead (AD-01: the one console header; DeskHeads wrap it). Not seen: needs a staff session |
| `/admin/bookings/reservations` | FE | PageHead |  |  |  | PageHead (AD-01), back chip as lead, waiting count as trail. Not seen: needs a staff session |
| `/admin/bookings/visits` | FE | PageHead |  |  |  | PageHead (AD-01). Not seen: needs a staff session |
| `/admin/businesses` | FE | PageHead |  |  |  | PageHead (AD-01), waiting count as trail. Not seen: needs a staff session |
| `/admin/call-usage` | FE | PageHead |  |  |  | PageHead (AD-01); own loading added. Not seen: needs a staff session |
| `/admin/chargebacks` | PAGES | PageHead |  |  |  | PageHead (AD-01: the one console header; DeskHeads wrap it). Not seen: needs a staff session |
| `/admin/chargebacks/[chargebackId]` | FE |  |  |  |  |  |
| `/admin/compliance` | FE | PageHead |  |  |  | PageHead (AD-01). Not seen: needs a staff session |
| `/admin/crashes` | Lead |  |  |  |  |  |
| `/admin/examples` | FE | PageHead |  |  |  | PageHead (AD-01), overdue count as trail. Not seen: needs a staff session |
| `/admin/fees` | FE | PageHead |  |  |  | PageHead (AD-01), off the old QueueHeader, 10 Nov. Not seen: needs a staff session |
| `/admin/field-speed` | FE | PageHead |  |  |  | PageHead (AD-01). Not seen: needs a staff session |
| `/admin/front-door` | FE | PageHead |  |  |  | PageHead (AD-01). Not seen: needs a staff session |
| `/admin/handbook` | FE | PageHead |  |  |  | PageHead (AD-01); own loading added. Not seen: needs a staff session |
| `/admin/handbook/manual` | DOCS | DocShell |  |  |  | DOCS: staff manual on the document kit. Not seen: needs a staff session (type-checked, linted, route covered by coverage test). |
| `/admin/handbook/manual/[slug]` | DOCS | DocShell |  |  |  | DOCS: staff manual on the document kit. Not seen: needs a staff session (type-checked, linted, route covered by coverage test). |
| `/admin/handbook/position` | FE | PageHead |  |  |  | PageHead (AD-01); own loading added. Not seen: needs a staff session |
| `/admin/kyc` | PAGES | PageHead |  |  |  | PageHead (AD-01: the one console header; DeskHeads wrap it). Not seen: needs a staff session |
| `/admin/kyc/guide` | PAGES | PageHead |  |  |  | PageHead (AD-01: the one console header; DeskHeads wrap it). Not seen: needs a staff session |
| `/admin/listings` | PAGES | PageHead |  |  |  | PageHead (AD-01: the one console header; DeskHeads wrap it). Not seen: needs a staff session |
| `/admin/listings/[id]` | PAGES | PageHead |  |  |  | PageHead (AD-01: the one console header; DeskHeads wrap it). Not seen: needs a staff session |
| `/admin/lookup` | FE | PageHead |  |  |  | PageHead (AD-01). Not seen: needs a staff session |
| `/admin/money` | PAGES | PageHead |  |  |  | PageHead (AD-01: the one console header; DeskHeads wrap it). Not seen: needs a staff session |
| `/admin/offers` | UI | PageHead | fixture | fixture | fixture | Offers and deals desk: overview metrics with definitions, filterable table. Seen through the preview fixtures only (needs a staff session live) |
| `/admin/offers/[id]` | UI | PageHead | fixture | fixture | fixture | Deal inspection and intervention. Fixture preview only |
| `/admin/operations` | FE | PageHead |  |  |  | PageHead (AD-01); own loading added. Not seen: needs a staff session |
| `/admin/operations/providers` | FE | PageHead |  |  |  | PageHead (AD-01): was a raw h1; own loading added. Not seen: needs a staff session |
| `/admin/oversight` | FE | PageHead |  |  |  | PageHead (AD-01). Not seen: needs a staff session |
| `/admin/payments` | PAGES | PageHead |  |  |  | PageHead (AD-01: the one console header; DeskHeads wrap it). Not seen: needs a staff session |
| `/admin/people` | FE | PageHead |  |  |  | PageHead (AD-01). Not seen: needs a staff session |
| `/admin/people/[id]` | FE | PageHead |  |  |  | PageHead (AD-01). Not seen: needs a staff session |
| `/admin/queue` | FE | PageHead |  |  |  | PageHead (AD-01), total as trail; the lanes too. Not seen: needs a staff session |
| `/admin/reference` | FE | PageHead |  |  |  | PageHead (AD-01), refusal state too. Not seen: needs a staff session |
| `/admin/referrals` | FE | PageHead |  |  |  | PageHead (AD-01). Not seen: needs a staff session |
| `/admin/restaurant-fees` | FE | PageHead |  |  |  | PageHead (AD-01), disputes waiting as trail, 10 Nov. Not seen: needs a staff session |
| `/admin/retention` | FE | PageHead |  |  |  | PageHead (AD-01); own loading added. Not seen: needs a staff session |
| `/admin/review-calls` | PAGES | PageHead |  |  |  | PageHead (AD-01: the one console header; DeskHeads wrap it). Not seen: needs a staff session |
| `/admin/review-calls/[id]` | PAGES | PageHead |  |  |  | PageHead (AD-01: the one console header; DeskHeads wrap it). Not seen: needs a staff session |
| `/admin/settings` | FE | PageHead |  |  |  | PageHead (AD-01); own loading added. Not seen: needs a staff session |
| `/admin/social` | FE | PageHead |  |  |  | PageHead (AD-01), waiting count as trail, refusal state too. Not seen: needs a staff session |
| `/admin/staff` | FE | PageHead |  |  |  | PageHead (AD-01); own loading added. Not seen: needs a staff session |
| `/admin/standing` | FE | PageHead |  |  |  | PageHead (AD-01). Not seen: needs a staff session |
| `/admin/stops` | FE | PageHead |  |  |  | PageHead (AD-01), count as trail. Not seen: needs a staff session |
| `/admin/supply` | PAGES | PageHead |  |  |  | PageHead (AD-01: the one console header; DeskHeads wrap it). Not seen: needs a staff session |
| `/admin/support` | FE | PageHead |  |  |  | PageHead (AD-01), keys help as action, refusal state too. Not seen: needs a staff session |
| `/admin/switches` | FE | PageHead |  |  |  | PageHead (AD-01). Not seen: needs a staff session |
| `/admin/weight-withheld` | FE | PageHead |  |  |  | PageHead (AD-01); own loading added. Not seen: needs a staff session |

## Agent workspace

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/agent/analytics` | FE | PageFrame |  |  |  | PageFrame, Back in the header, bar Back off; shaped loading.tsx. Not seen: needs an agent session |
| `/agent/analytics/[metric]` | FE | PageFrame |  |  |  | PageFrame; the text Back link became the header Back. Not seen: needs an agent session |
| `/agent/analytics/listings/[listingId]` | FE | PageFrame |  |  |  | PageFrame; the text Back link became the header Back. Not seen: needs an agent session |
| `/agent/assistant` | FE |  |  |  |  |  |
| `/agent/bookings` | FE | PageFrame |  |  |  | PageFrame, Back in the header, bar Back off; shaped loading.tsx. Not seen: needs an agent session |
| `/agent/dashboard` | FE | PageFrame |  |  |  | PageFrame, workspace root: no Back; the Today band sits under it as h2. Not seen: needs an agent session |
| `/agent/earnings` | FE | PageFrame |  |  |  | PageFrame, Back in the header, bar Back off; shaped loading.tsx. Not seen: needs an agent session |
| `/agent/firm` | FE | PageFrame |  |  |  | PageFrame; the firm picker in the tab row. Not seen: needs an agent session |
| `/agent/inspections` | FE |  |  |  |  |  |
| `/agent/list` | FE |  |  |  |  |  |
| `/agent/listings` | FE | PageFrame |  |  |  | PageFrame; Start a listing and Firm desk in the header actions. Not seen: needs an agent session |
| `/agent/listings/[listingId]/arrival` | FE | PageFrame |  |  |  | PageFrame; the text link to My listings became the header Back. Not seen: needs an agent session |
| `/agent/listings/[listingId]/board` | FE | PageFrame |  |  |  | PageFrame (narrow); print layout unchanged. Not seen: needs an agent session |
| `/agent/listings/[listingId]/calendar` | FE | PageFrame |  |  |  | PageFrame; the text link to My listings became the header Back. Not seen: needs an agent session |
| `/agent/listings/[listingId]/health` | FE | PageFrame |  |  |  | PageFrame; the text link to My listings became the header Back. Not seen: needs an agent session |
| `/agent/listings/[listingId]/mandate` | FE | PageFrame |  |  |  | PageFrame (narrow). Not seen: needs an agent session |
| `/agent/listings/[listingId]/promotion` | FE | PageFrame |  |  |  | PageFrame, Back in the header, bar Back off; shaped loading.tsx. Not seen: needs an agent session |
| `/agent/listings/[listingId]/status` | FE | PageFrame |  |  |  | PageFrame (narrow). Not seen: needs an agent session |
| `/agent/messages` | FE | PageFrame |  |  |  | PageFrame, Back in the header, bar Back off; shaped loading.tsx. Not seen: needs an agent session |
| `/agent/messages/[id]` | FE |  |  |  |  |  |
| `/agent/notifications` | FE |  |  |  |  |  |
| `/agent/portfolio` | FE | PageFrame |  |  |  | PageFrame, Back in the header, bar Back off; shaped loading.tsx. Not seen: needs an agent session |
| `/agent/promotion` | FE | PageFrame |  |  |  | PageFrame, Back in the header, bar Back off, 10 Nov. Not seen: needs an agent session |
| `/agent/reviews` | FE | PageFrame |  |  |  | PageFrame, Back in the header, bar Back off; shaped loading.tsx. Not seen: needs an agent session |
| `/agent/settings` | FE | PageFrame |  |  |  | PageFrame, Back in the header, bar Back off; shaped loading.tsx. Not seen: needs an agent session |
| `/agent/verification` | FE | PageFrame |  |  |  | PageFrame, Back in the header, bar Back off; shaped loading.tsx. Not seen: needs an agent session |

## Host workspace

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/host` | FE | PageFrame |  |  |  | PageFrame, workspace root: no Back; the Today band sits under it as h2. Not seen: needs a host session; FE-BUGS 13 Nov: the signed-out gate had no h1 (measured in Chromium, 0 h1 on the document); its EmptyState now draws the title as the page's h1. Desk KPI labels at 320 and 360: 3 to 4 broken lines before, 2 after |
| `/host/apply` | FE |  |  |  |  | FE-BUGS 13 Nov: the signed-out gate had no h1 (measured in Chromium, 0 h1 on the document); its EmptyState now draws the title as the page's h1. Desk KPI labels at 320 and 360: 3 to 4 broken lines before, 2 after |
| `/host/arrival` | FE | PageFrame |  |  |  | PageFrame; business chips in the tab row. Not seen: needs a host session; FE-BUGS 13 Nov: the signed-out gate had no h1 (measured in Chromium, 0 h1 on the document); its EmptyState now draws the title as the page's h1. Desk KPI labels at 320 and 360: 3 to 4 broken lines before, 2 after |
| `/host/assistant` | FE |  |  |  |  |  |
| `/host/bookings` | FE | PageFrame |  |  |  | PageFrame wide, Back in the header, bar keeps the host's destinations, 10 Nov. Not seen: needs a host session; FE-BUGS 13 Nov: the signed-out gate had no h1 (measured in Chromium, 0 h1 on the document); its EmptyState now draws the title as the page's h1. Desk KPI labels at 320 and 360: 3 to 4 broken lines before, 2 after |
| `/host/calendar` | FE | PageFrame |  |  |  | PageFrame; property chips in the tab row; Back now in the header. Not seen: needs a host session; FE-BUGS 13 Nov: the signed-out gate had no h1 (measured in Chromium, 0 h1 on the document); its EmptyState now draws the title as the page's h1. Desk KPI labels at 320 and 360: 3 to 4 broken lines before, 2 after |
| `/host/decide` | FE | PageFrame |  |  |  | DecideView on PageFrame wide, Back in the header, bar keeps the host's destinations, 10 Nov. Not seen: needs a host session; FE-BUGS 13 Nov: the signed-out gate had no h1 (measured in Chromium, 0 h1 on the document); its EmptyState now draws the title as the page's h1. Desk KPI labels at 320 and 360: 3 to 4 broken lines before, 2 after |
| `/host/earnings` | FE | PageFrame |  |  |  | PageFrame under the host inner nav, as rooms; 10 Nov. Not seen: needs a host session; FE-BUGS 13 Nov: the signed-out gate had no h1 (measured in Chromium, 0 h1 on the document); its EmptyState now draws the title as the page's h1. Desk KPI labels at 320 and 360: 3 to 4 broken lines before, 2 after |
| `/host/earnings/statement` | FE |  |  |  |  | FE-BUGS 13 Nov: the signed-out gate had no h1 (measured in Chromium, 0 h1 on the document); its EmptyState now draws the title as the page's h1. Desk KPI labels at 320 and 360: 3 to 4 broken lines before, 2 after |
| `/host/notifications` | FE |  |  |  |  |  |
| `/host/photos` | FE | PageFrame |  |  |  | PageFrame; venue chips in the tab row. Not seen: needs a host session; FE-BUGS 13 Nov: the signed-out gate had no h1 (measured in Chromium, 0 h1 on the document); its EmptyState now draws the title as the page's h1. Desk KPI labels at 320 and 360: 3 to 4 broken lines before, 2 after |
| `/host/reservations` | FE | PageFrame |  |  |  | PageFrame; the desk keeps its search. Not seen: needs a host session; FE-BUGS 13 Nov: the signed-out gate had no h1 (measured in Chromium, 0 h1 on the document); its EmptyState now draws the title as the page's h1. Desk KPI labels at 320 and 360: 3 to 4 broken lines before, 2 after |
| `/host/reviews` | FE | PageFrame |  |  |  | HostReviewsView on PageFrame wide, Back in the header, 10 Nov. Not seen: needs a host session; FE-BUGS 13 Nov: the signed-out gate had no h1 (measured in Chromium, 0 h1 on the document); its EmptyState now draws the title as the page's h1. Desk KPI labels at 320 and 360: 3 to 4 broken lines before, 2 after |
| `/host/rooms` | FE | PageFrame |  |  |  | PageFrame; property chips in the tab row. Not seen: needs a host session; FE-BUGS 13 Nov: the signed-out gate had no h1 (measured in Chromium, 0 h1 on the document); its EmptyState now draws the title as the page's h1. Desk KPI labels at 320 and 360: 3 to 4 broken lines before, 2 after |
| `/host/settings` | FE | PageFrame |  |  |  | PageFrame, Back in the header, bar Back off; shaped loading.tsx. Not seen: needs a host session; FE-BUGS 13 Nov: the signed-out gate had no h1 (measured in Chromium, 0 h1 on the document); its EmptyState now draws the title as the page's h1. Desk KPI labels at 320 and 360: 3 to 4 broken lines before, 2 after |
| `/host/start` | FE |  |  |  |  |  |
| `/host/transfer` | FE | PageFrame |  |  |  | PageFrame, Back in the header, bar Back off; shaped loading.tsx. Not seen: needs a host session; FE-BUGS 13 Nov: the signed-out gate had no h1 (measured in Chromium, 0 h1 on the document); its EmptyState now draws the title as the page's h1. Desk KPI labels at 320 and 360: 3 to 4 broken lines before, 2 after |

## Member: about

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/about` | FE |  |  |  |  |  |

## Member: agreements

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/agreements` | PAGES | PageFrame | yes | yes | yes | R3 job 1; seen through /preview/pages-frame (real page, signed-out or not-found state; no session here); no Back while it holds the dock slot (social off); FE-BUGS 13 Nov: the page's own <main> was nested inside AppShell's, so two main landmarks (measured); it is a div now. nf-md did nothing here (declared only in the admin money desk sheet): the one-column grid and gap it claimed are real utilities now |
| `/agreements/[id]` | PAGES | PageFrame |  |  |  | R3 job 1: on PageFrame in code; signed-in only (redirect or not-found without a session), needs a fixture harness to see; FE-BUGS 13 Nov: the page's own <main> was nested inside AppShell's, so two main landmarks (measured); it is a div now. nf-md did nothing here (declared only in the admin money desk sheet): the one-column grid and gap it claimed are real utilities now |
| `/agreements/[id]/fund` | PAGES | PageFrame |  |  |  | R3 job 1: on PageFrame in code; signed-in only (redirect or not-found without a session), needs a fixture harness to see; loading.tsx in its own shape (SW12) |
| `/agreements/[id]/held` | PAGES | PageFrame |  |  |  | R3 job 1: on PageFrame in code; signed-in only (redirect or not-found without a session), needs a fixture harness to see; loading.tsx in its own shape (SW12) |

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
| `/checkout` | PAGES | PageFrame | yes | yes | yes | R3: PageFrame; loading in shape |
| `/checkout/[bookingId]` | PAGES | PageFrame | yes | yes | yes | R3 job 3: one progress mark, the step frame bar and its words; PageFrame with the scene behind the title band |

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
| `/compare` | PAGES | PageFrame | yes | yes | yes | R3 job 1; seen through /preview/pages-frame (real page, signed-out or not-found state; no session here); loading.tsx in its own shape (SW12) |

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
| `/directory` | PAGES | PageFrame top | yes | yes | yes | DirectoryScreen top is PageHeader large; loading in shape (was generic) |

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
| `/inspections/gate/[id]` | PAGES | PageFrame | yes | yes | yes | R3 job 1; seen through /preview/pages-frame (real page, signed-out or not-found state; no session here); loading.tsx in its own shape (SW12) |

## Member: landlord

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/landlord/[token]` | FE |  |  |  |  |  |

## Member: leaderboard

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/leaderboard` | PAGES | PageFrame top | yes | yes | yes | LeaderboardScreen top is PageHeader large; loading in shape (was generic); header lifted above the stage (seen 390/360 light and dark) |

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
| `/listing/[id]/offer` | UI | StepFrame | fixture | fixture | fixture | Offer flow: requirements, amount, payment, summary. Fixture preview only |
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
| `/offers` | UI | PageFrame | fixture | fixture | fixture | My offers: Made and Received with true counts. Fixture preview only; FE-BUGS 13 Nov: the page's own <main> was nested inside AppShell's, so two main landmarks (measured); it is a div now. nf-md did nothing here (declared only in the admin money desk sheet): the one-column grid and gap it claimed are real utilities now |
| `/offers/[id]` | UI | PageFrame | fixture | fixture | fixture | The Deal Room, both sides. Fixture preview only; FE-BUGS 13 Nov: the page's own <main> was nested inside AppShell's, so two main landmarks (measured); it is a div now. nf-md did nothing here (declared only in the admin money desk sheet): the one-column grid and gap it claimed are real utilities now |
| `/offline` | FE |  |  |  |  |  |

## Member: passport

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/passport/[who]` | PAGES | PageFrame | yes | yes | yes | R3 job 1; seen through /preview/pages-frame (real page, signed-out or not-found state; no session here) |

## Member: pay

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/pay/crypto/[reference]` | PAGES | PageFrame | yes | yes | yes | R3 job 1; seen through /preview/pages-frame (real page, signed-out or not-found state; no session here) |
| `/pay/deposit/[reservationId]` | PAGES | PageFrame | yes | yes | yes | R3 job 1; seen through /preview/pages-frame (real page, signed-out or not-found state; no session here); loading.tsx in its own shape (SW12) |

## Member: payments

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/payments` | PAGES | PageFrame | yes | yes | yes | R3 job 1; seen through /preview/pages-frame (real page, signed-out or not-found state; no session here); FE-BUGS 13 Nov: the page's own <main> was nested inside AppShell's, so two main landmarks (measured); it is a div now. nf-md did nothing here (declared only in the admin money desk sheet): the one-column grid and gap it claimed are real utilities now |

## Member: payouts

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/payouts` | PAGES | PageFrame | yes | yes | yes | R3 job 1; seen through /preview/pages-frame (real page, signed-out or not-found state; no session here); FE-BUGS 13 Nov: the page's own <main> was nested inside AppShell's, so two main landmarks (measured); it is a div now. nf-md did nothing here (declared only in the admin money desk sheet): the one-column grid and gap it claimed are real utilities now |

## Member: post

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/post/[id]` | FE |  |  |  |  |  7 Nov: its post card took the feed's new card (seen 390 light, 360 dark in `/preview/f4/post-thread`); the page pass itself is still to do. |

## Member: price

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/price` | PAGES | PageFrame | yes | yes | yes | R3 job 1; seen through /preview/pages-frame (real page, signed-out or not-found state; no session here); loading.tsx in its own shape (SW12) |
| `/price/area/[id]` | PAGES | PageFrame | yes | yes | yes | R3 job 1; seen through /preview/pages-frame (real page, signed-out or not-found state; no session here); loading.tsx in its own shape (SW12) |

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
| `/profile/setup` | PAGES | StepFrame | yes | yes | yes | R3 job 3: chooser on StepFrame, each door group as OptionCards, the door 3D object as step art; loading in shape. Seen via /preview/b1b/chooser |
| `/profile/setup/[role]` | PAGES | StepFrame | yes | yes | yes | R3 job 3: ApplyWizard on StepFrame (draft line as the save state). Seen via /preview/pages-frame?p=apply-wizard |
| `/profile/setup/agent` | PAGES | StepFrame | yes | yes | yes | R3 job 3: same RegisterShell on StepFrame. Seen via /preview/b1b/agent |
| `/profile/setup/firm` | PAGES | redirect |  |  |  | redirects to /profile/setup/agent (SUP-10) |
| `/profile/setup/owner` | PAGES | StepFrame | yes | yes | yes | R3 job 3: RegisterShell is StepFrame (eyebrow, Step N of M, Continue in the foot); done screen secondary under content. Seen via /preview/b1b/owner, owner-done |

## Member: r

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/r` | FE |  |  |  |  |  |
| `/r/[code]` | FE |  |  |  |  |  |

## Member: receipts

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/receipts` | PAGES | PageFrame | yes | yes | yes | R3 job 1; seen through /preview/pages-frame (real page, signed-out or not-found state; no session here); FE-BUGS 13 Nov: the page's own <main> was nested inside AppShell's, so two main landmarks (measured); it is a div now. nf-md did nothing here (declared only in the admin money desk sheet): the one-column grid and gap it claimed are real utilities now |

## Member: record

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/record/[code]` | PAGES | PageFrame | yes | yes | yes | R3 job 1; seen through /preview/pages-frame (real page, signed-out or not-found state; no session here) |

## Member: refunds

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/refunds` | PAGES | PageFrame | yes | yes | yes | R3 job 1; seen through /preview/pages-frame (real page, signed-out or not-found state; no session here); FE-BUGS 13 Nov: the page's own <main> was nested inside AppShell's, so two main landmarks (measured); it is a div now. nf-md did nothing here (declared only in the admin money desk sheet): the one-column grid and gap it claimed are real utilities now |

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
| `/rewards` | PAGES | PageFrame | yes | yes | yes | R3 job 1; seen through /preview/pages-frame (real page, signed-out or not-found state; no session here); loading.tsx in its own shape (SW12) |
| `/rewards/history` | PAGES | PageFrame | yes | yes | yes | R3 job 1; seen through /preview/pages-frame (real page, signed-out or not-found state; no session here); loading.tsx in its own shape (SW12) |
| `/rewards/referrals` | PAGES | PageFrame | yes | yes | yes | R3 job 1; seen through /preview/pages-frame (real page, signed-out or not-found state; no session here); loading.tsx in its own shape (SW12) |
| `/rewards/withdraw` | PAGES | PageFrame | yes | yes | yes | R3 job 1; seen through /preview/pages-frame (real page, signed-out or not-found state; no session here); loading.tsx in its own shape (SW12) |

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
| `/settings/ai-assistant` | PAGES | PageFrame | yes | yes | yes | R3: filled state seen via /preview/pages-frame?p=ai-assistant-on (sample rows); loading in shape |
| `/settings/ai-assistant/consent` | PAGES | PageFrame |  |  |  | R3 job 1: on PageFrame in code; signed-in only (redirect or not-found without a session), needs a fixture harness to see; loading.tsx in its own shape (SW12) |
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
| `/support` | PAGES | PageFrame | yes | yes | yes | E2: Back inside the page header (PageFrame "Help and support"), the hero below; loading matches |
| `/support/messages` | MSG |  |  |  |  |  |
| `/support/messages/[id]` | MSG |  |  |  |  |  |
| `/support/new` | PAGES | StepFrame | yes | yes | yes | R3 job 3: four steps (kind as OptionCards, topic, details, photo and Send); loading in the frame shape. Seen via /preview/support?screen=new |

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
| `/wallet` | PAGES | PageFrame top | yes | yes | yes | WalletHeader is now PageHeader large (round back, large title, gear action). Seen via /preview/money/wallet; FE-BUGS 13 Nov: the page's own <main> was nested inside AppShell's, so two main landmarks (measured); it is a div now. nf-md did nothing here (declared only in the admin money desk sheet): the one-column grid and gap it claimed are real utilities now |
| `/wallet/add` | PAGES | StepFrame | yes | yes | yes | R3 job 3: amount, check, pay on StepFrame. Seen via /preview/money/wallet?state=add* |
| `/wallet/send` | PAGES | StepFrame | yes | yes | yes | R3 job 3: amount, review (slide stays the only confirm), code on StepFrame; outcomes keep the wallet top. Seen via /preview/money/wallet?state=send* |
| `/wallet/settings` | PAGES | PageFrame top | yes | yes | yes | WalletHeader large; loading in its own shape (was the overview card); FE-BUGS 13 Nov: the page's own <main> was nested inside AppShell's, so two main landmarks (measured); it is a div now. nf-md did nothing here (declared only in the admin money desk sheet): the one-column grid and gap it claimed are real utilities now |
| `/wallet/transactions` | PAGES | PageFrame top | yes | yes | yes | WalletHeader large; loading in its own shape (was the overview card); FE-BUGS 13 Nov: the page's own <main> was nested inside AppShell's, so two main landmarks (measured); it is a div now. nf-md did nothing here (declared only in the admin money desk sheet): the one-column grid and gap it claimed are real utilities now |
| `/wallet/withdraw` | PAGES | StepFrame | yes | yes | yes | R3 job 3: amount, review (slide), code on StepFrame. Seen via /preview/money/wallet?state=withdraw* |

## Member: welcome

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/welcome` | FE |  |  |  |  |  |

## Public

| Page | Owner | Frame | Light | Dark | 360 | Notes |
|---|---|---|---|---|---|---|
| `/` | FE |  |  |  |  |  |
