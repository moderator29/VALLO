# What sends, what refuses, and what is not proved

> **Money, as of 17 October 2026.** Vallo never holds customer money. A wallet, escrow or held payment kept by Vallo itself was retired on 25 September 2026 (Track A), and where this document describes one it describes the past. Since ADR 0003 a licensed partner may hold a payment in escrow, offered only while `protectedRailLive()` reads it as working. The current truth is [`docs/MONEY_ARCHITECTURE.md`](/docs/MONEY_ARCHITECTURE.md).

Every email this platform can compose, what makes it leave, what stops it
leaving twice, whether a `/settings` switch can silence it, and its state
today. Written 23 September by the junction worker, off the source and off the
live catalogue rather than off anybody's report.

---

## Read this first

**NOTHING LEAVES THE BUILDING UNTIL `RESEND_API_KEY` IS SET ON THE
DEPLOYMENT.** Not one of the thirty eight messages below has ever been
delivered to anybody. `isEmailConfigured()` is false without that key: the drain claims
no rows at all and reports `email.outbox.unconfigured` at CRITICAL every
fifteen minutes, and every direct send site goes through `bestEffortEmail`,
which does nothing. The queue fills correctly and loses nothing meanwhile.

**AND NO SEND HAS EVER BEEN PROVED ON THE WIRE FROM THIS BOX.** The egress
proxy here refuses `api.resend.com:443` by organisation policy
(`connect_rejected`) and there is no Resend key on this deployment. The
furthest any automated check in this repository goes is `globalThis.fetch`:
`lib/notify/outbox-delivery.test.ts` replaces the socket and nothing else, and
asserts on the HTTP request that WOULD have gone out, for every template the
outbox can send. That is a proof about the message, not about delivery. **The
first real delivery will happen the first time somebody sets the key, and it
will be unproved until a person reads the email that arrives.**

**Three states are used below and they mean exactly this.**

- **SENDS** once the key is set: there is a live path from an event to the
  wire, and it has been walked in a test rather than read.
- **REFUSED**: deliberately not wired, with the reason. A refusal is held in
  place by `lib/email/reachability.test.ts`, which fails if somebody wires it.
- **UNPROVEN**: something outside this repository has to be true and is not, or
  is not checkable from here. What is missing is named.

---

## The count

**Recounted 29 September 2026** from the files `lib/email/reachability.test.ts`
sweeps (`messages.ts`, `agreement-messages.ts`,
`payment-instrument-messages.ts`, `welcome-message.ts`,
`lifecycle-messages.ts`, `lib/account-deletion/emails.ts`). The tables below
were written on 23 September and several rows describe the wallet and escrow
emails Track A retired; the count here is the current one.

| | |
|---|---|
| Message builders in those files | 44 |
| Reachable from a live event or the outbox registry | 44 |
| REFUSED, with a written reason | 0 |
| Built and unreachable with no decision recorded | **0** |

Thirteen of the 44 are the lifecycle emails in section 1b, reachable through
the outbox registry and **not yet sent by anything**, because their triggers
are held in `supabase/migrations/pending/` until the code is deployed.
`staff-messages.ts` and `safety-messages.ts` sit outside the sweep and are
sent by the outbox (`staff.access_granted`, `safety.scam_recall`).

Held at zero by `apps/web/src/lib/email/reachability.test.ts`, which walks
every non-test module outside the email layer, keeps only those that can
actually send (`sendMessage`, `sendEmail`, `announce`, or the outbox registry),
and asserts the set of unreachable builders is EXACTLY the set with a written
refusal. It also asserts every outbox template key is written by a migration,
applied or pending.

---

## 1. The outbox: a database trigger writes the row, the drain sends it

Fifteen templates. A trigger writes into `public.email_outbox` in the SAME
TRANSACTION as the state change, so the email cannot exist without the event
and cannot survive the event rolling back. `/api/cron/email-outbox` claims,
resolves the address, builds the message and settles by id, four times an hour.

The dedupe key is UNIQUE and the enqueue is `on conflict do nothing`, so every
key below is a once-ever guarantee rather than a hope.

