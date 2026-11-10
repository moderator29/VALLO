# Release runbook: escrow, the payer's rail choice and the notice set

Founder instruction, 13 October 2026: "make escrow functional and let escrow
work". The pending SQL for it (`pov01` to `pov08`) and the pending SQL for the
notification gaps (`nt01` to `nt06`, see `docs/NOTIFICATIONS_MAP.md`) are
released together, in the order of section 1. The escrow work is on branch
`track/escrow-live`; the notice work and this combined runbook are on
`track/notice-release`. `pov01` to `pov07` and `nt01` to `nt06` were applied to
the live database on 13 October 2026 (section 1); `pov08` is not, and nothing is
on `main` until the founder says "push to main". The lead runs these steps;
each one says how to check it and how to undo it.

Project: `uccixoonmbhrnyczyigt`. Pending SQL: `supabase/migrations/pending/`.
Rollback SQL: `supabase/migrations/pending/rollback/`. Probes:
`supabase/tests/probes-pending/`.

## 0. Before you start

What is true live today (read 13 October 2026):

- `payments_protected_pay_on` is **on**. Since D77 it is the only escrow switch: the
  app reads it (`PROTECTED_PAY_FLAG`) and the database reads it
  (`private.rentals_protected_pay_on`). `rentals_protected_pay` is read by
  nothing.
- No the retired provider key is set in Vercel, so escrow is closed in practice.
- There are no `deal_agreements` and no `provider_arrangements` rows yet.

Consequence: **the moment `PROVIDER_SECRET_KEY` is set in production with this
branch deployed, escrow opens to every rent and shortlet payer.** To release
in steps, keep one of these closed until the smoke tests in section 4 are
ready:

- set `PAYMENTS_KILL_PROTECTED_PAY=1` in Vercel production (stops every the retired provider call,
  no database needed; recording from the partner still works), or
- turn `payments_protected_pay_on` off in the admin switches.

While escrow is closed the app offers card to a rent or shortlet payer, tells
a buyer on a sale that escrow is paused and takes nothing, and never shows a
held balance it cannot read.

Dry run evidence: all eight pending files were applied in one `DO` block, in
order, followed by the eight probes and four behaviour checks through the real
entry points, and the block ended with `raise exception` so nothing stayed.
Result on 13 October 2026: pov01 to pov08 applied; probes pov01 to pov08 PASS;
S1 (pg_cron sweep keeps held and unknown stays, cancels an unfunded stay with
its arrangement and a plain stale hold), S2 (the cron route's sweep, same), S3a
(a bare private refund-and-cancel on a held stay is refused), S3b (the staff
wrapper cancels it), S4 (a plain cancel while the partner's answer is unknown is
refused) all OK.

Dry run evidence for the notice set, 13 October 2026, read only on the live
database (every statement ran inside one `DO` block that ended with
`raise exception`; afterwards the trigger, function, table, row-count and
definition checks showed nothing had persisted):

- Live definitions read first. `private.send_member_reminders` is the only live
  function that `nt01` to `nt06` replace; its live body is exactly the first two
  lines of the `nt05` version (viewing and rent-due reminders), saved as
  `rollback/nt05_send_member_reminders.sql`. Everything else they create is new:
  no function, trigger or table of those names exists live, and no trigger on
  `transactions`, `provider_arrangements`, `referrals`, `rewards_payouts`,
  `auth.users`, `confirmed_phones`, `deal_agreements`, `listing_mandates`,
  `listings` or `bookings` has a clashing name. The new triggers sort after the
  existing ones (`zz_` names), so on `transactions` the notice fires after
  `open_tenancy_records` has written the rent row and before the `pep_watch`
  and sanctions triggers.
- Run 1: `nt01` to `nt06` applied in order, then the six `nt` probes: all PASS.
- Run 2: `pov01` to `pov05` and `pov07`, then `nt01` to `nt06`, in one block,
  then the six `nt` probes and the `pov` probes: all twelve PASS. `pov06` was
  left out of the connector run because it carries a delete and a truncate
  trigger event and the agent connector stalls on those (section 1, tooling
  note); it touches only `scoped_commission_rates` and
  `b3_commission_for_booking`, which no notice file reads, so it cannot
  interact with `nt02`.
- `nt02` against `pov04` and `pov05` (both touch settlement): the notice trigger
  fires on the `update ... set status = 'SUCCESSFUL'` inside
  `private.settle_booking_charge`. It reads only the transaction, booking and
  rent rows and writes only notices, so it does not depend on what `pov04` or
  `pov05` add, and neither depends on it. `pov04`'s refund-due path (status
  FAILED) never fires it; `pov05`'s hold-sweep trigger is `BEFORE UPDATE` on
  `bookings`, `nt06`'s is `AFTER UPDATE`, and a sweep that is vetoed never
  reaches it. Run 2 also called `settle_booking_charge` with both applied: it
  answered refund-due, left the transaction FAILED and wrote no notice.
