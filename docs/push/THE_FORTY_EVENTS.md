# The forty events, walked

> **Money, as of 17 October 2026.** Vallo never holds customer money. A wallet, escrow or held payment kept by Vallo itself was retired on 25 September 2026 (Track A), and where this document describes one it describes the past. Since ADR 0003 a licensed partner may hold a payment in escrow, offered only while `protectedRailLive()` reads it as working. The current truth is [`docs/MONEY_ARCHITECTURE.md`](/docs/MONEY_ARCHITECTURE.md).

**What this is.** `docs/research/EMAIL_AND_NOTIFICATIONS_RESEARCH.md` section
3.6 is a matrix of forty events against three channels, and on 23 September
every cell in the push column was missing. This page walks the same forty and
says, per event, whether it now has a push path, what the notification says,
and where a tap lands.

**Read this before the table.**

- **NOTHING HAS EVER REACHED A DEVICE, and that is measured rather than
  inferred.** On 23 September the live project answers: `push_tokens` 0 rows,
  `push_queue` 0 rows, `push_deliveries` 0 rows. No device has ever enrolled,
  so nothing has ever been queued and nothing has ever been sent. "Has a push
  path" below means a queue row WOULD be created and a transport WOULD be
  called; it does not mean anything arrived, and nothing on this page should be
  read as though it did. `docs/push/FIRST_NOTIFICATION.md` is how that changes,
  and what remains is one handset: the VAPID pair is already configured.
- **The titles and bodies quoted here were read out of the live database on 23
  September**, from the function bodies themselves rather than from the
  migrations, so they are what the platform would actually send today.
- **Where a tap lands is `notifications.href`**, re-checked in two places:
  `safeHref` in `lib/push/policy.ts` before sending, and again in
  `public/sw.js` before opening. Anything that is not a path on our own origin
  becomes `/notifications`, which is always a truthful destination.

---

## The seam, in one paragraph, because it decides every row below

Push hangs off a trigger on `public.notifications`:

```
notifications_push_enqueue  AFTER INSERT ON public.notifications
                            FOR EACH ROW EXECUTE private.push_enqueue()
```

`private.push_enqueue` asks exactly one question, which is the one question
SQL is the right place for: **does this person have at least one live device**.
If they do, a `push_queue` row is written. Everything else, preferences, quiet
hours, collapsing, expiry, is policy and lives in `lib/push/policy.ts`.

So the rule for the whole table below is short:

> **An event that writes a row to `public.notifications` has a push path. An
> event that does not, does not, and no amount of work in `lib/push` changes
> that.**

Counted on the live database rather than estimated: **exactly one function
writes into `public.notifications`, and it is `private.notify`. 45 functions
call it, and 22 triggers sit on those 45**; the rest are reached from
application call sites. That is considerably wider than the email junction,
which was the reason for choosing this seam.

(An earlier version of this paragraph said 46 functions and 21 triggers. Both
were miscounts of my own query output: 46 was the row count including
`private.notify` itself, and 21 was a hand tally of a column. The numbers above
were re-read from `pg_proc` and `pg_trigger` and are what the database says.)

---

## The forty

`P` is the push column. `Y` = has a path. `-` = has none. `n/a` = deliberately
none, with the reason in the last column.