| Template key | Builder | What writes the row | Dedupe key | `/settings` mute | State |
|---|---|---|---|---|---|
| `account.welcome` | `welcome` | `users_enqueue_welcome_email_on_insert` and `..._on_confirm` on `auth.users`, plus `welcomeOnce` through `public.email_outbox_enqueue_welcome` | `account:welcome:<user id>` | none | **SENDS** |
| `escrow.INITIATED` | `heldPaymentProposed` | `escrows_enqueue_emails`, one row per party | `escrow:<escrow id>:INITIATED:<party id>` | none | **SENDS** |
| `escrow.HELD` | `heldPaymentSetAside` | same trigger | `escrow:<escrow id>:HELD:<party id>` | none | **SENDS** |
| `escrow.RELEASE_REQUESTED` | `heldPaymentPayoutAsked` | same trigger | `escrow:<escrow id>:RELEASE_REQUESTED:<party id>` | none | **SENDS** |
| `escrow.RELEASED` | `heldPaymentPaidOut` | same trigger | `escrow:<escrow id>:RELEASED:<party id>` | none | **SENDS** |
| `escrow.REFUNDED` | `heldPaymentReturned` | same trigger | `escrow:<escrow id>:REFUNDED:<party id>` | none | **SENDS** |
| `escrow.DISPUTED` | `heldPaymentDisputed` | same trigger | `escrow:<escrow id>:DISPUTED:<party id>` | none | **SENDS** |
| `escrow.RESOLVED` | `heldPaymentRuling` | same trigger | `escrow:<escrow id>:RESOLVED:<party id>` | none | **SENDS** |
| `escrow.CANCELLED` | `heldPaymentWithdrawn` | same trigger | `escrow:<escrow id>:CANCELLED:<party id>` | none | **SENDS** |
| `security.password_changed` | `passwordChanged` | `users_enqueue_password_changed_email`, `after update of encrypted_password on auth.users` | `security:password_changed:<user id>:<statement clock>` | none | **SENDS** |
| `security.new_device_sign_in` | `newDeviceSignIn` | `sessions_enqueue_new_device_email`, `after insert on auth.sessions` | `security:new_device:<user id>:<16 char agent digest>` | none | **SENDS** |
| `wallet.withdrawal_outcome` | `withdrawalOutcome` | `wallet_entries_enqueue_withdrawal_email`, `after update of status on public.wallet_entries` | `withdrawal:<entry id>:<paid\|failed\|reversed>` | none | **SENDS**, and see finding 1 |
| `inspection.scheduled` | `inspectionScheduled` | `inspection_requests_enqueue_email`, one row per party | `inspection:<request id>:CONFIRMED:<party id>` | none | **SENDS** |
| `verification.rung_passed` | `verificationRungPassed` | `agent_verification_checks_enqueue_email` | `verification:<agent id>:<rung>` | none | **SENDS** |
| `listing.new_enquiry` | `newEnquiry` | `messages_enqueue_new_enquiry_email`, first message in a conversation only | `enquiry:<conversation id>` | **Messages** | **SENDS** |

**Why almost nothing here answers to a switch, and that is the decision rather
than an omission.** `/settings` offers four switches: Bookings, Messages,
Wallet and Marketing. A security notice, a receipt for money that moved and the
state of an agreement somebody is a party to are none of those four, and
honouring a mute for them would silence a message the product has promised to
send. `listing.new_enquiry` is the exception because an enquiry IS a message
and the Messages card says in as many words that turning it off stops message
email.

`account.welcome` deliberately answers to nothing: it is the one message that
explains what the account somebody just opened actually is, and it carries the
link to those switches. Muting it behind a switch the reader has not been shown
yet would be silencing the letter that tells them the switches exist.

### 1b. The lifecycle emails (29 September 2026): built, triggers LIVE since 30 September

Thirteen events the app already announced in the bell and never by email.
Builders in `lib/email/lifecycle-messages.ts`, registry entries in
`lib/notify/templates.ts`, triggers in
`supabase/migrations/20260930140311_email_lifecycle_triggers.sql`.

