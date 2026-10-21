# Database notes: statements the migration connector cannot run

The Supabase connector used by agents waits for a confirmation on any statement that contains
`DELETE` or `DROP`, and the confirmation never arrives, so those statements time out after 60
seconds. Run them in the Supabase dashboard SQL editor instead. Everything else is applied through
the connector and recorded in `supabase/migrations/APPLIED.txt`.

## URGENT: run before anything else (17 October 2026)

The Supabase connector in the 17 October session had no access to project
`uccixoonmbhrnyczyigt`, so this fix is written but not applied. It closes a
live privacy hole: since pov05 (13 October), a guest whose stay is confirmed but
unpaid is shown the address, check-in times, host name and, for a listing stay,
the gate access code, and an unpaid stay can be checked in. The CI probes
`d75b-stay-trip-details` and `p1_f_stay_events` have failed on every run since.

Fixed and recorded on 21 October 2026 (migration `20261021105606_booking_is_paid_never_null.sql`); the probes `booking-is-paid-never-null`, `d75b-stay-trip-details` and `p1_f_stay_events` should now pass.

## One open alert keeps probe db-p2-02 red (17 October 2026)

The CI run on main says one open alert matches what the pass-one audit probes
used to raise (an unsigned Paystack webhook, the unconfigured Yellow Card
webhook, the account purge called without its secret). Look at it first, because
an invalid signature can also be a real webhook from a stranger:

```sql
select id, created_at, severity, title, description from public.risk_alerts
 where status = 'open'
   and (title ilike 'Cron: account purge, unauthorised%' or title ilike '%signature%invalid%' or title ilike '%yellow%card%unconfigured%');
```

If it is leftover test noise, close it (an UPDATE, nothing is deleted; the connector can run it too):

```sql
update public.risk_alerts set status = 'resolved', resolved_at = now() where status = 'open' and (title ilike 'Cron: account purge, unauthorised%' or title ilike '%signature%invalid%' or title ilike '%yellow%card%unconfigured%');
```

## The example collection belongs to the QA member on live (17 October 2026, inferred, check first)

Read from the CI probe failures, not from the database (this session had no access): the
example collection's agents row `e0000000-0000-4000-8000-000000000002` no longer belongs to the
example lister `e0000000-0000-4000-8000-000000000001` but to the QA member
`957b3bd2-cce3-425d-bba9-5cd876ca3d62`. If so, a viewing request or a message on an example
listing reaches the QA member's inbox. Check:

```sql
select id, user_id, display_name, type, is_demo from public.agents
 where id = 'e0000000-0000-4000-8000-000000000002' or user_id = '957b3bd2-cce3-425d-bba9-5cd876ca3d62';
```

If the row shows the QA member's user id and nobody moved it on purpose, give it back:

```sql
update public.agents set user_id = 'e0000000-0000-4000-8000-000000000001' where id = 'e0000000-0000-4000-8000-000000000002' and user_id = '957b3bd2-cce3-425d-bba9-5cd876ca3d62';
```

The probes no longer depend on it: each one gives the row back inside its own rolled-back transaction.

## The custody switch guard is missing on live (17 October 2026)

Probe `track-a-custody-retired` says the live database lets the `wallet` switch be turned on,
which every migration refuses. The guard was restored on 21 October 2026 (migration `20261021104403_custody_switch_guard_restored.sql`); it does not turn any switch off. Saving a card has its own switch, `saved_cards` (off until set). Once the new site is live, set `saved_cards` on if cards should be saved, then turn `wallet` off: `insert into public.feature_flags (key, enabled) values ('saved_cards', true) on conflict (key) do update set enabled = true;` then `update public.feature_flags set enabled = false where key = 'wallet';`

## What is left, and it is optional

Two housekeeping statements cannot be run through the connector (it freezes on `DELETE` and on
`DROP FUNCTION`). Neither blocks anything. Run them in the dashboard SQL editor when convenient.

Tried again through the connector on 13 October 2026, word for word: item 1 through `execute_sql`
and then `apply_migration`, item 2 as one `apply_migration` named `drop_tmp_probes`. All three
calls timed out after 60 seconds and nothing landed (no `private.purge_old_reminders`, no
`vallo_purge_old_reminders` job, `cron.job` still 40 rows, the seven `tmp_probe*` functions still
there, nothing recorded in `schema_migrations`). Both still wait for the SQL editor. After item 1
runs, `select count(*) from cron.job` should read 41. If item 2 is run as a migration, record it
like any other (`node scripts/check-migrations.mjs --record ...`).

All three below, plus the retired objects (rt01), are in ONE file to paste: `docs/sql-editor/01-cleanup-now.sql` (items 1 and 2 and rt01). Item 3 waits for the deploy (`supabase/migrations/pending/rt02_remove_v100_renter_passport.sql`).

1. Purge of old reminder rows (the ledgers are tiny, so this can wait a year):

```sql
create or replace function private.purge_old_reminders()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.member_reminders where sent_at < now() - interval '400 days';
  delete from public.viewing_reminders where sent_at < now() - interval '400 days';
$$;

revoke all on function private.purge_old_reminders() from public, anon, authenticated;

select cron.schedule('vallo_purge_old_reminders', '23 3 * * *', 'select private.purge_old_reminders();');
```

2. Seven leftover `private.tmp_probe*` test functions. They are neutralised and revoked, so they
   are harmless:

```sql
drop function if exists private.tmp_probe_rowtype();
drop function if exists private.tmp_probe2();
drop function if exists private.tmp_probe3(uuid);
drop function if exists private.tmp_probe4(uuid);
drop function if exists private.tmp_probe5(uuid);
drop function if exists private.tmp_probe6(uuid, uuid);
drop function if exists private.tmp_probe7(timestamp with time zone);
```

3. The old renter passport (V-100), retired in the app on 13 October 2026. Paste this only
   AFTER the release has applied `pass01_passport_settings.sql`, because pass01 reads
   `renter_passports` once to carry members' choices over to the new Vallo passport.
   pass01 was applied on 13 October 2026 (20261013171854; the one `renter_passports` row was
   carried over), but this STILL WAITS for the deploy: production runs the old site from `main`,
   which still calls these functions. Run it only once the new app is serving traffic:

```sql
drop function if exists public.share_renter_passport(uuid, boolean);
drop function if exists public.passport_shared_here(uuid);
drop function if exists public.renter_passport_for_thread(uuid);
drop function if exists public.set_renter_passport(boolean);
drop function if exists public.my_renter_passport();
drop function if exists private.passport_facts(uuid);
drop table if exists public.passport_shares;
drop table if exists public.renter_passports;
```

   Then regenerate `database.types.ts`. `public.record_vnin_check` stays: it is still called.