| # | Event | P | What it says | Where a tap lands |
|---|---|---|---|---|
| 1 | Account created | **-** | Nothing. No `notifications` row is written on sign-up. The welcome EMAIL now sends, through `email_outbox_enqueue_welcome`, and the email path is not the push path. | n/a |
| 2 | Verification code requested | **n/a** | **Never, and this is a decision rather than a gap.** A one time code on a lock screen is a code anybody holding the phone can read, and the whole point of the code is that only the person who asked for it sees it. | n/a |
| 3 | Password reset requested | **n/a** | Same reason as 2. Supabase sends it by email. | n/a |
| 4 | Password changed | **-** | Nothing anywhere. **A security gap, and it is the same gap it was before push existed.** | n/a |
| 5 | New sign-in on a new device | **-** | No `notifications` row. There IS now an email: `private.enqueue_new_device_email` reads the new `known_devices` table. **So the most push-worthy security event in the product reaches a person's inbox and not their phone**, which is the wrong way round for something that wants an answer in the next sixty seconds. Named, not fixed here: the fix is one `private.notify` call beside the existing email, and it belongs to whoever owns that trigger. | n/a |
| 6 | Booking requested, guest | **Y** | "Booking request sent" / "Your request for <listing> is with the host." | the guest's booking, or `/bookings` |
| 7 | Booking requested, host | **Y** | "<guest> wants <listing>: <date> to <date>." | `/agent/bookings` |
| 8 | Booking confirmed | **Y** | "Booking confirmed" / "<listing> is confirmed for <date>." | the guest's booking |
| 9 | Arrival details | **-** | Email only. No `notifications` row is written, so there is nothing for the trigger to see. | n/a |
| 10 | Booking cancelled | **Y** | Guest: "Booking cancelled" / "<listing> has been cancelled." Host: "<listing> for <date> was cancelled." | guest: their booking. Host: `/agent/bookings` |
| 11 | Booking refunded | **Y** | "Refund received" / "<amount> is back in your Vallo wallet for <listing>." Plus "Cancellation recorded". | `/wallet` |
| 12 | Stay complete | **Y** | Guest: "Stay complete" / "<listing> is recorded as complete. Thank you for staying." Host: "<listing> ended on <date>." | guest: their booking. Host: `/agent/bookings` |
| 13 | Rent paid and received | **Y** | Tenant: the move-in total, "rounded to the kobo". Lister: "<tenant> has paid the move-in total for <listing>." | tenant: `/rent/pay/<inspection>` when there is one, else `/bookings`. Lister: `/agent/earnings` |
| 14 | Wallet credited | **Y** | "Wallet credited" / "<amount> has landed in your wallet." | `/wallet` |
| 15 | Wallet debited | **Y** | "Wallet debited" / "<amount> has left your wallet." | `/wallet` |
| 16 | Withdrawal failed | **Y** | "Withdrawal could not complete" / "Your withdrawal of <amount> did not go through. The money stays in your wallet." **Urgent: it ignores quiet hours and it re-alerts rather than replacing a credit in silence.** | `/wallet` |
| 17 | Withdrawal paid | **-** | No `notifications` row. The builder exists and is unwired, exactly as the matrix recorded. **A person learns that money left their wallet (15) and never that it arrived in their bank.** | n/a |
| 18 | Transaction reversed | **Y** | "Transaction reversed" / "<amount> has been returned to your wallet." Urgent. | `/wallet` |
| 19 | Held funds movements | **Y** | Five, all `wallet` and all urgent: proposed, funded, release requested, disputed, settled. "A held payment reached your balance" / "The money is in your Vallo balance now." | `/escrow/<id>`, and `/wallet` for the confirm and release-request legs |
| 20 | New message | **Y** | "New message" / the first 120 characters of the message. | `/messages/<conversation>` |
| 21 | New enquiry on a listing | **Y** | It arrives as a message, so it reads as 20. **UNVERIFIED as a separate event**: no function writes a row whose title distinguishes an enquiry from any other first message, and I did not find one by searching the 46 producers. | `/messages/<conversation>` |
| 22 | Support replied | **Y**, **and it lands on the wrong screen** | "Support replied" / "Ticket <ref> has a new reply." | **`/settings`**. That is the settings hub, not the ticket. The person-facing support screen is `/settings/help`. **See the defect below the table.** |
| 23 | Support ticket filed | **-** | Email only, and correctly so: the person filing it is looking at the screen that says it was filed. | n/a |
| 24 | Inspection lifecycle | **Y**, all eight | "Inspection requested", "Inspection confirmed", "Another time offered", "Inspection declined", "Inspection time accepted", "Inspection complete" (both sides), "Inspection withdrawn". Each names the property and the other person. | requester: `/inspections`. Lister: `/agent/inspections` |
| 25 | Listing approved | **-** | No `notifications` row. No trigger, no call site. The builder exists and nothing calls it. **Unchanged since the matrix.** | n/a |
| 26 | Listing rejected | **-** | Same as 25, and worse: a person whose listing was refused is the one who most needs telling. | n/a |
| 27 | Verification rung passed | **Y**, partly | Per DOCUMENT rather than per rung: "A document was approved" / "One of your verification documents has been accepted", or "A document needs redoing" with the reviewer's reason. **The rung itself still has no event.** | `/verify` |
| 28 | Review received | **Y** | "New review" / "A guest rated <listing> <n> out of 5." | `/agent/reviews` |
| 29 | Review answered | **Y** | "The host answered your review" | `/listing/<id>` |
| 30 | Payout account added or removed | **Y** | "Payout account added" / "<bank> account ending <last four> was added to your earnings. If this was not you, contact support now." And the matching removal. | `/agent/earnings` |
| 31 | Report received | **Y** | "Thank you. Our team reviews every report, and we will act on this one without you having to chase it." | whatever was reported, or `/notifications` when the target is gone |
| 32 | Moderation decisions | **Y**, all twelve | Post, story, comment, bio and event, each in three states: being checked, live again, removed. "Your post is being checked" / "It is not showing publicly while somebody looks at it." | `/post/<id>`, `/stories/<id>`, `/events/<id>`, `/u/<handle>` |
| 33 | New follower | **Y**, **and the research said it should be a digest** | Through `private.notify_social`, which is called per event with a title and a body from the application. | whatever the caller passes |
| 34 | Like, repost, mention, reply | **Y**, same caveat as 33 | Same door. | whatever the caller passes |
| 35 | Badge earned | **Y** | "<badge>" / "It is on your profile now." | `/u/<handle>`, falling back to `/profile` |
| 36 | Table reservation lifecycle | **Y**, all three | "<guest> asked for <party> on <when>. Nothing is held until you accept." And the confirmation and the cancellation. | guest: `/bookings`. Restaurant: its own bookings screen |
| 37 | Event changed or cancelled | **Y** | "An event you are going to has changed" and "An event you were going to is cancelled", to every person going. | `/events/<id>` |
| 38 | Account deletion started | **-** | Email only. Deliberate: a person who has just asked to delete their account does not want their phone to buzz about it. | n/a |
| 39 | Account deletion completed | **-** | Email only, and it must be: by then there is no account to hold a device against, and `push_tokens` rows go with the account. | n/a |
| 40 | Staff role granted or revoked, agent suspended or reinstated, business transfer, price check watch | **Y** | Not in the original forty and found while walking: seven more producers, all `system` or `agent`. "Your administrator role has been removed. Everything else about your account is unchanged." | `/admin`, `/agent`, `/host/transfer`, `/price`, and one that passes `null` and therefore lands on `/notifications` |