**APPLIED 30 September 2026**, after the PR #75 deploy that knows these
templates was live. It was held until then on purpose: the drain settles a row whose template the
running code does not know as DROPPED, for good. The triggers go live only
after the code that builds these templates is deployed: apply the pending
file, rename it to its version, move it into `supabase/migrations/`, record
it. Each trigger was probed on 29 September inside a transaction that was
rolled back: every template below was enqueued with the payload keys its
builder reads, and the controls (a note edited without a state change, a
member's own support message, a passed check, a demo listing) enqueued
nothing.

| Template key | Builder | What writes the row | Dedupe key | `/settings` mute | State |
|---|---|---|---|---|---|
| `inspection.proposed` | `inspectionProposed` | `inspection_requests` state to PROPOSED, to the requester | `inspection:<id>:PROPOSED:<slot epoch>` | **Bookings** | LIVE |
| `inspection.declined` | `inspectionDeclined` | state to DECLINED, to the requester | `inspection:<id>:DECLINED` | **Bookings** | LIVE |
| `inspection.withdrawn` | `inspectionWithdrawn` | state to WITHDRAWN, to the lister | `inspection:<id>:WITHDRAWN` | **Bookings** | LIVE |
| `inspection.completed` | `inspectionCompleted` | state to COMPLETED, to both | `inspection:<id>:COMPLETED:<party>` | **Bookings** | LIVE |
| `support.replied` | `supportReplied` | a staff message on a ticket with an account | `support:reply:<message id>` | none | LIVE |
| `agreement.waiting` | `agreementWaiting` | an agreement inserted, to both (the rent path; the stay path already sent it, with the same key) | `agreement.waiting:<id>:<terms version>:<party>` | none | LIVE for rent |
| `agreement.submitted` | `agreementSubmitted` | status to `in_review` (both confirmed), to both | `agreement.submitted:<id>:<version>:<party>` | none | LIVE |
| `agreement.cancelled` | `agreementCancelled` | status to `cancelled`, to both | `agreement.cancelled:<id>:<version>:<party>` | none | LIVE |
| `guarantee.claim_opened` | `guaranteeClaimOpened` | a claim filed, to the claimant | `guarantee:claim:<id>:opened` | none | LIVE |
| `verification.rung_failed` | `verificationRungFailed` | a check marked failed, to the agent | `verification:<agent>:<kind>:failed:<decided epoch>` | none | LIVE |
| `listing.submitted` | `listingSubmitted` | a non-demo listing to SUBMITTED, to the lister | `listing:<id>:SUBMITTED:<epoch>` | none | LIVE |
| `reservation.confirmed` | `reservationConfirmed` | a table to CONFIRMED, to the guest | `reservation:<id>:CONFIRMED` | **Bookings** | LIVE |
| `reservation.cancelled` | `reservationCancelled` | a table to CANCELLED, to the guest | `reservation:<id>:CANCELLED` | **Bookings** | LIVE |
| `refund.requested` | `refundRequested` | a refund request filed, to the guest | `refund:<id>:requested` | **Bookings** | LIVE |

Viewings, tables and refunds answer to the Bookings switch because the
Bookings card promises exactly that. An agreement, a claim, a support answer,
a verification decision and a listing receipt are obligations to a party and
answer to nothing, like the rest of section 1.

**Asked for and not built, with the reason.** Payment received and payment
receipts belong to the crypto payment work, which will register
`payment.received` and `payment.receipt` in the same registry from its own
trigger. A booking reminder is a schedule, not an event, and needs a cron job.
"Email changed" does not exist: the address never changes (the hook refuses
`email_change`), and the recovery flow has its own two emails. "Verification
submitted" has no single event to hang on (documents arrive one by one); the
decisions are sent.

---

### 1c. The payment and stay emails (13 October 2026): written by pending migrations nt02, nt05 and nt06

Five templates, built in `lib/email/lifecycle-messages.ts`, registered in
`lib/notify/templates.ts`, written by the triggers and the existing member
reminder sweep in `supabase/migrations/pending/nt0*.sql` (HELD until applied:
apply them before this branch's code is deployed or after, in either case the
drain only drops a row whose template the running code lacks). The map of every
event and channel is `docs/NOTIFICATIONS_MAP.md`.

| Template key | Builder | What writes the row | Dedupe key | `/settings` mute | State |
|---|---|---|---|---|---|
| `payment.host_received` | `paymentHostReceived` | a stay charge becoming SUCCESSFUL (`private.tell_payment_received`), to the host | `payment:host:<transaction id>` | none | HELD (nt02) |
| `payment.rent_receipt` | `paymentRentReceipt` | a rent or flatmate-share charge becoming SUCCESSFUL, to the payer | `payment:rent:<transaction id>` | none | HELD (nt02) |
| `stay.review_request` | `stayReviewRequest` | the member reminder sweep, the day after check-out, no review yet | `stay:review:<booking id>` | **Bookings** | HELD (nt05) |
| `message.unread` | `unreadMessages` | the same sweep, a run of messages unread for two hours (not the first of a thread) | `unread:<conversation>:<recipient>:<first unread message>` | **Messages** | HELD (nt05) |
| `booking.request_closed` | `bookingRequestClosed` | a booking moving PENDING to CANCELLED by somebody other than the guest, never paid, not rent | `booking:<booking id>:request_closed` | **Bookings** | HELD (nt06) |

Every message, these and the older ones, now shares one layout (the lockup,
one headline, a short paragraph, one flat brand-blue button, a quiet details
panel, and a footer with notification settings, help, the two legal pages and
the company line with its registered address). See the redesign note in
`lib/email/render.ts`; the 3D object and the row glyphs are switched off by
two flags in `lib/email/icons.ts` and can be switched back on there.

---

## 2. The direct senders: a server action, a webhook or a route sends it there and then

Twenty builders, for an event TypeScript can already see.
`paymentInstrumentChanged` covers six different events on its own, so twenty
five events in all. Fifteen in section 1 plus twenty here is the thirty five
reachable builders in the count above. Every one of
them is inside `bestEffortEmail` and cannot fail the action it follows.

**None of these has a dedupe key**, because none of them has a queue. What
stops a second copy is named per row, and where nothing does, the row says so.

| Builder | What sends it | What stops a second copy | `/settings` mute | State |
|---|---|---|---|---|
| `verificationCode` | `POST /api/auth/email-hook`, Supabase's Send Email Hook | GoTrue's own throttle; the route also bounds the signed timestamp to 5 minutes | none | **LIVE, proven 23 September**, see below |
| `walletFunded` | Paystack `charge.success` webhook, and the verify-on-redirect path | Gated on `posted === "posted"`; `recordFunding` is idempotent on the `rm-fund` reference, so whichever runs second credits nothing and emails nothing | Wallet | **SENDS** |
| `withdrawalFailed` | Paystack `transfer.failed`/`reversed` webhook, and two catch paths in `lib/wallet/actions.ts` | `settleWithdrawal` only moves a PENDING row, so a replayed delivery is silent | Wallet | **SENDS**, and see finding 1 |
| `listingApproved` | admin listing decision `publish`, through `announce` | nothing: a reviewer who clicks twice emails twice | none | **SENDS** |
| `listingPassedReview` | admin listing decision `approve` | nothing | none | **SENDS** |
| `listingRejected` | admin listing decision `reject` | nothing | none | **SENDS** |
| `listingChangesRequested` | admin listing decision `request_changes` | nothing | none | **SENDS** |
| `agentApplicationApproved` | admin registration decision `approve` | nothing | none | **SENDS** |
| `agentApplicationRejected` | admin registration decision `reject` | nothing | none | **SENDS** |
| `agentApplicationNeedsMore` | admin registration decision `request_changes` | nothing | none | **SENDS** |
| `bookingRequested` | `createBooking`, to the guest | the booking's own database constraint: no booking, no email | Bookings | **SENDS** |
| `bookingRequestedHost` | `createBooking`, to the host | same | Bookings | **SENDS** |
| `bookingConfirmed` | `announceConfirmedStay`, to the payer | the confirmation transition | Bookings | **SENDS** |
| `stayArrivalDetails` | `announceConfirmedStay`, to the arriving guest | same | **deliberately none** | **SENDS** |
| `bookingCancelled` | `cancelBooking` | the cancellation transition | Bookings | **SENDS** |
| `bookingRefunded` | admin refund | the refund transition | Bookings | **SENDS** |
| `supportTicketFiled` | `fileSupportTicket` | the ticket row; a duplicate reference is refused on `23505` | none | **SENDS** |
| `paymentInstrumentChanged` | `lib/payments/notices.ts` through `announce`, from six events: a card saved, made default or removed, and a bank account added, made default or removed | the instrument row itself | none | **SENDS** |
| `deletionStarted` | `lib/account-deletion/actions.ts` | the deletion request row | none | **SENDS** |
| `deletionCompleted` | `lib/account-deletion/service.ts` | the purge itself, which happens once | none | **SENDS** |

**`stayArrivalDetails` is not muted and that is on purpose.** The Bookings
switch says "do not email me about bookings". It is the payer's own preference
and it is not consent given on behalf of a third party. The arriving guest's
address was typed in by the payer precisely so we would use it, and silencing
it leaves somebody standing at a gate at eleven at night with no entry code.

**`supportTicketFiled` is the one email whose address comes from a form.**
Every other send in the estate resolves the address through
`lib/email/recipients.ts` with the service role, which is junction promise 4. A
support ticket can be filed signed out, so there is no session to resolve, and
the address on the form is the only one there is. It is rate limited before it
is sent, which is what keeps it from being a relay.

### `verificationCode` is LIVE and proven

**Corrected 23 September 2026.** This section used to say the route was not
the live path. The Send Email Hook was switched on on 22 September, and
`auth_logs` on 23 September show a successful `run_hook` against
`/api/auth/email-hook` on every sign-up that day, no GoTrue `mail_from` at all,
and each account then verified. See [`AUTH_EMAILS.md`](AUTH_EMAILS.md)
section 1. `SUPABASE_AUTH_HOOK_SECRET` is set; without it the route refuses
every request with 401 by design, because an endpoint whose protection is
optional ships unprotected the first time a variable is forgotten.

The transactional outbox is proven the same way. Measured at 23:47 UTC on 23
September, `public.email_outbox` holds 5 rows, all SENT (15:57 to 20:39 UTC),
the first after a real sign-up, and none PENDING. `/api/cron/email-outbox`
drains it every fifteen minutes.

**What is still missing is the reply path, not the send path.**
`EMAIL_REPLY_TO` is not set and `vallospaces.com` has no MX, so a reply to any
of these messages reaches no one (THE_AUDIT OPS-06).

---

## 3. REFUSED: built, complete, and deliberately not wired

**Corrected 29 September 2026.** `REFUSED` in `lib/email/reachability.test.ts`
is empty today: the three builders below have since been wired or removed with
the custody they described. The entries are kept as the record of why.

Three. Each one is held unwired by `lib/email/reachability.test.ts`, which goes
red if somebody wires it, and each carries the same reason in a comment beside
the builder itself.

### `passwordReset`: GoTrue owns it

`lib/auth/actions.ts` asks for a reset with
`supabase.auth.resetPasswordForEmail`, and GoTrue composes and sends the
recovery mail itself, carrying the only link that works. **The recovery token
is minted inside GoTrue and never reaches this process, so there is no
`resetUrl` for a caller here to pass.** Anything we sent would be a SECOND
email arriving beside the real one, with either no link or a link that signs
nobody in, on the one screen where a person is already locked out and
frightened. Two reset emails is how somebody presses the wrong one and
concludes they have been phished.

It is kept rather than deleted because the fixtures render it and
`shell.test.ts` holds it to the catalogue's structure. The day the Send Email
Hook is enabled, the `recovery` payload arrives at
`/api/auth/email-hook` and this becomes the message for it.

### `escrowFunded`: it prints the one claim about custody nobody may make

Its subject is `... is held in escrow for ...`. **Rule 11: escrow is promised
nowhere until it operates**, and the structure question is with the solicitor.
The whole escrow copy layer in `lib/escrow/copy.ts` exists to keep that word
off a reader's screen, and this file sits outside that enforcement. Superseded
by `heldPaymentSetAside`, which the outbox sends on every HELD transition to
both parties.

Kept because the sentence craft in it is worth reading the day the structure IS
decided. Not kept because anybody should call it.

### `escrowReleased`: the same claim, in the same place

Same subject line, same rule 11. Superseded by `heldPaymentPaidOut`, which the
outbox sends on every RELEASED transition to both parties, with the settlement
lines rather than a bare amount.

---

## 4. Findings nobody asked for

### Finding 1. ONE FAILED WITHDRAWAL IS TWO EMAILS. Measured, not reasoned.

`wallet_entries_enqueue_withdrawal_email` fires on `after update of status on
public.wallet_entries` and queues `wallet.withdrawal_outcome`. Both
`settleWithdrawal` (the Paystack `transfer.failed` and `transfer.reversed`
webhook) and `setEntryStatus` (the two catch paths in `lib/wallet/actions.ts`
that mark a hold FAILED) perform exactly that UPDATE. **Each of those three
call sites then ALSO sends `withdrawalFailed` directly through `sendMessage`.**

So the same person is told twice, in two different sets of words, about the
same money. `withdrawalOutcome` opens with the outcome and distinguishes
`reversed` from `failed`, which matters because reversed means the money left
and came back and the reader will see a debit and then a credit on their
statement. `withdrawalFailed` says only that it failed.

Proved against the live catalogue on 23 September by a probe that created a
wallet and a PENDING withdrawal entry, ran the same UPDATE the TypeScript runs,
and rolled everything back on a deliberate raise:

```
PROBE ALL PASS double send: status-update-queues=wallet.withdrawal_outcome.
The SAME code path also calls withdrawalFailed directly through sendMessage,
so one failed withdrawal is TWO emails.
```

**Nothing reaches anybody today because there is no key, so this is a defect to
fix BEFORE the key is set rather than after.**

**The remedy, for whoever holds wallet and the Paystack webhook.** Delete the
three direct `withdrawalFailed` sends (`app/api/paystack/webhook/route.ts`
around line 469, `lib/wallet/actions.ts` around lines 696 and 908) and let the
trigger's `wallet.withdrawal_outcome` be the only one. `withdrawalFailed` then
becomes an unwired builder and needs a written refusal beside it
("superseded by `withdrawalOutcome`, which the outbox sends on every
withdrawal outcome and which tells `reversed` apart from `failed`") and an
entry in `REFUSED` in `lib/email/reachability.test.ts`, or the suite will say
so. The junction worker did not make this change because both files belong to
the money worker's scope.

### Finding 2. The eight escrow emails print a raw uuid as their reference

`heldPaymentProposed` and its seven siblings print `data.id`, a 36 character
uuid, as the visible **Reference** row, and again in full under the button.
A person asked to quote `33333333-3333-4333-8333-333333333333` to support over
the phone will not. It is not a personal datum and it is not dangerous; it is
our plumbing on somebody's screen where a short human reference belongs, the
way `supportTicketFiled` and `withdrawalOutcome` both already have one.

`lib/notify/outbox-delivery.test.ts` forbids every other id from appearing
anywhere in any message and exempts this one explicitly, under protest, with a
note saying to delete the exemption the day escrow grows a short reference.

### Finding 3. `profiles.welcomed_at` is no longer the once-ever guarantee

It was a stamp on a table its own owner can write, which is why the old send
site also had to refuse any account confirmed more than a day ago. The
guarantee is now the UNIQUE dedupe key `account:welcome:<user id>` on
`public.email_outbox`, a table with RLS on and no policy that only the service
role reaches. The column is kept (dropping one is data-losing), is NULL on
every row, and now carries a comment saying what replaced it.

### Finding 4. Nobody who has ever signed up here has been welcomed

Measured on 23 September before any of this work: seven accounts, five with a
confirmed address, `welcomed_at` NULL on every row. **Those five are not
backfilled.** A welcome that arrives months after somebody joined is not a
welcome, it is a surprise. The triggers fire forward only.

---

## 5. What a person should do next, in order

**Updated 23 September 2026.** `RESEND_API_KEY` is set, the Send Email Hook is
on, and every row in the outbox has been sent (5 SENT, 0 PENDING at 23:47 UTC on
23 September). What remains:

1. **Check finding 1 is closed** before relying on withdrawal emails: two
   sends about the same failed withdrawal is the defect it describes.
2. **Give replies somewhere to go.** Set `EMAIL_REPLY_TO` (not set today) to a
   mailbox on a domain that receives mail, and add MX and DMARC records for
   `vallospaces.com` (THE_AUDIT OPS-06).
3. **Read the first emails that arrive in real inboxes.** The From line as an
   inbox shows it, the dark rendering in Gmail and Apple Mail and the spam
   verdict cannot be proved from a test.

The public address on every message is `hello@vallospaces.com`. The private
gmail appears on no surface and in no email, and
`lib/notify/outbox-delivery.test.ts` asserts that for every template.

## The explicit-paint rule (Track H, 25 September; redesigned 29 September 2026)

Every message is passed through `paintExplicit` after it is built: every body, table and cell carries its colour as both a `bgcolor` attribute and an inline `background-color`, every text element carries an inline colour, and a cell that inherits its colour inherits its container's ground class, so the dark scheme repaints the two together. The inline layer is the light design (a navy brand band over a white card, `docs/email/AUTH_EMAILS.md` section 3); `prefers-color-scheme: dark` repaints it in the dark palette where a client honours the query, and `[data-ogsb]` rules follow Outlook.com's own dark mode. `lib/email/email-dark-paint.test.ts` holds every catalogue message and auth template to AA as written, inverted (Gmail's apps) and in the dark scheme. The auth templates in `supabase/templates` are built by the same step and must be pasted into Supabase Auth after any change (they are the fallback; the Send Email Hook renders the live ones).
