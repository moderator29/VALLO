# Facts file: the October 2026 films (Video One and Video Two)

The only source for words, claims and status badges in `reels/v1` and `reels/v2`. Product state as of 13 October 2026, from `HANDOFF.md`, the app code on `main`, and live captures of https://www.vallospaces.com made with the QA member account (docs/marketing/source/sc-*).

## Rules

- No voiceover: the words are on screen (no speech key was available). Music and sound cues are original (scripts/marketing/audio).
- Listings, stays and restaurants on screen are the platform's own example stock; the screens label them as examples. No customer names, counts, totals or testimonials.
- Never name the payments provider. "Licensed partners" only. "Vallo never holds your money" is the platform's own statement.
- No dates. No promise of escrow, financing, guarantees or provider integrations.
- Apps: **LIVE on both stores** (the founder, 17 October 2026). Every film renders with `--ending live`: "Live now on iPhone and Android" over the official, unmodified store badges. Until 17 October they were in review and the ending had to read "coming soon"; `--ending soon` still draws that, and `films/kit.js` honours the flag now (it did not before 17 October, which is why every October film shipped with badges while the apps were still in review).
- Status badges (Video Two): Live now / Rolling out / In development / Direction.

## Claims and where they come from

| On screen | Source | Badge |
|---|---|---|
| Homes, stays, restaurants, one app, one account | home and stays captures (tiles: Hotels, Shortlets, Restaurants, Local talk); HANDOFF section 2 | Live |
| Search, filters, "52 homes match" | sc-filters ("See 52 homes"), sc-search | Live |
| For you, Near me, New listed | sc-search chips | Live |
| Whole cost: rent, agency and legal fees, agreement fee, refundable caution deposit | sc-listing-cost (example listing, "Vallo Examples") | Live |
| Price check by area | sc-price ("What are properties near here asking?"; says so when there is not enough to be sure) | Live |
| Save and compare | sc-saved | Live |
| Message the owner or agent, ask to view, schedule a visit | sc-thread ("Ask to view this home", "Schedule a visit") | Live |
| Viewings never take money | HANDOFF section 2 | Live |
| Verification: four steps a person at Vallo checks | sc-verification | Live |
| A named person behind every listing | sc-agent-listings | Live |
| List it yourself, no agency fee | host-start ("I own the property: List it yourself. No agency fee.") | Live |
| Approved agents apply, a person reads every application | sc-agent-listings | Live |
| Restaurant reservations: the restaurant confirms, the conversation lives in the reservation | sc-restaurants | Live |
| Restaurant table deposits | handoff (code built, switch off) | In development |
| Hotels and shortlets: rooms, nights, requests, bookings | sc-host-rooms, sc-host-bookings, sc-host-calendar | Live |
| Vallo never holds your money; licensed partners hold it | sc-payments, HANDOFF section 2 | Live |
| Receipts for every payment | sc-receipts ("Every payment you made through Vallo ... each with its receipt") | Live |
| Wallet | wallet screens need profile details and the partner's account opening | Rolling out |
| Referrals and rewards | sc-rewards (first-run introduction) | Rolling out |
| Video calls from the chat | call button in the thread header; calls cannot be verified from this environment | Rolling out |
| The assistant answers questions, says it is an AI, asks agreement first | sc-assistant-start, store listing copy | Live |
| The assistant helping to finish tasks, with approval | not built | Direction |
| Dark and light themes; English, Hausa, Yorùbá, Igbo | sc-home / sc-home-lt; welcome in four languages | Live |
| Infrastructure for discovering, understanding, transacting around and operating spaces | company direction | Direction |

## Left out on purpose

- The wallet's setup screen (it names the payments provider).
- The local feed (the only post is the founder's own account).
- The assistant's long answer (raw markdown asterisks show; a product issue to fix, then recapture).
- Admin and operations screens (the capture harness has no admin login; the console shows internal data).
- A map of live property pins (the map tiles cannot load in this environment).

## Not demonstrable from this environment

Calls (LiveKit), maps (MapTiler), payments and wallet (the payments partner), SMS (Termii). Each needs a real device or a production check before a claim is made in a post.

## The three short films (17 October 2026)

`docs/marketing/voiceover/scripts/{signup,referral,listing}.txt`. Checked
against the applied migrations and the live screens, not against memory.

| Claim | Source | State |
|---|---|---|
| ₦80 for each friend who signs up fully | `signup-80-phone`, the live consumer campaign (`fx01_referral_counts_after_phone_verified`, applied 13 October): `reward_minor` 8,000 kobo | Live |
| Up to 1,500 qualified referrals a month | the same row: `member_cap_minor` 12,000,000 kobo = 1,500 × ₦80 | Live |
| Withdraw at ₦1,000 | `referral_policy.withdrawal_min_minor`, unchanged since b4 | Live |
| A friend has signed up fully once they confirm their phone number and finish setting up their account | NOT a fixed string: `lib/referral/requirements.ts` builds it from the live campaign's `requirement_keys`, so the screen is right the day it is read | Live |
| No agency fee when you list it yourself | `host-start` ("I own the property: List it yourself. No agency fee.") | Live |
| Vallo never holds your money; the owner's share goes straight to their bank account in the same transaction | the Agreements screen, word for word; the split is real (`payee_subaccount_code` / `reserve_subaccount_code`) | Live |
| An agreement is drawn up after an inspection report is submitted | the Agreements screen's own empty state | Live |

### Three things the films must NOT say, and why

1. **"No limit on how many friends you bring."** There is a limit: 1,500 a
   month. The referral film shows the screen that prints it.
2. **A workspace is "live" once it is described.** Every workspace is an
   application whose last step is "Check and send", and the Add a workspace
   screen says each one "gets its own tools and its own checks".
3. **Today's qualification steps, in the film's own type.** The product
   generates them from the live campaign; a film cannot. They moved once in
   five days (a confirmed email on 8 October, a confirmed phone from 13
   October). The films say "signs up fully" and let the screen carry the
   detail.

### Still true and still worth knowing

`referral_policy.payouts_enabled` is **false**, and `canWithdraw` requires
it, so no reward can actually be paid out until the marketing-float account
exists. The films say only what the product's own screens say ("You can
withdraw once your Rewards Balance reaches ₦1,000"), so they make no promise
the app does not already make, but the money cannot move yet.
