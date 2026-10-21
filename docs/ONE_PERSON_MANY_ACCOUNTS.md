# One person, many accounts

> **Money, as of 17 October 2026.** Vallo never holds customer money. A wallet, escrow or held payment kept by Vallo itself was retired on 25 September 2026 (Track A), and where this document describes one it describes the past. Since ADR 0003 a licensed partner may hold a payment in escrow, offered only while `protectedRailLive()` reads it as working. The current truth is [`docs/MONEY_ARCHITECTURE.md`](/docs/MONEY_ARCHITECTURE.md).

**Raised by the founder on 23 September. This file answers one question about
four gates, and it answers it from the code and the live schema rather than
from any handoff.** This platform has a long history of a rule existing in
prose while the check does not exist, and this is exactly that class of thing,
so every answer below carries the file and the line that settles it.

---

## The problem, stated once

Gmail delivers `seyi+anything@gmail.com` and `s.e.y.i@gmail.com` to the same
mailbox as `seyi@gmail.com`. To Vallo those are three unrelated people. Other
providers have their own equivalents and disposable-mail services exist
regardless. **One person can mint unlimited accounts that look entirely
distinct to us, at zero cost.** The dots are the worse half, because they are
invisible in a way a plus tag is not.

This is not hypothetical. The two QA accounts created today are exactly this
mechanism, used honestly, and the recorder built alongside this file found
**nine accounts behind seven mailboxes: three of the nine share one.**

**The wrong fix is refusing plus tags and dots at sign-up.** It stops perhaps a
third of it, breaks legitimate use, and loses outright to anybody with a second
mailbox. Email accounts cannot be made scarce and nobody has ever managed it.
So the gate belongs on consequential actions, not on sign-up.

## What was built today, and what it deliberately is not

`public.account_identities`, applied as migration `20260923163049`. One row per
account holding a canonical form of its address, indexed, born locked, admin
read only, written by an AFTER trigger on `auth.users` so it can never refuse a
sign-up. The nine existing accounts are backfilled in the same migration,
because the founder has ruled an email can never be changed, so accounts cannot
be merged or corrected later: **a link not recorded at creation does not
exist.**

**It is an investigative signal and nothing else.** It refuses nobody and it
blocks nothing. It answers "how many accounts share one underlying mailbox" on
the admin person view and in moderation, and that is its whole job.

**Its honest ceiling:** anybody who owns a domain has unlimited addresses with
a catch-all, and no canonical form can ever see that. Which is why the four
gates below are the real work.

---

## The four gates, as they stand today

### 1. Listing a property requires a verified NIN

**NOT ENFORCED. Nothing anywhere verifies a NIN, and nothing requires one to
list.**

- The string `nin` appears in **zero migrations**. There is no NIN column, no
  NIN table and no verification provider wired to anything.
- A NIN is collected as free text at registration
  (`components/supply/AgentRegisterForm.tsx`,
  `components/supply/OwnerRegisterForm.tsx`) and lands in
  `agent_applications.id_type` / `id_number`. It is typed, never checked. The
  owner form says so in its own comment: **"The NIN is never gated on, because
  it is optional on this form."**
- **What IS enforced** is a human one: every listing action resolves the
  caller's row in `public.agents` (`lib/agent/listings-actions.ts`, the gate at
  the head of the file), and that row is only created when an admin approves an
  application (`lib/admin/actions.ts` line 347). So a stranger cannot list, but
  the thing standing between a banned person and a new listing is a member of
  staff recognising them.
- `agents.verification_tier` exists, with four ordered rungs (identity,
  address, payout, in_person) recorded by named staff
  (`20260805095946`). **No code path anywhere requires tier >= 1 to do
  anything.** The tier drives a badge and nothing else. The approval comment in
  `lib/admin/actions.ts` states plainly that at approval "verification_tier is
  0 and not one document has been looked at".

### 2. Withdrawing or receiving money requires a bank account whose name matches, via Paystack

> **Dated note, 29 September 2026.** Since Track A (25 September 2026) there is
> no withdrawal and no wallet to wallet move, and `lib/wallet/actions.ts` was
> deleted. A lister receives money only as their share of a split payment, into
> their own Paystack subaccount (`payout_accounts`, set up through
> `lib/agent/payout-actions.ts`). The bullets below describe the wallet paths
> as they stood before that. This gate needs re-checking against the payout
> account path and `lib/identity/name-match.ts` before it is quoted.

**PARTIALLY ENFORCED. The account must be real. Nothing checks it is yours.**

- Enforced: the bank code is checked against the live Paystack registry, and
  the account number is resolved with Paystack before anything is stored or
  paid. An unresolvable account is refused, and an unreachable registry refuses
  rather than waving it through. `lib/payments/bank-resolve.ts`,
  `lib/payments/bank-accounts-actions.ts` line 215, `withdraw` in
  `lib/wallet/actions.ts`.
- The resolved holder name is stored (`bank_accounts.resolved_account_name`).
  **It is never compared to the person withdrawing.**
