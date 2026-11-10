# Founder decisions of 13 October 2026

Confirmed by the founder on 13 October 2026. This file lists each decision,
says what the code does about it on the branch it was written against
(`claude/rentme-v2-platform-audit-xuvg0a`; statuses re-read on 13 October 2026 after the round 2 merges at `e054552a3`, and rows 2, 6, 14, 15 and 20 to 23 by the docs track the same day against the live database; rows 5, 7, 13, 14 and 21 to 23 re-read against the code and the applied migrations on 17 October 2026),
and says where the public documentation states it. When a decision's code
lands, change its status here in the same commit.

Status words: **BUILT** (read in the code), **PARTLY** (some of it), **NOT
BUILT** (decided, no code on this branch). Public docs and help (`/docs`,
`/help`) state only what is BUILT. Everything else is under "To document when
merged" at the end.

## The decisions

| # | Decision | Status | Where |
|---|---|---|---|
| 1 | Vallo is free to use. Listing is free. Vallo charges only on a completed deal. A Pro plan is optional and never required. No monthly subscription is required of anyone | PARTLY. Free listing and the optional plan (`lib/subscriptions`, flag `subscriptions_checkout`) exist. The fee itself is a separate matter, see "Open conflicts" | `/docs/what-vallo-costs`, help "Is Vallo free to use?" |
| 2 | Vallo does not hold customer money. Payments and escrow sit with licensed payment partners. The UI stays Vallo-native; a provider is named only where the law requires it | BUILT (ADR 0003, `lib/money/copy.ts`). The public docs and help name no provider (docs track, 13 October 2026): `/docs/money-and-the-guarantee`, which named the processor, was retired and redirects to `/docs/paying-on-vallo` | `/docs/paying-on-vallo`, `/docs/what-vallo-costs`, ADR 0003 |
| 3 | Money for a deal moves only after inspection and the renter's decision. Viewings never take money | BUILT (`PAYMENT_GATE_SENTENCE`, `NO_INSPECTION_FEE`) | `/docs/viewings` |
| 4 | Every cost is shown before booking; the guest sees the full total, including every charge at the door, before confirming | BUILT. A host's charges at the door (caution deposit, power, cleaning, extra guest, visitor) are listed before booking and the Host Agreement says so | `/docs/what-vallo-costs`, `/docs/hosting`, help "Will I see every cost before I book?". Checkout draws every declared door charge for the booked nights and party and the all-in figure above the pay action (`ArrivalChargesLine` with `stay`, test `components/stays/ArrivalChargesLine.dom.test.tsx`, 17 October 2026) |
| 5 | Hosts must not charge anything not listed on Vallo, and must not add a charge without a stated reason. Hosts agree to the Terms, the Privacy Policy and the Host Agreement before creating a host account or publishing | BUILT. Terms section 6, the Host Agreement page (`/host-agreement`, `lib/legal/host-agreement.tsx`), and the agreement tick on the wizard business step (`HOST_AGREEMENT_VERSION`, now `2026-10-17`: section 4 corrected to a fee per seated table, so hosts tick it again before their next application) | Terms, `/host-agreement`, `/docs/hosting`. For the solicitor: the Host Agreement text was written by engineering |
| 6 | Viewings: free slot is booked at once; or request a time and the lister confirms, offers another time, or declines | BUILT (`lib/viewings`, `lib/inspections`). Schedule a visit at `/listing/[id]/visit`, in person or by video (merged 13 October, `45bf26e7`) | `/docs/viewings#two-ways` |
| 7 | Reminders to both sides the evening before (19:00 Lagos) and 2 hours before | BUILT for both sides, with a third stage. `private.send_viewing_reminders` writes `viewing_reminders` per audience (renter and lister): `eve` 19:00 Lagos the evening before, `morning` 08:00 Lagos on the day for a visit at or after 10:00, and `soon` two hours before; only the latest due stage is sent (`20261013100331_visit_reminders_both_sides.sql`) | `/docs/viewings#reminders`, help "Will I be reminded about a viewing?" |
| 8 | Either side marks a viewing complete (inspected, deal done, no deal) or reports a no-show; the other side can dispute within 48 hours; admin sees disputes | BUILT. `lib/inspections/no-show-actions.ts`: either party reports from the agreed time to 14 days after; the person reported disputes within 48 hours; staff resolve (upheld or overturned) with an audit row. Admin view exists | `/docs/viewings`, help "What if the renter or the lister does not turn up" |
| 9 | Listing media: photos and videos in one uploader, minimum 3 items, 5 recommended, cover must be a photo, up to 3 videos each up to 100 MB and 60 seconds (MP4, MOV, WebM) | BUILT. `MIN_MEDIA` 3, `RECOMMENDED_MEDIA` 5, cover must be a photo, `MAX_VIDEOS` 3, `MAX_VIDEO_SECONDS` 60, `MAX_UPLOAD_LABEL` 100MB; the video bucket limit was raised on the live database | `/docs/quick-start`, help "How many photos and videos does a listing need?" |
| 10 | Sale prices up to 50 billion naira | BUILT (`MAX_SALE_PRICE_KOBO`, 50 billion naira in kobo) | internal only |
| 11 | Listings are reviewed by Vallo before publishing (approve, ask for more, reject with a reason); a refused or sent-back lister can edit and resubmit | BUILT (`app/admin/listings/[id]/ReviewActionBar.tsx`; the wizard reopens with the reviewer's sentence) | `/docs/quick-start`, help "Is a listing reviewed before it is published?" |
| 12 | Hotels, shortlets and restaurants set up through the host wizard with ID and business papers, reviewed by Vallo; refused hosts edit the same application and resend | BUILT. A sent-back or rejected host application reopens with the reviewer note and "Send it again" resubmits the same application. The wizard asks before leaving unsaved changes (`wizard-memory.tsx`) | `/docs/hosting` |
| 13 | Cancellation presets Flexible, Moderate, Firm, Strict for stays | BUILT. Flexible, Moderate, Firm and Strict (`lib/host/cancellation-presets.ts`, migration `20261013062641_four_preset_cancellation_policies.sql`;). A stay listed by an owner or agent, with no rate plan, keeps the platform schedule (`lib/trust/cancellation.ts`) | `/docs/refunds-and-cancellations#which-policy`, `/cancellations#host-policies`, help "What cancellation policies can a host choose?" and "How do refunds work?" |
| 14 | Restaurants: free table booking; restaurant confirms; diner pays the bill at the restaurant or through Vallo; Vallo bills the restaurant a fixed fee per seated table; restaurants confirm seated or no-show; only seated diners can review | BUILT except paying the bill through Vallo. Check-in code, restaurant marks seated or no-show, diner asked "Did you dine" a day later if the restaurant never answers, disputes to Vallo, seated-only reviews (`reservation_reviews`), a flat fee per seated table billed monthly (`lib/reservations/seating.ts`, admin `restaurant-fees`; per table since `20261013071048_restaurant_fee_per_seated_table.sql`, and the Host Agreement says so since version `2026-10-17`). Paying a bill through Vallo: the commission is set to 2 percent (200 basis points, 13 October 2026), the signed Paystack webhook settles a bill (`lib/reservations/bill-settlement.ts`), and the whole feature sits behind the fail-closed switch `restaurant_bill_pay` (off; `lib/reservations/bill-pay.ts`, migration `20261021104339_restaurant_bill_pay_switch.sql`) until each restaurant's payout subaccount exists and a Paystack test-mode run passes: the public docs say it is not switched on yet | `/docs/restaurants`, `/docs/what-vallo-costs#restaurants`, help "What does Vallo charge a restaurant?". The fee (1,000 naira per seated table, `restaurant_money_settings.seated_fee_minor` = 100000 live, `SEATED_FEE_MINOR_DEFAULT` in code) is stated publicly at the lead's instruction of 13 October |
| 15 | An owner (landlord) account cannot also be an agent account; the roles are separate accounts. Landlords can upload an ownership document and get a small ownership badge once Vallo has seen it | BUILT. One side per account is enforced (`private.one_side_per_account`, applied). The ownership document upload and the "Ownership seen" mark are built (`OwnerRegisterForm`, `OwnershipSeenMark`); the two constraints were widened and applied (`20261013070812_owner_proof_constraints_widened`), and the mark reaches search cards (`20261013090700_listings_ownership_seen_at_batch`) | `/docs/for-owners#ownership-document`, `/docs/badges-and-verification#ownership-seen`, help "What does the Ownership seen mark mean" |
| 16 | Messaging: reply, forward, delete for me, delete for everyone within 2 days 12 hours, call (voice and video) from the thread, Requests for people you do not follow | BUILT (migrations `20261011142243` to `20261011142309`, `private.delete_for_everyone_window()`, `components/calls`) | `/docs/messages-and-notifications`, help "Messages" |
| 17 | Verification ladder and badges, what they do and do not mean | BUILT (`docs/BADGES.md`, `lib/trust/verification.ts`) | `/docs/badges-and-verification` |
| 18 | Safety: never pay outside Vallo, never share account numbers in chat (flagged) | BUILT | `/docs/trust-and-safety`, `/safety` |
| 19 | The company is VALLO SPACES LTD (RC 9870413); the product is Vallo. RentMe and NaijaFinds never appear in anything new | BUILT (`lib/legal/company.ts`) | Terms, Privacy |
| 20 | Every payment for a deal happens inside Vallo. Never pay outside Vallo; a payment made outside Vallo is not covered | BUILT as a rule (`OFF_PLATFORM_SENTENCE`, account numbers flagged in chat); recording rent paid outside Vallo (LANDLORD-01) was dropped | `/docs/paying-on-vallo#pay-inside`, `/docs/trust-and-safety` |
| 21 | For rent and shortlets the payer picks Escrow (selected by default, held by a licensed partner until the deal is confirmed) or Pay by card. A sale is always escrow | BUILT and merged. The choice card (`PayChoiceCard`), `payment_rail_choose` (applied `20261013170244_pov01` to `20261013170856_pov05`), the escrow step with a switch to card while nothing is paid, and the partner calls (create, pay, confirm, withdraw, dispute, resolve). Escrow shows only when `protectedRailLive()` (`lib/money/rail-live.ts`) reads it as working on the server, behind the one switch `payments_protected_pay_on`; the docs carry one sentence for when it is paused (`ESCROW_PAUSED`). Release: `docs/payments/RELEASE_RUNBOOK.md` | `/docs/paying-on-vallo` |
| 22 | A hotel room is paid by card when booked, at the shown price. Vallo's commission on a hotel room is 10 percent, from the hotel's share, never added to the guest's price | BUILT. Instant card payment for rooms is live (`room_bookings`, `stays_instant_pay` on). The 10 percent rate is a dated row (`public.scoped_commission_rates`, scope `hotel_room`, 1,000 basis points, applied `20261013171019_pov06_hotel_room_commission.sql`) taken from the hotel's share at the rate in force when the room was booked; the docs state it from one constant (`HOTEL_COMMISSION_PERCENT` in `app/(site)/docs/facts.ts`), which must move with any new row | `/docs/what-vallo-costs#hotels`, `/docs/hosting#getting-paid` |
| 23 | Every workspace application and setup accepts the Terms and Privacy Policy and the rule that every payment happens inside Vallo | BUILT. `lib/legal/workspace-acceptance.ts` and `components/legal/WorkspaceAcceptance.tsx` on the owner, agent and firm registrations, the professional application, its resubmission and host setup (`PAY_ON_VALLO_VERSION`); the record is applied `20261013171213_pov07_workspace_acceptance_record.sql` and the database refuses a submission without it (`20261013212007_pov08_workspace_acceptance_required.sql`). Hosts also tick the Host Agreement | `/docs/getting-started#workspaces` |

## How it works, for the next engineer

### Viewings (`lib/viewings`, `lib/inspections`, `components/app/inspections`)

- A lister publishes viewing windows (`v94_viewing_windows`). The listing page
  offers free slots; `book_viewing_slot` accepts only a slot the database would
  offer at that instant and writes a CONFIRMED `inspection_requests` row.
- Otherwise the renter calls `requestInspection` (REQUESTED). The lister calls
  `answerInspection` to confirm, decline or offer another time (PROPOSED); the
  renter takes it with `acceptProposedTime`.
- States: REQUESTED, PROPOSED, CONFIRMED, DECLINED, WITHDRAWN, COMPLETED.
  `closeInspection` sets WITHDRAWN or COMPLETED; COMPLETED may carry an
  `outcome` of `inspected`, `deal_done` or `no_deal`, recorded once.
- A BEFORE trigger (`20261013053148`) makes each column writable only by the
  party it belongs to.
- Reminders: the cron job `vallo_send_member_reminders` runs
  `private.send_member_reminders`, which calls `private.send_viewing_reminders`
  and then `private.send_rent_due_reminders`.
  The viewing function sends the `eve` stage from 19:00 Lagos the evening before, the `morning`
  stage at 08:00 Lagos on the day (a visit at or after 10:00) and the `soon` stage two hours
  before, only the latest one due, and the ledger `viewing_reminders` makes each send
  once per audience (renter and lister). `member_reminders` is the ledger of
  `send_rent_due_reminders` (rent due), not of viewings (read live, 13 October
  2026).
- No-show: `reportNoShow`, `disputeNoShow`, `resolveNoShow` in
  `lib/inspections/no-show-actions.ts`; each is a SECURITY DEFINER function that
  decides who, when and once from `auth.uid()`.

### Listing media and review

- One uploader for photos and videos. Limits are in
  `lib/agent/listings-model.ts` (`MIN_MEDIA`, `RECOMMENDED_MEDIA`, `MAX_VIDEOS`,
  `MAX_VIDEO_SECONDS`, `MAX_UPLOAD_BYTES`); the database counts videos under a
  lock and holds up to 1800 seconds, so the 60 second rule lives in the app.
- Review: admin `ListingReview` offers Approve (then Publish), Ask for more and
  Reject (a reason is required for both). A sent-back listing reopens in the
  wizard with the reviewer's sentence.

### Host setup (`components/host/HostWizard.tsx`, `lib/host`)

- One wizard for hotel, shortlet and restaurant. The business step ticks the
  Terms, the Privacy Policy and the Host Agreement (`HOST_AGREEMENT_VERSION`).
  A business is reviewed in the admin console. A refused host edits the same
  application and sends it again. Unsaved changes are guarded by
  `wizard-memory.tsx`.

### Restaurants

- A guest requests a table (free), the venue confirms. The booking has a check-in
  code; seating is decided by code, the restaurant, the diner's answer, a bill
  or admin (`lib/reservations/seating.ts`). Vallo bills the restaurant a flat
  fee per seated table at month end (default 1,000 naira in code; the database
  row wins). Paying the bill through Vallo is off until the `restaurant_bill_pay` switch is turned on.
  Card deposits (D75) are a separate, flagged-off feature.

### No-show disputes

- Viewings: see Viewings above. Stays: `esc04` keeps a no-show's nights; an
  escrow dispute uses `disputed_at` and a 48 hour alert
  (`esc05_esc09_esc15`). These are separate from the viewing dispute.

## To document when merged

- Paying a restaurant bill through Vallo (off until `restaurant_bill_pay` is turned on). The docs and help say it is not switched on.
- The fee: wording and percentage, once the Terms are settled.

## Open conflicts

1. The Terms section 14 still describes the retired Guarantee (1 to 2 percent of
   every payment set aside in a reserve) and section 4 its reserve leg; section 6
   says the platform fee comes out of the lister's share on a completed deal, and
   its exact wording waits for the solicitor (HANDOFF). The full list of Terms,
   Disclaimer and Privacy sentences for counsel is
   `docs/LEGAL_AND_NDPC_READINESS.md` section 7.
2. Restaurant deposits (D75, off) versus free table booking.
3. The Terms section 5 says one schedule covers every stay "rather than a different
   one for each person who lists"; the code lets a host business pick one of four
   presets (row 13) and the refund follows the booked policy. Solicitor, with a new
   `TERMS_VERSION`.
4. The Terms sections 4 and 13, the Disclaimer section 2 and the safety copy said a
   person at Vallo approves every agreement before payment opens; D83 switched that
   review off (`agreement_staff_review`), and a direct payment waits for a person
   only when the deal needs a second look (`PAYMENT_GATE_SENTENCE`). The public safety
   page and the help now say the latter; the Terms and the Disclaimer wait for the
   solicitor.
