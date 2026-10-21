# Room checkout: paying for a hotel room on Vallo

Added 29 September 2026 (ROOM BOOKINGS 1, migration `20260929170728`). This page explains how a guest books and pays for a hotel room, how the host is paid, and how to switch it on. The money rules are the ones in [MONEY_ARCHITECTURE.md](MONEY_ARCHITECTURE.md): a room stay is paid exactly the way every other stay is, and Vallo never holds the money.

## Status today

**Off.** The switch `room_bookings` in `feature_flags` is off. While it is off:

- the checkout for a hotel room shows the same "not open yet" screen it always has;
- `requestRoomStay` refuses before it writes anything;
- the database refuses any room booking, whoever writes it (`room_bookings_off`), so the switch cannot be bypassed through the API.

Nothing about listing stays (apartments, shortlets) changes, whether the switch is on or off.

## The journey, step by step

1. **The guest picks a room.** On a hotel's page the guest chooses a room type, a rate plan and dates, and opens `/checkout`. With the switch on and signed in, they see the price, a rooms picker (1 up to the rooms of that type; the database refuses more than are free) and **Request this room**. Signed out, they are asked to sign in first and come back to the same checkout.
2. **The request is written, and the database prices it.** `requestRoomStay` (`lib/stays/room-booking-actions.ts`) inserts a PENDING booking through the guest's own session, naming the accommodation, room type, rate plan, rooms, dates and guests. The guest never sends a price that counts: `private.price_room_booking` works it out from the host's rate plan and rate calendar (each night's calendar price, or the plan's rate), times the rooms. It also refuses:
   - a hotel that is not published;
   - a guest booking their own hotel;
   - dates in the past, a stay over 90 nights, or outside the plan's minimum and maximum stay;
   - a closed night on the calendar;
   - more than 10 rooms, or more rooms than are free;
   - a second pending request at the same hotel, and the usual hold limits.

   Each refusal is shown to the guest in plain words (`lib/stays/room-refusals.ts`).
3. **The nights are held.** A trigger on bookings (`bookings_hold_and_release_rooms`) reserves the rooms on each night in `room_inventory` as soon as the request is written, so two guests cannot both get the last room. If the booking is cancelled or declined, the nights are given back.
4. **The host answers.** The business owner sees the request on **Host > Room bookings** (`/host/bookings`), grouped as waiting, upcoming and past, and gets a notification. They **Accept** or **Decline** (with an optional reason). Only the owner of the hotel's business can answer, and only while the booking is still PENDING.
5. **Accepting draws up the stay agreement.** The same trigger that serves every stay creates a `deal_agreements` row of kind `stay`, naming the accommodation instead of a listing, with the business owner as the owner, the database's total as the amount and the platform cancellation schedule frozen into its terms.
6. **Both confirm.** The agreement goes through the normal gate: both sides confirm the same version. Since D83 (8 October 2026) the second confirmation approves it; a person at Vallo steps in only while the `agreement_staff_review` switch is on (it is off) or a direct-rail risk signal fires (D77), and then approves or rejects it on **Money > Agreements**. The queue links a room stay to the hotel's page.
7. **The guest pays by card.** Once approved, the guest's checkout at `/checkout/<booking>` opens payment. `payment_split_for_booking` returns the split and Paystack divides the one charge:
   - the host's share goes to the host's own Paystack subaccount;
   - the Guarantee leg carries nothing: `money_policy.guarantee_bps` is 0 live (the Guarantee is retired, D51), though the reserve subaccount must still be configured because the split code reads it;
   - Vallo's commission goes to Vallo. Founder ruling of 13 October 2026 (draft `pending/pov06_hotel_room_commission.sql`, not yet applied): on a hotel room it is 10 percent (1,000 basis points) of the charge, taken from the host's share and never added to the guest's price, read from `public.scoped_commission_rates` at the moment the agreement was drawn up. A hotel room is paid by card only; the escrow choice is for rents and shortlets.
8. **Settlement.** Paystack's webhook runs `settle_booking_charge`, which records the transaction and ledger entry, the Guarantee contribution and marks the agreement paid. The host sees the payment under **Host > Earnings**, named after the hotel.
9. **After the stay.** The nightly completion sweep marks the stay completed after check-out, exactly as for listings.

A worked example: one room, three nights at ₦50,000, ₦60,000 and ₦50,000 is ₦160,000. With the Guarantee at 0 and the hotel commission at 10 percent (`DECISIONS_2026-10-13.md` row 22; a dated row in `public.scoped_commission_rates`, applied `20261013171019_pov06_hotel_room_commission.sql`, taken at the rate in force when the room was booked), the host receives ₦144,000, less the processor's fee, and ₦16,000 goes to Vallo.