- `sameAccountName` exists in `bank-resolve.ts` and has exactly **one** caller,
  `lib/wallet/actions.ts` line 1497, on the external bank SEND path that is
  being removed. There it compares the resolved name to what the sender typed
  on screen: that is "is this the account you meant", not "is this you".
- Receiving needs no bank account at all: wallet to wallet moves money between
  two Vallo accounts with no bank in the picture.
- **And there is nothing to match against.** A member has no verified name
  anywhere. The only name on file is self-typed
  (`agent_applications.full_name`, the profile display name). So this gate is
  not merely unbuilt, it is **not buildable until gate 1 is**, and that
  dependency is the most important line in this file.

### 3. A review can only be written by someone whose booking completed and was paid

**PARTIALLY ENFORCED, and the missing half is the one that matters.**

Enforced, in row level security rather than in application code, which is the
right place: `reviews_insert_own` (`20260804090803_reviews_write_path.sql`)
requires the author to be the guest, on their own booking, attached to that
booking's listing, with `status = 'CONFIRMED'` and `check_out` already past in
Lagos time. A unique `booking_id` makes it one review per stay.

**Not enforced: payment. The policy does not mention money at all.** And this
is not a theoretical gap, because the repository already documents the hole in
its own words, at `lib/bookings/settlement.ts` line 25:

> a stay can be CONFIRMED and still unpaid, because a host accepting a
> request-to-book stay confirms it without any money arriving

`confirmBooking` (`lib/bookings/actions.ts` line 593) is that path, and it runs
through the service role. So manufacturing a five-star review needs no money:
list a property, book it from a second address, confirm it as the host, wait
for the check-out date to pass, and write the review. **Cost: zero naira.**

### 4. A ban attaches to the NIN and the bank account, never to the email

**NOT ENFORCED. A ban attaches to one `agents` row and nothing else.**

- `public.agent_suspensions` has exactly these columns: `id`, `agent_id`,
  `reason`, `withdrawn`, `stays_ahead`, `suspended_by`, `suspended_at`,
  `lifted_by`, `lifted_at`, `lift_note`, `restored`. Read off the live schema
  today. **There is no identity and no bank account in it.**
- `suspend_agent` / `lift_agent_suspension` (`20260805110426`,
  `lib/admin/suspension-actions.ts`) take an agent id.
- I checked the live schema for any deny-list: the only tables that could hold
  one are `agent_suspensions`, `blocked_terms` (banned words in copy) and
  `blocks` (one person blocking another socially). **None of them holds an
  identity or an account number.**
- So a banned agent's second address is a new `auth.users` row, a new
  application, a new `agents` row, and nothing looks back. **Thirty seconds**,
  which is the founder's own estimate and it is right.

---

## The abuse shapes, and which gate stops each

| Shape | Stopped by |
| --- | --- |
| A banned agent returning in thirty seconds | 4, which needs 1 |
| A lister reviewing his own listings from five accounts | 3 |
| One person as landlord and satisfied tenant, manufacturing booking history | 3, and only the paid half stops it |
| Referral or promo farming | none of the four; there is no referral or promo system yet, so it is free to design this in |
| A dispute where every witness is the same person | the canonical recorder makes it visible; no gate prevents it |

**Two of the five are stopped by gate 3, which is the cheapest of the four and
the only one with no vendor behind it.**

---

## On the build list, with estimates

Nothing below has been started, and nothing should be until the founder
decides the order.

| Item | Estimate | Depends on | Note |
| --- | --- | --- | --- |
| **Review requires a paid booking** | **2 to 3 hours** | nothing | One condition added to `reviews_insert_own` plus a probe that proves a confirmed-but-unpaid booking is refused and a paid one is accepted. Needs one decision from the founder: does a wallet payment, a card payment and an offline stay all count as paid. |
| **Ban attaches to the identity and the account** | **1 day** | 1, and a bank account existing | A deny-list keyed on the verified identity and on `bank_accounts`, checked at application and at withdraw. Banning an unverified self-typed NIN bans a string somebody made up, so this is worth little until gate 1 is real. |
| **Bank account name must match the holder** | **half a day** of engineering | **1** | The comparison already exists (`sameAccountName`). What does not exist is a verified name to compare to. |
| **Verified NIN to list** | **1 day** of engineering, **plus a vendor** | a founder decision | NIMC data needs a licensed provider (Paystack Identity, Dojah, Youverify, VerifyMe are the usual four). That is a contract and a per-check cost, so it is on the founder's list and not mine: **the stop list forbids me signing up for a paid vendor.** |

**The order I would suggest, and it is a suggestion:** gate 3 now, because it
is hours and it closes two of the five shapes; then the founder's vendor
decision, because gates 1, 2 and 4 all queue behind it.

**The cheapest possible moment for all of this is today:** 9 accounts, 0
bookings, 0 reviews, 0 bank accounts, 1 agent, 0 real listings, all read off
the live database at 16:30Z. There is nobody to fight yet.