- A failure in the notice path never blocks a payment. Both payment-side
  triggers catch their own error, report it through `private.notice_failed` (a
  log warning and one open `risk_alerts` row, titled "A notice could not be
  sent", one per booking or agreement) and return normally. Proved on the real
  `transactions` table by replacing `private.tell_payment_received` with a
  function that raises: the update to SUCCESSFUL and a direct insert as
  SUCCESSFUL both completed, the rows read SUCCESSFUL, and one alert existed for
  each booking. The same was proved for the protected payment trigger through
  the probe. All ten notice trigger functions swallow their own errors.
- First sweep after `nt05`: on today's data the unread message sweep would queue
  one `message.unread` email (a real unread thread from the last three days).
  Expected; it is the feature working.

## 1. Order of work

| Step | What | When |
| --- | --- | --- |
| 1 | Apply `pov01` to `pov07`, in order, one at a time, with the check after each | **Done 13 October 2026** (versions below) |
| 2 | Apply `nt01` to `nt06`, in order, one at a time, with the check after each | **Done 13 October 2026** (versions below) |
| 3 | Deploy `track/notice-release` to production (after "push to main") | Next: as soon as possible, see the note below |
| 4 | Apply `pov08` | Only after step 3 is serving traffic |
| 5 | Set the the retired provider keys and the webhook, keep escrow closed | After step 3 |
| 6 | Smoke tests, then open escrow | After step 5 |

Applied on 13 October 2026, through the Supabase connector, each file
unchanged (the recorded statement's md5 matched the file), each followed by its
check in section 2 (all returned what is written) and its probe (all PROBE_OK,
except pov06's, see below). Recorded in `supabase/migrations/APPLIED.txt`;
probes moved to `supabase/tests/probes/`.

| File | Version |
| --- | --- |
| `pov01_payer_rail_choice_columns` | 20261013170244 |
| `pov02_rent_and_shortlet_policy_rows` | 20261013170400 |
| `pov03_rail_resolution_honours_the_choice` | 20261013170515 |
| `pov04_payer_rail_choice_rpcs` | 20261013170707 |
| `pov05_escrow_for_shortlet_stays` | 20261013170856 |
| `pov06_hotel_room_commission` | 20261013171019 |
| `pov07_workspace_acceptance_record` | 20261013171213 |
| `nt01_notice_helpers` | 20261013171244 |
| `nt02_payment_and_protected_payment_notices` | 20261013171342 |
| `nt03_referral_notices` | 20261013171442 |
| `nt04_account_agreement_and_listing_notices` | 20261013171536 |
| `nt05_stay_reminders_and_unread_message_email` | 20261013171652 |
| `nt06_booking_request_closed_email` | 20261013171807 |

The Vallo passport files (`pass01` 20261013171854, `pass02` 20261013172017)
and `fx01` (20261013172138) were applied the same day; they are not part of
this runbook.

Still pending: only `pov08` (step 4), which must wait for the new app because
the old app does not record the pay-on-Vallo statement. Then the keys (step 5),
the smoke tests and opening escrow (step 6).

pov06 went through `apply_migration` without stalling. Its probe did not: the
probe runs a `delete` and a `truncate` against the rates table to prove they
are refused, and the connector timed out on it (nothing persisted; the rates
table still holds the one 1,000 bps row). The probe is in
`supabase/tests/probes/` and runs in the `db-probes` CI job; to run it by hand,
paste it in the SQL editor.

The notice files are live while production still runs the old app (step 3 is
not done). The old email drain does not know the five new templates and
discards such a row for good. On 13 October 2026, a few minutes after nt05, one
`message.unread` row was already PENDING. Deploy soon; if the deploy is held,
run `rollback/nt_notice_triggers_off.sql` and
`rollback/nt05_send_member_reminders.sql` as written below.

Why this order:

- `pov01` to `pov06` change nothing the current app can see except the hotel
  room commission (`pov06`, 10 percent from the hotel's share), which is the
  founder's ruling and is computed in the database for whichever app is live.
  Rent and shortlet rails stay escrow by default (a missing choice reads as
  escrow), which today's app already refuses as not open.
- `pov07` adds `agent_applications.consents`, which the new app writes on
  every application submit and resubmit. It must exist first.
- `pov08` refuses any application or host setup sent without the pay-on-Vallo
  statement. The old app does not record it, so `pov08` before the new app
  would block every new application.

- `nt01` to `nt06` come after the payment files and right before the deploy.
  The new code builds five email templates (`payment.host_received`,
  `payment.rent_receipt`, `stay.review_request`, `message.unread`,
  `booking.request_closed`) and the email drain discards, for good, a row whose
  template the running code does not know. The notice SQL writes those rows, so
  the window between step 2 and step 3 must be short: do not start step 2 until
  the deploy is built and ready to promote. If the deploy is held up after
  step 2, run `rollback/nt_notice_triggers_off.sql` and
  `rollback/nt05_send_member_reminders.sql` until it is ready (the in-app and
  push notices need no code and are harmless to leave on; the rows to protect
  are the emails).
- `nt01` goes first because the others call `private.notify_once` and
  `private.notice_failed`. They come after the payment files because `nt02`
  hangs a trigger on `transactions`, whose settlement `pov04` and `pov05`
  change; the dry run proved the order composes.
- `nt` adds no cron job and changes no cron schedule. The count stays at 40
  (`select count(*) from cron.job`).

Tooling note: `pov06` contains the trigger events that some SQL connectors
stall on (it guards the rates table against removal). On 13 October 2026 it
went through `apply_migration` without a stall; its probe (a real `delete` and
`truncate`) did stall, so that probe is run from the SQL editor or CI.

## 2. Each migration: apply, check, undo

Apply each file as one migration, with the file name as the migration name.
Run its check straight after. If a check does not return what is written,
stop and run that file's rollback.

### pov01_payer_rail_choice_columns

Check:

```sql
select column_name from information_schema.columns
 where table_schema = 'public'
   and ((table_name = 'deal_agreements' and column_name in ('payer_rail_choice', 'payer_rail_chosen_at'))
     or (table_name = 'payment_rail_policy' and column_name = 'payer_may_choose'));
-- expect 3 rows
select conname from pg_constraint
 where conname in ('deal_agreements_payer_rail_choice_known', 'deal_agreements_payer_rail_choice_dated',
                   'payment_rail_policy_choice_is_rent_only');
-- expect 3 rows
```

Undo: `rollback/rb01_payment_rail_policy_guard.sql` (restores the guard). The
new columns and constraints are additive and stay; nothing reads them once
`pov03` is undone.

### pov02_rent_and_shortlet_policy_rows

Check:

```sql
select property_type, lister_kind, rail, payer_may_choose from public.payment_rail_policy
 where effective_to is null and listing_intent = 'rent' and payer_may_choose order by 1, 2;
-- expect 9 rows, all escrow: apartment (business), apartment (individual), home, land,
-- office, rental, shop, shortlet, villa
select count(*) from public.payment_rail_policy
 where id in ('7d8b0368-d092-4d87-b304-f106841f4769', '64a15101-8c87-4055-86a9-0602f6882f35',
              '8176a4a2-dda7-49e2-a243-555a04ed9407', '48ab9c08-ed77-4b6c-a460-a1ba949c427d',
              '054fa444-4b0a-459e-bf55-5f8f423a4de4', '087f5394-e941-4d45-a3b7-4669908d2427',
              'ab87c6d0-1d2b-479d-befc-f72bf5d03873', '87d20cc3-7f87-459e-a1b1-bbaccf1f352b',
              '671e4bc1-012c-47c3-9ef5-e54a7728a286') and effective_to is not null;
-- expect 9 (the rows of 5 October retired, kept as history)
```

Undo: `rollback/rb02_rent_and_shortlet_policy_rows.sql` (retires the nine new
rows and adds the nine 5 October answers back as new rows; no row is removed).

### pov03_rail_resolution_honours_the_choice

Check:

```sql
select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'private' and proname in ('rail_business_scope', 'rail_policy_lets_payer_choose',
   'rail_base_for_accommodation', 'rail_base_for_listing', 'rail_base_for_booking', 'rail_base_for_agreement',
   'rail_options_for_agreement');
-- expect 7 rows
select private.rail_business_scope(k) from unnest(array['hotel', 'guest_house', 'resort',
  'serviced_apartments', 'shortlet_operator', 'restaurant']) k;
-- expect hotel, hotel, hotel, hotel, shortlet, restaurant
select has_function_privilege('authenticated', 'private.rail_for_agreement(uuid)', 'execute');
-- expect false
```

Undo: `rollback/rb03_rail_for_booking_and_agreement.sql` (restores the live
`rail_for_booking`, `rail_for_agreement` and `agreement_review_required`; the
new helpers stay and are unused).

### pov04_payer_rail_choice_rpcs

Check:

```sql
select has_function_privilege('authenticated', 'public.payment_rail_choose(uuid, text)', 'execute'),
       has_function_privilege('anon', 'public.payment_rail_choose(uuid, text)', 'execute'),
       has_function_privilege('authenticated', 'public.payment_rail_options(uuid)', 'execute'),
       has_function_privilege('authenticated', 'public.payment_rail_for_booking(uuid)', 'execute');
-- expect true, false, true, false
select pg_get_functiondef('private.settle_booking_charge(text, bigint, bigint, uuid)'::regprocedure)
       like '%partner_holds_payment%';
-- expect true
select pg_get_functiondef('public.payment_rail_choose(uuid, text)'::regprocedure) like '%card_needs_review%';
-- expect false (the dead end is gone: card under a risk signal goes to a person, it is never refused)
```

Undo: `rollback/rb04_settle_booking_charge.sql` (restores the live settlement;
its last statement revokes `payment_rail_choose` from members so no choice can
be stored while the rest is rolled back).

### pov05_escrow_for_shortlet_stays

Check:

```sql
select tgname, tgenabled from pg_trigger
 where tgname in ('bookings_00_partner_hold_keeps_the_stay', 'provider_arrangements_02_paid_twice_alert');
-- expect both, tgenabled = 'O'
select pg_get_functiondef('private.release_stale_booking_holds()'::regprocedure) like '%vallo.hold_sweep%',
       pg_get_functiondef('public.expire_booking_holds(interval, integer)'::regprocedure) like '%vallo.hold_sweep%';
-- expect true, true
select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname in ('public', 'private') and p.proname ~ '(^|_)escrows?(_|$)';
-- expect 0 (the custody naming guard)
select has_function_privilege('authenticated', 'public.partner_hold_unwind_cancel(uuid, text)', 'execute'),
       has_function_privilege('service_role', 'public.partner_hold_unwind_cancel(uuid, text)', 'execute');
-- expect false, true
select jobname, command from cron.job where command ilike '%release_stale_booking_holds%';
-- expect the hold sweep vallo_release_stale_holds every 15 minutes, unchanged
```

Undo: `rollback/rb05_partner_hold_and_sweep.sql` (disables the two new
triggers and restores the live `provider_arrangement_open`, `booking_is_paid`,
both sweep entry points, `rent_split_cancel` and
`public.refund_and_cancel_booking`).

### pov06_hotel_room_commission (SQL editor)

Check:

```sql
select private.scoped_commission_bps('hotel_room', now());
-- expect 1000
select has_table_privilege('service_role', 'public.scoped_commission_rates', 'update'),
       has_table_privilege('authenticated', 'public.scoped_commission_rates', 'select');
-- expect false, false
select tgname from pg_trigger where tgrelid = 'public.scoped_commission_rates'::regclass and not tgisinternal;
-- expect scoped_commission_rates_00_history and scoped_commission_rates_01_never_truncated
```

Undo: `rollback/rb06_b3_commission_for_booking.sql` (restores the live
commission function; the rates table stays as history and is read by nothing).

### pov07_workspace_acceptance_record

Check:

```sql
select is_nullable, column_default from information_schema.columns
 where table_schema = 'public' and table_name = 'agent_applications' and column_name = 'consents';
-- expect NO, '{}'::jsonb
```

Undo: none needed; the column and the reader are additive. Leave them.

### pov08_workspace_acceptance_required (after the app is live)

Before applying, confirm the new app is serving: submit one professional
application on a test account and check

```sql
select consents -> 'agreements' from public.agent_applications order by created_at desc limit 1;
-- expect terms, privacy and pay_on_vallo entries, each with version and at
```

Check after:

```sql
select tgname, tgenabled from pg_trigger
 where tgname in ('agent_applications_03_acceptance_required', 'businesses_02_acceptance_required');
-- expect both, 'O'
```

Undo: `rollback/rb08_workspace_acceptance_required.sql` (disables both
triggers).

### The notice set, nt01 to nt06 (after pov07, before the deploy)

Apply each file as one migration, with the file name as the migration name, in
this order. Run its check straight after. All six are additive: new functions,
one new table and ten new triggers, and one replaced function (`nt05`). Their
probes (`supabase/tests/probes-pending/nt01-...` to `nt06-...`) read real
profiles, so run them against the database as it is, not an empty branch.

#### nt01_notice_helpers

Check:

```sql
select to_regclass('private.notice_keys') is not null,
       has_function_privilege('authenticated', 'private.notify_once(text, uuid, public.notification_kind, text, text, text)', 'execute'),
       has_function_privilege('service_role', 'private.notice_failed(text, text, text, text, text)', 'execute');
-- expect true, false, false
```

Undo: nothing to undo on its own; it only adds a table and two functions that
nothing calls until `nt02` to `nt06`.

#### nt02_payment_and_protected_payment_notices

Check:

```sql
select tgname, tgenabled from pg_trigger
 where tgname in ('transactions_zz_notify_payment_received', 'provider_arrangements_zz_notify_change');
-- expect both, 'O'
select count(*) from pg_proc
 where pronamespace = 'private'::regnamespace
   and proname in ('deliver_payment_received', 'tell_payment_received', 'notify_payment_received',
                   'tell_arrangement', 'notify_arrangement_change');
-- expect 5
select pg_get_functiondef('private.notify_payment_received()'::regprocedure) like '%notice_failed%';
-- expect true (a failing notice is reported and swallowed, never raised)
```

Undo: `rollback/nt_notice_triggers_off.sql` (disables the trigger).

#### nt03_referral_notices

Check:

```sql
select tgname, tgenabled from pg_trigger
 where tgname in ('referrals_zz_notify_referrer', 'rewards_payouts_zz_notify_member');
-- expect both, 'O'
```

Undo: `rollback/nt_notice_triggers_off.sql`.

#### nt04_account_agreement_and_listing_notices

Check:

```sql
select tgname, tgenabled from pg_trigger
 where tgname in ('users_zz_notify_password_changed', 'confirmed_phones_zz_notify_confirmed',
                  'deal_agreements_zz_notify_change', 'listing_mandates_zz_notify_decided',
                  'listings_zz_notify_ownership_seen');
-- expect five, all 'O'
select tgqual is not null from pg_trigger where tgname = 'users_zz_notify_password_changed';
-- expect true (the WHEN guard: only a changed password fires it)
```

Undo: `rollback/nt_notice_triggers_off.sql`.

#### nt05_stay_reminders_and_unread_message_email (replaces a live function)

Check:

```sql
select pg_get_functiondef('private.send_member_reminders()'::regprocedure) like '%send_stay_reminders%'
   and pg_get_functiondef('private.send_member_reminders()'::regprocedure) like '%send_unread_message_emails%';
-- expect true
select jobname, schedule from cron.job where jobname = 'vallo_send_member_reminders';
-- expect the same schedule as before, 7,22,37,52 * * * *
select count(*) from cron.job;
-- expect 40, unchanged
```

Undo: `rollback/nt05_send_member_reminders.sql` (the live body, saved before the
change). The stay and unread sweeps stay in place, unused.

#### nt06_booking_request_closed_email

Check:

```sql
select tgname, tgenabled from pg_trigger where tgname = 'bookings_zz_notify_request_closed';
-- expect one row, 'O'
```

Undo: `rollback/nt_notice_triggers_off.sql`.

#### After the deploy

```sql
select template, status, count(*) from public.email_outbox
 where template in ('payment.host_received', 'payment.rent_receipt', 'stay.review_request',
                    'message.unread', 'booking.request_closed')
 group by 1, 2;
-- expect SENT (or PENDING for the last fifteen minutes), no DROPPED
select count(*) from public.risk_alerts where title = 'A notice could not be sent' and status = 'open';
-- expect 0; a row means a notice failed and was skipped while the payment or change went through
```

### Rolling back more than one

Run the notice rollbacks first, then the payment ones, in reverse order:
`nt_notice_triggers_off`, `nt05_send_member_reminders`, then rb08, rb06, rb05,
rb04, rb03, rb02, rb01. None of them removes a row, a table or a function.

## 3. Keys, webhook and switches (after the deploy)

1. Vercel production: set `PROVIDER_SECRET_KEY` (an `sk_live_` key). Vercel
   preview: set `PROVIDER_TEST_SECRET_KEY` (an `sk_test_` key) only.
   `retired_providerMerchantConfig` refuses the live key on any deployment whose
   `VERCEL_ENV` is not `production`, so a preview can never move real money.
   Keep `PAYMENTS_KILL_PROTECTED_PAY=1` (or `payments_protected_pay_on` off) for now.
2. the retired provider dashboard, production merchant: webhook URL
   `https://<production domain>/api/retired_provider/webhook`. The route checks
   `x-retired_provider-signature` (HMAC SHA-512 of the raw body with the secret key).
   For staging, point the test merchant's webhook at a preview URL.
3. Check the recorder is live without opening escrow: the route answers 503
   `not_configured` without a key and 401 `signature_invalid` on an unsigned
   post. Expect 401 now:
   `curl -s -X POST https://<production domain>/api/retired_provider/webhook -d '{}'`.
4. Check the reconcile cron: `/admin/jobs` lists `arrangements-reconcile`
   every ten minutes (minutes 8, 18, ... 58). It verifies at most three open
   arrangements per run, inside the retired provider's 10 requests per minute per key.

## 4. Production smoke tests

Use two real accounts the team owns (a payer and a lister), never a member's.
Both must have linked a the retired provider account through the Wallet
(`financial_provider_accounts`, provider `retired_provider`, status `ACTIVE`), and the
payer's the retired provider balance must cover the test amount. Open escrow for the test
(`PAYMENTS_KILL_PROTECTED_PAY` unset and `payments_protected_pay_on` on), and close it again
straight after if the founder has not said to leave it open.

### A. Rent through escrow: funded, held, released

1. On a rental listing the lister owns, agree a small rent (at least 1,000
   naira, the partner's minimum) and reach an approved agreement.
2. As the payer, the payment step shows Escrow (selected) and Pay by card.
   Keep Escrow and continue to the escrow step. Fund it.
3. Check:

   ```sql
   select status, provider_arrangement_id, amount_minor from public.provider_arrangements
    where agreement_id = '<agreement id>';
   -- expect protected once the partner reports the payment (webhook escrow.ongoing,
   -- or the reconcile cron within ten minutes)
   select from_status, to_status, source from public.provider_arrangement_events
    where arrangement_id = '<arrangement id>' order by created_at;
   -- expect preparing, awaiting_payment, (payment_processing,) protected, every move
   -- after preparing sourced from the partner
   ```

4. As the payer, confirm the deal. Expect `release_requested`, then
   `released` once the partner reports `escrow.completed`. The agreement reads
   paid, and the lister's the retired provider balance shows the amount less the partner's
   fee.
5. Nothing is marked paid before the partner says so: between steps 2 and 3
   the agreement must still read approved, not paid.

### B. Hotel room by card, 10 percent from the hotel's share

1. Book a room at a published hotel (or guest house, resort, serviced
   apartments) with a payout subaccount. The payment step shows card only.
2. Pay by card. Check:

   ```sql
   select t.amount_minor, t.commission_minor, t.lister_share_minor, t.guarantee_minor, t.status
     from public.transactions t where t.booking_id = '<booking id>';
   -- expect commission_minor = amount_minor * 1000 / 10000 (rounded down),
   -- commission + lister share + guarantee = amount, status SUCCESSFUL
   select gross_minor, platform_fee_minor, agent_share_minor from public.ledger_entries
    where booking_id = '<booking id>';
   ```

3. The guest's total on the checkout equals the room price shown before
   booking: the 10 percent is never added to it.

### C. Shortlet paid by card, by the payer's choice

1. On a nightly shortlet, reach an approved agreement. The payment step shows
   Escrow (selected) and Pay by card. Pick Pay by card and continue.
2. Check:

   ```sql
   select payer_rail_choice, payer_rail_chosen_at, status from public.deal_agreements where id = '<agreement id>';
   -- expect card, a time, approved (or in_review if a risk signal asked a person;
   -- then approve it in /admin/agreements and continue)
   select action, metadata from public.audit_log where entity_id = '<agreement id>' order by created_at;
   -- expect agreement.rail_chosen with choice card
   select count(*) from public.provider_arrangements where agreement_id = '<agreement id>';
   -- expect 0
   ```

3. Pay on the card checkout. The transaction settles SUCCESSFUL and the
   agreement reads paid. The choice is now locked: the payment step no longer
   offers escrow.

### D. The way out (no money needed)

With escrow closed (`PAYMENTS_KILL_PROTECTED_PAY=1`), open the payment step of a
rent agreement: it offers card and says escrow is paused. On a sale it says
escrow is paused and offers nothing to pay. Reopen escrow afterwards only if
the founder said so.

### E. The notices

After A, B or C, with the Bookings switches of both accounts on:

1. The host has a "Payment received" row in the bell and one
   `payment.host_received` email. A repeat of the webhook adds nothing: the
   count of `private.notice_keys` rows with the key prefix
   `payment:<transaction id>:` stays at 1 or 2.
2. Switch the host's Bookings off in settings and make a second small payment:
   no bell row for the host, and the email still goes (money mail answers to no
   switch).
3. A host declines a request. With Bookings on the guest has "Booking
   cancelled" and "Your booking request was not accepted" with the host's
   words. With Bookings off the guest has neither bell row; the
   `booking.request_closed` email answers to the same switch.

## 5. Watching after release

- `/admin/agreements` watch list: held payments (protected, release
  requested, disputed). Staff can refund to the payer or release to the
  lister; both go through the partner's dispute and resolve calls and are
  audited. Parties to the deal cannot use them.
- Risk alerts: "A deal paid by card was also funded at the payment partner"
  (high) means refund the partner payment; "A card payment could not be
  applied" with reason `partner_holds_payment` means refund the card.
- A stay whose money the partner holds is never cancelled by the hold sweep
  or by a plain cancel; staff cancel it through the refund flow, and when the
  partner reports the money refunded the app cancels the stay itself
  (`partner_hold_unwind_cancel`).

## 6. Not confirmed from the partner's documents

Proven only in production, or against the partner's staging with a test key:

- Real money movement, the partner's real webhook signature and delivery, and
  the read-back by reference.
- `DELETE /v1/escrow/delete/{paymentToken}` (withdraw an unfunded escrow so
  the payer can switch to card): from the vendored page only; the changelog has
  no entry after 2 October 2026.
- Whether `POST /v1/escrow/dispute/resolve/{escrowId}` accepts an escrow
  straight from DISPUTED without an INVESTIGATING step (the page does not say).
- The fee on a refund: the page says the fee is never refunded; the payer's
  wording assumes the partner's fee is kept.
- Whether a second create with the same reference is refused or duplicated
  (when a create's answer is unknown the app reads the seller's escrows back by
  reference and amount instead of creating again, and raises an alert, but the
  partner's own behaviour is not confirmed).
- The 10 requests per minute per key budget under real load (the reconcile
  cron uses at most three per run).