## How the host gets paid

The split needs a Paystack subaccount for whoever is paid.

- **An agent or firm** is paid through the subaccount they already have from agent onboarding, as for listings.
- **Any other hotel owner** is paid through their **default bank account** on Vallo. When they add a bank account, change their default, or accept their first room request, Vallo creates a Paystack subaccount for that account (`ensureHostSubaccount` in `lib/payments/payee-subaccount.ts`) and stores its code on `bank_accounts.paystack_subaccount_code`.

If no subaccount exists when the guest comes to pay, payment does not open and nothing is charged: the guest reads that the host has not finished setting up where they are paid. Money is never collected first and paid out later.

## Cancelling and refunds

- Before payment, the guest can cancel from their trip, and the host can decline. The nights are released at once.
- After payment, the refund is priced from the cancellation terms frozen when the booking was accepted. Every stay, room stays included, uses the platform schedule: a full refund up to 72 hours before check-in (15:00 Lagos), half after that. Refunds go back to the card through Paystack, the same as every stay, and a person handles them from the Bookings desk.
- The rate plan's own cancellation policy is not used for pricing a refund yet: the platform schedule applies to every room stay.

## Test mode

Nothing in this flow chooses live or test money on its own. The Paystack account is chosen by the deployment (`lib/payments/paystack-mode.ts`):

- **Production** (`VERCEL_ENV=production`) uses the live key.
- **Preview and local** use `PAYSTACK_TEST_SECRET_KEY` when it is set, and refuse a live key unless `PAYSTACK_MODE=live` says so on purpose.

To rehearse the whole journey with test cards, switch `room_bookings` on while testing on a Preview deployment that has the test key. Note: subaccounts are created per Paystack mode, so a host's test subaccount does not carry over to live (and the other way round), the same as for agents.

## Switching it on

When the founder is ready, either:

- on the console, **Settings > Switches** (`/admin/switches`): turn on `room_bookings`; or
- in SQL: `update public.feature_flags set enabled = true where key = 'room_bookings';`

Pages pick up the change within about thirty seconds. Switching it off again stops new requests at once; bookings already made keep going through their agreement and payment as normal.

Before switching on in Production, make sure:

1. `PAYSTACK_GUARANTEE_SUBACCOUNT` is set (payment never opens without it);
2. the hotels you want bookable are published, with room types, rate plans and room inventory filled in;
3. each hotel owner has a default bank account on Vallo (or is an agent with a subaccount).

## Instant booking at the published price (D73, switch `stays_instant_pay`)

The founder's ruling of 7 October 2026 (D73 in `docs/RULINGS.md`): a booking at a price the business fixed is booked and paid in one flow, the way a hotel booking API such as LiteAPI works. No host acceptance and no Vallo review stand between a guest and paying a published price. Rentals and anything negotiated keep the agreement and review, and go to escrow (Part B).

**Status: live and ON since 8 October 2026** (the founder switched it on; the 15-minute sweep that releases an unpaid instant booking is applied as `20261008164113_d73a_stays_instant_pay_sweep.sql`). A missing row reads as off.

**Which bookings.** Read from the live schema:

- a **hotel room** (`bookings.room_type_id` set), priced by `private.price_room_booking` from the rate plan and calendar;
- a **listing stay** at a published nightly rate (`listings.rate_period = 'night'`: shortlets, serviced apartments), priced by `private.price_booking_from_listing`.

Nothing else. A rent charge is never touched. **Restaurants take no payment on Vallo at all**: a table is a `reservations` row with no price, and no transaction names one. A per-head (`guest`) rate is already refused by the stay pricing.

**With the switch on, step by step.**

1. The guest picks a room, rate and dates and sees the database's total on `/checkout` (or the nightly total on a listing). The button reads **Book and pay**.
2. The guest's own insert runs every check it runs today: the insert policy, the database price (anything the client sends is ignored), the hold limits, closed nights and the room inventory hold. A refusal is shown exactly as today.
3. In the same transaction the trigger `bookings_instant_when_fixed_price` draws up the stay agreement at the booking's database total, with the same terms the host acceptance path writes plus `instant_booking: true`. The platform cancellation schedule is added and frozen by the existing agreement triggers. The agreement is recorded **approved by the system**: `decided_by` is empty, `decision_reason` is "Fixed price, instant booking.", `deal_agreement_events` gets `opened` and `approved` with no actor, and `audit_log` gets `agreement.approve` with `decided_by: system`. The booking moves to CONFIRMED and `booking_state_events` says why.
4. The guest lands on `/checkout/<booking>` with payment open and a 30 minute countdown. The payment gate (`private.transactions_payment_gate`), the split (`payment_split_for_booking`), the Paystack charge and `settle_booking_charge` are **unchanged**: the gate already asks for an approved agreement at the charge's amount, and this one is.
5. If the guest does not pay, the existing sweep (`private.expire_booking_holds`, every 15 minutes) cancels the booking 30 minutes after it was made (up to 2 hours while Paystack says a payment is still moving), cancels the agreement and gives the nights back. So the release lands between 30 and 45 minutes.