---

## Counted

**First, a correction to the name.** The research section is headed "forty
events" and its table has **39 rows**, counted. Rows 1 to 39 below are those
39. Row 40 is seven more producers found while walking that the matrix never
listed at all.

Of the 39 the matrix lists:

- **Has a push path today: 27.**
- **Has none: 10.** Rows 1, 4, 5, 9, 17, 23, 25, 26, 38 and 39. Row 27 has one
  for the document decision and none for the rung itself, and is counted as
  having a path.
- **Deliberately none: 2.** Rows 2 and 3, the one time codes.

27 plus 10 plus 2 is 39. Row 40's seven all have a path, so 28 of the 40 rows
printed above are `Y`.

**Every one of the ten is missing for the same reason and it is not a push
reason: the event writes no `notifications` row.** Nothing in `lib/push` can
close any of them. Each is one `private.notify` call in somebody else's
trigger, and four of them (1, 4, 5, 17) were already recorded as gaps before
push existed.

---

## The defect this walk found: a support reply opens the wrong screen

`private.notify_support_reply` writes `href = '/settings'`.

That is the settings hub. The screen with the person's support conversation on
it is `/settings/help`. So a person tapping "Support replied" arrives at a list
of settings categories and has to work out where the reply went.

**In app this is a small annoyance. As a push notification it is the exact
failure that makes people turn notifications off**, because the one thing a
notification promises is that tapping it takes you to the thing it is about.

The fix is one string in a migration, `'/settings'` to `'/settings/help'`, with
rule 21's revoke restated after the `create or replace` and read back inside.
**It is not made here**, because it is a trigger in somebody else's area and a
push worker quietly editing another area's notification copy is how two people
end up disagreeing about what a screen says. It is filed as a request.

## And a decision somebody should take rather than inherit

Rows 33 and 34, follows, likes, reposts, mentions and replies, go through
`private.notify_social` **per event**. The research says "digest, never per
event". Push does not make that worse in the way it first looks:

- Every social notification collapses under one tag, `vallo-social`, so fifty
  likes are one row in the shade rather than fifty.
- An ordinary notification does not re-alert when it replaces one, so the
  phone buzzes for the first and updates silently after it.
- Above three ordinary notifications the device folds them into one that says
  how many.

**What it does still cost is a push per event**: a wake and a few hundred bytes
on a metered bundle for each like. That is a real cost on a mid-range Android
in Lagos, and the honest fix is a digest at the source rather than anything in
the worker. Written down, not decided here.

---

## What would have to be true for any of this to be a claim about a device

A VAPID pair in the environment, a redeploy, one handset, and one person
tapping. That is `docs/push/FIRST_NOTIFICATION.md`, it takes about a minute,
and until somebody does it **every row in the table above is a statement about
code and a queue, and about nothing that anybody has seen**.
