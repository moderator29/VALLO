# Page sweep (27 October 2026)

One row per page route. **Swept** means: loaded signed out in Chromium at 390, 820, 1180, 1440 and 1920 px wide, in light and in dark, with no element crossing the screen edge and no broken image (`apps/web/scripts/design/responsive/sweep.mjs`, 270 combinations, all passing) and the pictures looked at for the pages named in the notes. **Needs session** means the page cannot open without a signed-in account, and none could be used from the build sandbox: these are unproven at the five widths and are listed for a device and browser pass with a QA account. **Dev harness** pages are closed in production and not part of the product.

Run it yourself: `BASE_URL=http://localhost:3000 node apps/web/scripts/design/responsive/sweep.mjs --shots` (set `VALLO_PUBLIC_CATALOGUE=on` on the server to include the catalogue). It exits with the number of failing combinations.

## What was found and fixed

| Page | Found | Fixed |
|---|---|---|
| Stays home, desktop and tablet | Four doors as a 2 by 2 block with empty space; the featured stays were a phone swipe deck showing one card of six in a wide empty row | Doors four across from 640 px; featured stays are a card grid (2 across tablet, 3 across laptop and up) and the stack stays on phones |
| Every door and category tile | The 3D art is a network image: on weak data the browser drew its broken-image glyph | `Icon3D` swaps to a branded glyph plate if the picture fails, including a failure before hydration |
| Unlock screen | Said "Face ID or fingerprint" on every device, offered a biometric door a desktop browser cannot run | Words and glyph follow the device (Face ID, Touch ID, fingerprint, Windows Hello, this device); the door is hidden when the browser has no platform lock; card centred on desktop |
| Chat photo viewer | Reported as phone chrome on desktop | Checked: the viewer draws no status bar; Escape, arrows, wheel zoom, download and counter work. The chrome in the screenshot is most likely the photo itself (a phone screenshot sent in chat). Not changed |
| Light mode, public pages | Reported as flat and bright | Looked at at 1440 and 390: photographic heroes, white cards on warm paper, solid blue actions. No defect found on the public pages, so nothing was changed. Signed-in light screens could not be opened here: **check them on a device** |

## Pages