**When it stays a request.** The booking quietly keeps today's flow (a PENDING request for the host) when the switch is off; when the host cannot be paid yet (`payment_split_for_booking` is not `ok`, usually no payout subaccount); when an agent has no live mandate for the listing; when the booking is written by the service role (tests, repairs, the console) rather than by the guest's own session; or when anything in the instant step fails, which also raises a `risk_alerts` row. The guest is never refused because of the instant path.

**What people are told.** The host gets "New booking: booked at your published price, the guest is paying now". The guest gets "Pay to keep your booking". Nobody gets "terms waiting for your confirmation", and the listing "request sent" emails are not sent for an instant booking.

**Functions changed on the database** (each copied from the live definition first): `private.expire_booking_holds` (one branch for instant agreements), `private.notify_booking_change` (the instant wording), `private.enqueue_agreement_lifecycle_email` (an agreement inserted already approved sends no "waiting" email; every insert today is `awaiting_parties`, so nothing else changes). New: `private.book_stay_instantly`, `private.stays_instant_pay_on`, `private.instant_pay_window`.

**Switching it on.** Apply the migration and move its probe (`supabase/tests/probes-pending/d73a-stays-instant-pay.sql`) to `supabase/tests/probes/`. Then, on **Settings > Switches**, turn on `stays_instant_pay`, or `update public.feature_flags set enabled = true where key = 'stays_instant_pay';`. Room bookings also need `room_bookings` on. Switching it off again makes new bookings requests at once; instant bookings already made keep their approved agreement and their 30 minute hold.

**Known limits.** An unpaid instant booking is CONFIRMED, so it does not count toward the "3 unconfirmed stays" hold limit; the 10 bookings a day limit and the cooldown after two lapsed holds at the same place still apply, and the hold lasts at most 45 minutes. The instant wording on the checkout is English only until the stays restyle moves it into `@vallo/i18n`.

## After payment: the trip page (D75)

Migration `supabase/migrations/pending/d75b_stay_trip_details.sql`, probe `d75b-stay-trip-details.sql`. Checked against live on 7 October: no member could read any address (`listings.address` and `accommodations.address` are not granted), the gate details (`listing_access`) were readable on a CONFIRMED booking whether or not it was paid, and reviews were gated on a finished booking but not on payment. With instant booking a booking is CONFIRMED before it is paid, so all three now follow the money:

- `public.my_stay_details` answers the booking's own guest, once a payment has settled: the address, the hotel's check-in and check-out times and house rules, a listing's estate, gate directions, security phone and access code (the code only until the stay is over), the host's name and where to message them. Before payment it answers `unpaid` and the trip page says the details appear once the stay is paid.
- `private.can_see_listing_access` (changed) and `reviews_insert_own` (changed) also require a paid booking.
- The trip page and the trips spine offer **Pay** on any unpaid PENDING or CONFIRMED stay, so an instant booking is payable from there too.

## Known limits

- **Reviews of hotel stays** are written against the hotel (C4, live since 30 September). D75 offers the review on the trip for a paid, finished room stay, as for a listing stay.
- **No-shows** recorded by the host from the stay page work for listing stays only; a hotel no-show is handled by a person.
- **Arrival charges** (a hotel's declared tourism levy or deposit) are shown from the hotel's declaration; nothing is charged for them through Vallo.
- **One room type per request.** A guest who wants two different room types makes two requests.

## Where to look

| Question | Where |
|---|---|
| Is it on? | `feature_flags` where `key = 'room_bookings'`, or Settings > Switches |
| A room booking | `bookings` with `accommodation_id` set (and `listing_id` null) |
| Which nights are held | `room_inventory.units_booked` |
| The stay agreement | `deal_agreements` with `accommodation_id` set |
| Who is paid, and where | `payment_split_for_booking(booking)`; `bank_accounts.paystack_subaccount_code` |
| The pricing rules | `private.price_room_booking` in migration `20260929170728` |
| Proof it works end to end | the live probe `supabase/tests/probes/room-bookings.sql`, run by CI |
| The guest's side | `app/(app)/checkout/RoomRequestForm.tsx`, `lib/stays/room-booking-actions.ts` |
| The host's side | `app/host/bookings/`, `lib/host/room-bookings.ts`, `lib/host/room-booking-actions.ts` |
