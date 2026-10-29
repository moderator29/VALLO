# Invite and Earn, end to end (27 October 2026)

The flow as it runs today, checked against the live database
(`uccixoonmbhrnyczyigt`) on 28 October 2026. Where this file and
`REFERRAL_ARCHITECTURE.md` differ on what runs, this one describes what runs.

## The flow

1. **Invite link and code.** Every member has a six character code
   (`public.my_referral_code()`, made on first ask) and the link
   `https://www.vallospaces.com/join/<code>`. Settings, Invite shows both and
   the share sheet. The invite door (`/join/<code>`, `referral_door`) shows
   whether the code exists and a first name at most, rate limited per address
   and failing closed.
2. **The code is kept.** The door leaves the `vallo_invite` cookie (30 days).
3. **Attribution at sign-up.**
   - Email sign-up carries the code in the sign-up metadata (typed code first,
     else the cookie): `auth.users` AFTER INSERT attributes it at once
     (`users_referral_attribute`).
   - Google, Apple and phone sign-ups carry none, so `claimInviteFromCookie`
     runs after the first session (`completeEmailVerification` for OAuth and
     email links, `signInWithAppleIdToken`, `finishSocialSetup`,
     `verifySignUpCode`, phone sign-in) and calls `referral_claim_code`, which
     accepts it only for an account made in the last 24 hours, not already
     attributed, never the member's own code.
4. **The live campaign** is `signup-80-phone`: 80 naira (8,000 kobo), a seven
   day review window, a cap of 120,000 naira per member per month, and the two
   requirements `phone_verified` and `onboarding_completed` (terms accepted and
   a first name). A confirmed email alone never counts (13 October ruling).
   The platform budget is 700,000 naira a month; at the cap, qualification
   pauses and is said on screen, and what already qualified is honoured.
5. **The invited member's own step (new, 27 October).** Nothing used to tell
   an invited person that their sign-up was not complete until they confirmed a
   phone. `public.my_invite_step()` returns their first missing step
   (`phone`, `setup` or `email`) and the Stays and Home screens draw one quiet
   card with one button (`InviteStepNudge`). It names nobody and shows nothing
   to anyone who was not invited or already counts. Probe:
   `supabase/tests/probes/my-invite-step.sql`.
6. **Qualification.** Confirming a phone (`confirmed_phones` trigger), finishing
   the profile (`profiles` trigger), confirming the email (`auth.users`
   trigger) and the 15 minute sweep (`vallo_referral_qualify`) each try. The
   reward amount, campaign and identity are frozen on the row. One reward per
   confirmed phone.
7. **Review window.** Qualified rewards sit `pending` for seven days while the
   risk graph and cluster flags run (`vallo_referral_flag_clusters` hourly). A
   flagged one is `under_review`, reversible, never described to the member as
   fraud.
8. **Available.** `vallo_referral_release_due` (twice an hour) moves a reward
   past its window to `available` and posts the append-only ledger entry
   (`rewards_ledger`, `reward_earned`).
9. **What the inviter sees.** Rewards (`/rewards`): Available, Pending, the
   people who joined and each one's stage (signing up, counting, in review,
   earned, not eligible, with a plain reason), the pause notice when rewards are
   closed. Never a projection, never a risk reason.
10. **Withdrawal.** `payouts_enabled` is on in policy since 14 October 2026; the
    minimum is 1,000 naira. The member confirms a phone, passes the passcode
    lock, and the bank resolves the account name. The payout is paid from the
    marketing float by Paystack transfer and shows **sent** until the webhook
    confirms, then **paid**. With no float key, or while Paystack is not live,
    the action answers "not available yet" and nothing moves.
11. **Reversal.** A refunded or charged back qualifying payment reverses its
    reward (`referral_reverse_for_chargeback`); reversed amounts sit beside
    paid and are never netted.

## Gaps closed in this pass

- The invited member had no prompt for the one step the live campaign needs
  (item 5).
- The wallet's phone: a number confirmed by code now counts as the wallet's
  phone, so a member who verified is never asked again (see
  `lib/money/wallet-provision.ts`).

## Gaps that remain (not engineering)

- **No deferred deep link.** Someone who opens an invite in a browser, then
  installs the app and signs up there arrives without the code. They can sign
  up on the web from the same link.
- **Paystack live activation** (corporate account in progress) gates the first
  real payout. Until then a withdrawal is refused cleanly.
- The Hausa, Igbo and Yoruba rewards strings are still English (policy: an
  invented translation is worse than none).

## Test on a real device (nothing here can be proven from the sandbox)

1. Account A: Settings, Invite, copy the link.
2. In a private window or second phone open the link, sign up by email.
   Expect: the Stays screen shows "One step left to finish joining" (phone).
3. Confirm the phone with the real SMS code. Expect: the card disappears, and
   account A shows the person as "counting" then "in review until <date>".
4. Account A, Rewards: Pending shows 80 naira. After seven days (or an admin
   release in a test month) it moves to Available.
5. Repeat step 2 with Google and with Apple: the invite must still attribute.