| Route | Area | 5 widths, light and dark |
|---|---|---|
| `/` | member or public | swept |
| `/about` | member or public | swept |
| `/admin` | admin | needs session |
| `/admin/account-recovery` | admin | needs session |
| `/admin/agents` | admin | needs session |
| `/admin/agreements` | admin | needs session |
| `/admin/agreements/settings` | admin | needs session |
| `/admin/alerts` | admin | needs session |
| `/admin/analytics` | admin | needs session |
| `/admin/audit` | admin | needs session |
| `/admin/blocked-terms` | admin | needs session |
| `/admin/bookings` | admin | needs session |
| `/admin/bookings/[bookingId]` | admin | needs session |
| `/admin/bookings/reservations` | admin | needs session |
| `/admin/bookings/visits` | admin | needs session |
| `/admin/businesses` | admin | needs session |
| `/admin/call-usage` | admin | needs session |
| `/admin/chargebacks` | admin | needs session |
| `/admin/chargebacks/[chargebackId]` | admin | needs session |
| `/admin/compliance` | admin | needs session |
| `/admin/examples` | admin | needs session |
| `/admin/fees` | admin | needs session |
| `/admin/field-speed` | admin | needs session |
| `/admin/front-door` | admin | needs session |
| `/admin/handbook` | admin | needs session |
| `/admin/handbook/position` | admin | needs session |
| `/admin/kyc` | admin | needs session |
| `/admin/listings` | admin | needs session |
| `/admin/listings/[id]` | admin | needs session |
| `/admin/lookup` | admin | needs session |
| `/admin/money` | admin | needs session |
| `/admin/operations` | admin | needs session |
| `/admin/operations/providers` | admin | needs session |
| `/admin/oversight` | admin | needs session |
| `/admin/payments` | admin | needs session |
| `/admin/people` | admin | needs session |
| `/admin/people/[id]` | admin | needs session |
| `/admin/queue` | admin | needs session |
| `/admin/reference` | admin | needs session |
| `/admin/referrals` | admin | needs session |
| `/admin/restaurant-fees` | admin | needs session |
| `/admin/retention` | admin | needs session |
| `/admin/review-calls` | admin | needs session |
| `/admin/review-calls/[id]` | admin | needs session |
| `/admin/settings` | admin | needs session |
| `/admin/social` | admin | needs session |
| `/admin/staff` | admin | needs session |
| `/admin/standing` | admin | needs session |
| `/admin/stops` | admin | needs session |
| `/admin/supply` | admin | needs session |
| `/admin/support` | admin | needs session |
| `/admin/switches` | admin | needs session |
| `/admin/weight-withheld` | admin | needs session |
| `/agent/analytics` | agent | needs session |
| `/agent/analytics/[metric]` | agent | needs session |
| `/agent/analytics/listings/[listingId]` | agent | needs session |
| `/agent/assistant` | agent | needs session |
| `/agent/bookings` | agent | needs session |
| `/agent/dashboard` | agent | needs session |
| `/agent/earnings` | agent | needs session |
| `/agent/firm` | agent | needs session |
| `/agent/inspections` | agent | needs session |
| `/agent/list` | agent | needs session |
| `/agent/listings` | agent | needs session |
| `/agent/listings/[listingId]/arrival` | agent | needs session |
| `/agent/listings/[listingId]/board` | agent | needs session |
| `/agent/listings/[listingId]/calendar` | agent | needs session |
| `/agent/listings/[listingId]/health` | agent | needs session |
| `/agent/listings/[listingId]/mandate` | agent | needs session |
| `/agent/listings/[listingId]/promotion` | agent | needs session |
| `/agent/listings/[listingId]/status` | agent | needs session |
| `/agent/messages` | agent | needs session |
| `/agent/messages/[id]` | agent | needs session |
| `/agent/notifications` | agent | needs session |
| `/agent/portfolio` | agent | needs session |
| `/agent/promotion` | agent | needs session |
| `/agent/reviews` | agent | needs session |
| `/agent/settings` | agent | needs session |
| `/agent/verification` | agent | needs session |
| `/agreements` | member or public | needs session |
| `/agreements/[id]` | member or public | needs session |
| `/agreements/[id]/fund` | member or public | needs session |
| `/agreements/[id]/held` | member or public | needs session |
| `/areas/[state]/[area]` | member or public | needs session |
| `/around` | member or public | needs session |
| `/around/[slug]` | member or public | needs session |
| `/around/manage` | member or public | needs session |
| `/around/new` | member or public | needs session |
| `/around/people` | member or public | needs session |
| `/around/settings` | member or public | needs session |
| `/assistant` | member or public | needs session |
| `/auth/callback` | member or public | needs session |
| `/bookings` | member or public | needs session |
| `/bookings/[bookingId]` | member or public | needs session |
| `/bookings/[bookingId]/review` | member or public | needs session |
| `/calls/reviews` | member or public | needs session |
| `/calls/reviews/[id]` | member or public | needs session |
| `/cancellations` | member or public | swept |
| `/careers` | member or public | swept |
| `/check` | member or public | public, not in the sweep list |
| `/checkout` | member or public | needs session |
| `/checkout/[bookingId]` | member or public | needs session |
| `/contact` | member or public | swept |
| `/delete-account` | member or public | public, not in the sweep list |
| `/directory` | member or public | needs session |
| `/disclaimer` | member or public | swept |
| `/docs` | member or public | swept |
| `/docs/[slug]` | member or public | needs session |
| `/email/preferences` | member or public | needs session |
| `/eula` | member or public | swept |
| `/first-run/[feature]` | member or public | needs session |
| `/for-agents` | member or public | swept |
| `/for-hosts` | member or public | swept |
| `/for-landlords` | member or public | swept |
| `/forgot-password` | member or public | swept |
| `/forgot-password/code` | member or public | public, not in the sweep list |
| `/gallery` | dev harness | dev harness |
| `/gallery/brand-icons` | dev harness | dev harness |
| `/gallery/buttons` | dev harness | dev harness |
| `/gallery/charts` | dev harness | dev harness |
| `/gallery/containers` | dev harness | dev harness |
| `/gallery/document-sheet` | dev harness | dev harness |
| `/gallery/features` | dev harness | dev harness |
| `/gallery/figures` | dev harness | dev harness |
| `/gallery/ported` | dev harness | dev harness |
| `/gallery/segmented` | dev harness | dev harness |
| `/gallery/skeleton` | dev harness | dev harness |
| `/gallery/status-chip` | dev harness | dev harness |
| `/gallery/toast` | dev harness | dev harness |
| `/gallery/today-hero` | dev harness | dev harness |
| `/guides` | member or public | swept |
| `/guides/[slug]` | member or public | needs session |
| `/help` | member or public | swept |
| `/home` | member or public | needs session |
| `/host` | host | needs session |
| `/host-agreement` | host | swept |
| `/host/apply` | host | needs session |
| `/host/arrival` | host | needs session |
| `/host/assistant` | host | needs session |
| `/host/bookings` | host | needs session |
| `/host/calendar` | host | needs session |
| `/host/decide` | host | needs session |
| `/host/earnings` | host | needs session |
| `/host/earnings/statement` | host | needs session |
| `/host/notifications` | host | needs session |
| `/host/photos` | host | needs session |
| `/host/reservations` | host | needs session |
| `/host/reviews` | host | needs session |
| `/host/rooms` | host | needs session |
| `/host/settings` | host | needs session |
| `/host/start` | host | needs session |
| `/host/transfer` | host | needs session |
| `/inspections/gate/[id]` | member or public | needs session |
| `/landlord/[token]` | member or public | needs session |
| `/leaderboard` | member or public | needs session |
| `/legal/disclaimer` | member or public | needs session |
| `/legal/privacy` | member or public | needs session |
| `/legal/terms` | member or public | needs session |
| `/listing/[id]` | member or public | needs session |
| `/listing/[id]/trust` | member or public | needs session |
| `/listing/[id]/visit` | member or public | needs session |
| `/listing/[id]/visit/[inspectionId]` | member or public | needs session |
| `/messages` | member or public | needs session |
| `/messages/[id]` | member or public | needs session |
| `/messages/new` | member or public | needs session |
| `/messages/share/[kind]/[id]` | member or public | needs session |
| `/move-in-cost` | member or public | swept |
| `/notifications` | member or public | needs session |
| `/notifications/[id]` | member or public | needs session |
| `/offline` | member or public | swept |
| `/passport/[who]` | member or public | needs session |
| `/pay/crypto/[reference]` | member or public | needs session |
| `/pay/deposit/[reservationId]` | member or public | needs session |
| `/payments` | member or public | needs session |
| `/payouts` | member or public | needs session |
| `/post/[id]` | member or public | needs session |
| `/preview` | dev harness | dev harness |
| `/preview/b1b` | dev harness | dev harness |
| `/preview/b1b/agent` | dev harness | dev harness |
| `/preview/b1b/agent-done` | dev harness | dev harness |
| `/preview/b1b/chooser` | dev harness | dev harness |
| `/preview/b1b/firm` | dev harness | dev harness |
| `/preview/b1b/firm-done` | dev harness | dev harness |
| `/preview/b1b/open` | dev harness | dev harness |
| `/preview/b1b/owner` | dev harness | dev harness |
| `/preview/b1b/owner-done` | dev harness | dev harness |
| `/preview/b1b/respond` | dev harness | dev harness |
| `/preview/balance` | dev harness | dev harness |
| `/preview/bc` | dev harness | dev harness |
| `/preview/bc/audit` | dev harness | dev harness |
| `/preview/bd` | dev harness | dev harness |
| `/preview/bd/alerts` | dev harness | dev harness |
| `/preview/bd/payments` | dev harness | dev harness |
| `/preview/bd/refunds` | dev harness | dev harness |
| `/preview/bd/reservations` | dev harness | dev harness |
| `/preview/brand` | dev harness | dev harness |
| `/preview/buttons` | dev harness | dev harness |
| `/preview/c1` | dev harness | dev harness |
| `/preview/c1/listing-review` | dev harness | dev harness |
| `/preview/c2` | dev harness | dev harness |
| `/preview/c2/facilities-and-photos` | dev harness | dev harness |
| `/preview/c2/host-property-photos` | dev harness | dev harness |
| `/preview/c2/host-property-photos-empty` | dev harness | dev harness |
| `/preview/c2/host-rooms` | dev harness | dev harness |
| `/preview/c2/host-rooms-no-nights` | dev harness | dev harness |
| `/preview/calls` | dev harness | dev harness |
| `/preview/calls/[state]` | dev harness | dev harness |
| `/preview/cards` | dev harness | dev harness |
| `/preview/chargebacks` | dev harness | dev harness |
| `/preview/chargebacks/case` | dev harness | dev harness |
| `/preview/chargebacks/hold` | dev harness | dev harness |
| `/preview/chat-hints` | dev harness | dev harness |
| `/preview/chat-polish` | dev harness | dev harness |
| `/preview/db2` | dev harness | dev harness |
| `/preview/db2/blocked` | dev harness | dev harness |
| `/preview/details` | dev harness | dev harness |
| `/preview/directory` | dev harness | dev harness |
| `/preview/door` | dev harness | dev harness |
| `/preview/email` | dev harness | dev harness |
| `/preview/email/welcome` | dev harness | dev harness |
| `/preview/f1` | dev harness | dev harness |
| `/preview/f1/assistant` | dev harness | dev harness |
| `/preview/f1/chrome` | dev harness | dev harness |
| `/preview/f1/dock-stays` | dev harness | dev harness |
| `/preview/f1/drawer` | dev harness | dev harness |
| `/preview/f1/home` | dev harness | dev harness |
| `/preview/f1/notifications` | dev harness | dev harness |
| `/preview/f1/switch` | dev harness | dev harness |
| `/preview/f1/welcome` | dev harness | dev harness |
| `/preview/f2` | dev harness | dev harness |
| `/preview/f3` | dev harness | dev harness |
| `/preview/f3/bookings` | dev harness | dev harness |
| `/preview/f3/checkout` | dev harness | dev harness |
| `/preview/f3/listing` | dev harness | dev harness |
| `/preview/f3/listing-media` | dev harness | dev harness |
| `/preview/f3/listing/sale` | dev harness | dev harness |
| `/preview/f3/move-in` | dev harness | dev harness |
| `/preview/f3/restaurant` | dev harness | dev harness |
| `/preview/f3/restaurants` | dev harness | dev harness |
| `/preview/f3/saved` | dev harness | dev harness |
| `/preview/f3/search` | dev harness | dev harness |
| `/preview/f3/search-map` | dev harness | dev harness |
| `/preview/f3/stay` | dev harness | dev harness |
| `/preview/f3/stays` | dev harness | dev harness |
| `/preview/f3/stays-search` | dev harness | dev harness |
| `/preview/f3/trips` | dev harness | dev harness |
| `/preview/f4` | dev harness | dev harness |
| `/preview/f4/assistant` | dev harness | dev harness |
| `/preview/f4/delete-sheet` | dev harness | dev harness |
| `/preview/f4/edit-profile` | dev harness | dev harness |
| `/preview/f4/feed` | dev harness | dev harness |
| `/preview/f4/feed-bloom` | dev harness | dev harness |
| `/preview/f4/feed-dock` | dev harness | dev harness |
| `/preview/f4/feed-media` | dev harness | dev harness |
| `/preview/f4/notifications` | dev harness | dev harness |
| `/preview/f4/place` | dev harness | dev harness |
| `/preview/f4/post-thread` | dev harness | dev harness |
| `/preview/f4/profile` | dev harness | dev harness |
| `/preview/f4/public-profile` | dev harness | dev harness |
| `/preview/f4/settings` | dev harness | dev harness |
| `/preview/f4/sheets` | dev harness | dev harness |
| `/preview/f4/story` | dev harness | dev harness |
| `/preview/f4/story-new` | dev harness | dev harness |
| `/preview/f4/thread-empty` | dev harness | dev harness |
| `/preview/f5` | dev harness | dev harness |
| `/preview/f5/admin-desks` | dev harness | dev harness |
| `/preview/f5/admin-frame` | dev harness | dev harness |
| `/preview/f5/admin-overview` | dev harness | dev harness |
| `/preview/f5/admin-queue` | dev harness | dev harness |
| `/preview/f5/agent-analytics` | dev harness | dev harness |
| `/preview/f5/agent-assistant` | dev harness | dev harness |
| `/preview/f5/agent-bookings` | dev harness | dev harness |
| `/preview/f5/agent-dashboard` | dev harness | dev harness |
| `/preview/f5/agent-earnings` | dev harness | dev harness |
| `/preview/f5/agent-inspections` | dev harness | dev harness |
| `/preview/f5/agent-list` | dev harness | dev harness |
| `/preview/f5/agent-list-sent` | dev harness | dev harness |
| `/preview/f5/agent-listings` | dev harness | dev harness |
| `/preview/f5/agent-messages` | dev harness | dev harness |
| `/preview/f5/agent-reviews` | dev harness | dev harness |
| `/preview/f5/agent-settings` | dev harness | dev harness |
| `/preview/f5/agent-verification` | dev harness | dev harness |
| `/preview/f5/confirm` | dev harness | dev harness |
| `/preview/f5/host-assistant` | dev harness | dev harness |
| `/preview/f5/host-empty` | dev harness | dev harness |
| `/preview/f5/host-landing` | dev harness | dev harness |
| `/preview/f5/host-settings` | dev harness | dev harness |
| `/preview/f5/host-transfer` | dev harness | dev harness |
| `/preview/f5/host-wizard` | dev harness | dev harness |
| `/preview/f5/inbox` | dev harness | dev harness |
| `/preview/f5/inspection` | dev harness | dev harness |
| `/preview/f5/share-picker` | dev harness | dev harness |
| `/preview/f5/thread-booking` | dev harness | dev harness |
| `/preview/f5/thread-booking-card` | dev harness | dev harness |
| `/preview/f5/thread-booking-context` | dev harness | dev harness |
| `/preview/f5/thread-rental` | dev harness | dev harness |
| `/preview/feed-v2` | dev harness | dev harness |
| `/preview/fixes` | dev harness | dev harness |
| `/preview/fixes/filters` | dev harness | dev harness |
| `/preview/fixes/providers` | dev harness | dev harness |
| `/preview/front-door` | dev harness | dev harness |
| `/preview/fund` | dev harness | dev harness |
| `/preview/g1` | dev harness | dev harness |
| `/preview/g1/sheet` | dev harness | dev harness |
| `/preview/g1/surfaces` | dev harness | dev harness |
| `/preview/g2` | dev harness | dev harness |
| `/preview/g4` | dev harness | dev harness |
| `/preview/g4/app-error` | dev harness | dev harness |
| `/preview/g4/error` | dev harness | dev harness |
| `/preview/g4/legal` | dev harness | dev harness |
| `/preview/g4/loading` | dev harness | dev harness |
| `/preview/g4/not-found` | dev harness | dev harness |
| `/preview/g5` | dev harness | dev harness |
| `/preview/g5/all` | dev harness | dev harness |
| `/preview/gap-lane5` | dev harness | dev harness |
| `/preview/held` | dev harness | dev harness |
| `/preview/home-dock` | dev harness | dev harness |
| `/preview/hospitality` | dev harness | dev harness |
| `/preview/host-c` | dev harness | dev harness |
| `/preview/host-c/calendar` | dev harness | dev harness |
| `/preview/host-c/decide` | dev harness | dev harness |
| `/preview/host-c/reviews` | dev harness | dev harness |
| `/preview/host-c/setup` | dev harness | dev harness |
| `/preview/host-c/statement` | dev harness | dev harness |
| `/preview/icons` | dev harness | dev harness |
| `/preview/icons-3d` | dev harness | dev harness |
| `/preview/imgc` | dev harness | dev harness |
| `/preview/imgc/facilities` | dev harness | dev harness |
| `/preview/imgc/hotel` | dev harness | dev harness |
| `/preview/imgc/house-rules` | dev harness | dev harness |
| `/preview/imgc/place` | dev harness | dev harness |
| `/preview/imgc/rates` | dev harness | dev harness |
| `/preview/imgc/restaurant` | dev harness | dev harness |
| `/preview/imgc/room-types` | dev harness | dev harness |
| `/preview/imgc/tables` | dev harness | dev harness |
| `/preview/landlord` | dev harness | dev harness |
| `/preview/lead` | dev harness | dev harness |
| `/preview/lead/dock` | dev harness | dev harness |
| `/preview/lead/drawer` | dev harness | dev harness |
| `/preview/lead/flip` | dev harness | dev harness |
| `/preview/leaderboard` | dev harness | dev harness |
| `/preview/m2` | dev harness | dev harness |
| `/preview/m2/agreement` | dev harness | dev harness |
| `/preview/m2/ask` | dev harness | dev harness |
| `/preview/m2/day-kit` | dev harness | dev harness |
| `/preview/m2/listing` | dev harness | dev harness |
| `/preview/m2/rent` | dev harness | dev harness |
| `/preview/m2/scam` | dev harness | dev harness |
| `/preview/m2/split` | dev harness | dev harness |
| `/preview/money` | dev harness | dev harness |
| `/preview/money/wallet` | dev harness | dev harness |
| `/preview/o3` | dev harness | dev harness |
| `/preview/o3/agent-calendar` | dev harness | dev harness |
| `/preview/o3/styleguide-buttons` | dev harness | dev harness |
| `/preview/onboarding` | dev harness | dev harness |
| `/preview/p3` | dev harness | dev harness |
| `/preview/p3/admin-businesses` | dev harness | dev harness |
| `/preview/p3/host-photos` | dev harness | dev harness |
| `/preview/p3/host-reservations` | dev harness | dev harness |
| `/preview/p3/host-reservations-empty` | dev harness | dev harness |
| `/preview/p5` | dev harness | dev harness |
| `/preview/p5/gate` | dev harness | dev harness |
| `/preview/p5/invite` | dev harness | dev harness |
| `/preview/p5/payments` | dev harness | dev harness |
| `/preview/p5/payouts` | dev harness | dev harness |
| `/preview/p5/receipt` | dev harness | dev harness |
| `/preview/p5/receipts` | dev harness | dev harness |
| `/preview/p5/refunds` | dev harness | dev harness |
| `/preview/p5/waiting` | dev harness | dev harness |
| `/preview/p5/wallet` | dev harness | dev harness |
| `/preview/p6` | dev harness | dev harness |
| `/preview/p6/notifications` | dev harness | dev harness |
| `/preview/p6/pro` | dev harness | dev harness |
| `/preview/p6/settings-notifications` | dev harness | dev harness |
| `/preview/p6/tracker` | dev harness | dev harness |
| `/preview/passcode` | dev harness | dev harness |
| `/preview/passport` | dev harness | dev harness |
| `/preview/pay` | dev harness | dev harness |
| `/preview/pay-stage` | dev harness | dev harness |
| `/preview/platform` | dev harness | dev harness |
| `/preview/price` | dev harness | dev harness |
| `/preview/price/answered` | dev harness | dev harness |
| `/preview/price/area` | dev harness | dev harness |
| `/preview/price/refusals` | dev harness | dev harness |
| `/preview/price/share` | dev harness | dev harness |
| `/preview/pro` | dev harness | dev harness |
| `/preview/promotion` | dev harness | dev harness |
| `/preview/referral-desk` | dev harness | dev harness |
| `/preview/restaurant-deposits` | dev harness | dev harness |
| `/preview/restaurant-desk` | dev harness | dev harness |
| `/preview/rewards` | dev harness | dev harness |
| `/preview/rewards/history` | dev harness | dev harness |
| `/preview/rewards/paused` | dev harness | dev harness |
| `/preview/rewards/referrals` | dev harness | dev harness |
| `/preview/rewards/today` | dev harness | dev harness |
| `/preview/rewards/withdraw` | dev harness | dev harness |
| `/preview/session-b` | dev harness | dev harness |
| `/preview/session-b/admin` | dev harness | dev harness |
| `/preview/session-b/admin-review` | dev harness | dev harness |
| `/preview/session-b/admin-review/[desk]` | dev harness | dev harness |
| `/preview/session-b/admin/analytics` | dev harness | dev harness |
| `/preview/session-b/admin/back` | dev harness | dev harness |
| `/preview/session-b/admin/operations` | dev harness | dev harness |
| `/preview/session-b/admin/overview` | dev harness | dev harness |
| `/preview/session-b/audit2-fixes` | dev harness | dev harness |
| `/preview/session-b/feed` | dev harness | dev harness |
| `/preview/session-b/inspection` | dev harness | dev harness |
| `/preview/session-b/inspection/shell` | dev harness | dev harness |
| `/preview/session-b/posts` | dev harness | dev harness |
| `/preview/session-b/profile` | dev harness | dev harness |
| `/preview/session-b/signin` | dev harness | dev harness |
| `/preview/session-b/sweep-home` | dev harness | dev harness |
| `/preview/session-b/sweep-home/assistant` | dev harness | dev harness |
| `/preview/session-b/sweep-home/home` | dev harness | dev harness |
| `/preview/session-b/sweep-home/home-empty` | dev harness | dev harness |
| `/preview/session-b/sweep-home/listing` | dev harness | dev harness |
| `/preview/session-b/sweep-home/listing-parts` | dev harness | dev harness |
| `/preview/session-b/sweep-home/loading` | dev harness | dev harness |
| `/preview/session-b/sweep-home/move-in` | dev harness | dev harness |
| `/preview/session-b/sweep-home/price` | dev harness | dev harness |
| `/preview/session-b/sweep-home/price-answered` | dev harness | dev harness |
| `/preview/session-b/sweep-home/price-area` | dev harness | dev harness |
| `/preview/session-b/sweep-home/price-share` | dev harness | dev harness |
| `/preview/session-b/sweep-home/search` | dev harness | dev harness |
| `/preview/session-b/sweep-home/search-empty` | dev harness | dev harness |
| `/preview/session-b/sweep-home/stays` | dev harness | dev harness |
| `/preview/session-b/sweep-orphans` | dev harness | dev harness |
| `/preview/session-b/sweep-settings` | dev harness | dev harness |
| `/preview/session-b/sweep-social` | dev harness | dev harness |
| `/preview/session-b/sweep-stays` | dev harness | dev harness |
| `/preview/session-b/sweep-stays/checkout` | dev harness | dev harness |
| `/preview/session-b/sweep-stays/pay-failed` | dev harness | dev harness |
| `/preview/session-b/sweep-stays/pay-pending` | dev harness | dev harness |
| `/preview/session-b/sweep-stays/restaurant` | dev harness | dev harness |
| `/preview/session-b/sweep-stays/restaurants` | dev harness | dev harness |
| `/preview/session-b/sweep-stays/stay` | dev harness | dev harness |
| `/preview/session-b/sweep-stays/stays` | dev harness | dev harness |
| `/preview/session-b/sweep-stays/stays-search` | dev harness | dev harness |
| `/preview/session-b/sweep-stays/trips` | dev harness | dev harness |
| `/preview/session-b/welcome` | dev harness | dev harness |
| `/preview/shell-icons` | dev harness | dev harness |
| `/preview/success` | dev harness | dev harness |
| `/preview/support` | dev harness | dev harness |
| `/preview/support-staff` | dev harness | dev harness |
| `/preview/track-f` | dev harness | dev harness |
| `/preview/track-g` | dev harness | dev harness |
| `/preview/track-j` | dev harness | dev harness |
| `/preview/visit` | dev harness | dev harness |
| `/preview/visit-ops` | dev harness | dev harness |
| `/preview/visit-ops/admin` | dev harness | dev harness |
| `/preview/visit-ops/lister` | dev harness | dev harness |
| `/preview/warm-spark` | dev harness | dev harness |
| `/preview/workspace-dash` | dev harness | dev harness |
| `/price` | member or public | needs session |
| `/price/area/[id]` | member or public | needs session |
| `/privacy` | member or public | swept |
| `/pro` | member or public | needs session |
| `/pro/confirm` | member or public | needs session |
| `/profile` | member or public | needs session |
| `/profile/application` | member or public | needs session |
| `/profile/setup` | member or public | needs session |
| `/profile/setup/[role]` | member or public | needs session |
| `/profile/setup/agent` | member or public | needs session |
| `/profile/setup/firm` | member or public | needs session |
| `/profile/setup/owner` | member or public | needs session |
| `/r` | member or public | public, not in the sweep list |
| `/r/[code]` | member or public | needs session |
| `/receipts` | member or public | needs session |
| `/record/[code]` | member or public | needs session |
| `/refunds` | member or public | needs session |
| `/rent/move-in/[listingId]` | member or public | needs session |
| `/rent/pay/[inspectionId]` | member or public | needs session |
| `/rent/review/[paymentId]` | member or public | needs session |
| `/rent/share/[id]` | member or public | needs session |
| `/reset-password` | member or public | public, not in the sweep list |
| `/restaurant/[id]` | member or public | needs session |
| `/restaurants` | member or public | swept |
| `/rewards` | member or public | needs session |
| `/rewards/history` | member or public | needs session |
| `/rewards/referrals` | member or public | needs session |
| `/rewards/withdraw` | member or public | needs session |
| `/s/[token]` | member or public | needs session |
| `/safe/[token]` | member or public | needs session |
| `/safety` | member or public | swept |
| `/saved` | member or public | needs session |
| `/saved/searches` | member or public | needs session |
| `/search` | member or public | swept |
| `/settings` | member or public | needs session |
| `/settings/accessibility` | member or public | needs session |
| `/settings/account` | member or public | needs session |
| `/settings/appearance` | member or public | needs session |
| `/settings/devices` | member or public | needs session |
| `/settings/devices/alert` | member or public | needs session |
| `/settings/help` | member or public | needs session |
| `/settings/interests` | member or public | needs session |
| `/settings/invite` | member or public | needs session |
| `/settings/invite/how-it-works` | member or public | needs session |
| `/settings/invite/referrals` | member or public | needs session |
| `/settings/invite/referrals/[id]` | member or public | needs session |
| `/settings/notifications` | member or public | needs session |
| `/settings/passcode` | member or public | needs session |
| `/settings/passport` | member or public | needs session |
| `/settings/payments` | member or public | needs session |
| `/settings/phone` | member or public | needs session |
| `/settings/place` | member or public | needs session |
| `/settings/privacy` | member or public | needs session |
| `/settings/privacy/ai` | member or public | needs session |
| `/settings/privacy/blocked` | member or public | needs session |
| `/settings/privacy/data` | member or public | needs session |
| `/settings/privacy/money-lock` | member or public | needs session |
| `/settings/region` | member or public | needs session |
| `/sign-in` | member or public | swept |
| `/sign-in/code` | member or public | public, not in the sweep list |
| `/sign-in/email` | member or public | public, not in the sweep list |
| `/sign-in/phone` | member or public | public, not in the sweep list |
| `/sign-up` | member or public | swept |
| `/sign-up/email` | member or public | public, not in the sweep list |
| `/sign-up/finish` | member or public | public, not in the sweep list |
| `/sign-up/verify` | member or public | public, not in the sweep list |
| `/standards` | member or public | swept |
| `/stay/[id]` | member or public | needs session |
| `/stays` | member or public | swept |
| `/stays/search` | member or public | needs session |
| `/stories/[id]` | member or public | needs session |
| `/stories/new` | member or public | needs session |
| `/styleguide` | member or public | public, not in the sweep list |
| `/support` | member or public | needs session |
| `/support/messages` | member or public | needs session |
| `/support/messages/[id]` | member or public | needs session |
| `/support/new` | member or public | needs session |
| `/tenancy/[id]` | member or public | needs session |
| `/tenancy/[id]/complaint` | member or public | needs session |
| `/terms` | member or public | swept |
| `/u` | member or public | needs session |
| `/u/[handle]` | member or public | needs session |
| `/u/[handle]/edit` | member or public | needs session |
| `/u/[handle]/followers` | member or public | needs session |
| `/u/[handle]/following` | member or public | needs session |
| `/u/[handle]/message` | member or public | needs session |
| `/verification` | member or public | needs session |
| `/wallet` | member or public | needs session |
| `/wallet/add` | member or public | needs session |
| `/wallet/send` | member or public | needs session |
| `/wallet/settings` | member or public | needs session |
| `/wallet/transactions` | member or public | needs session |
| `/wallet/withdraw` | member or public | needs session |
| `/welcome` | member or public | swept |
