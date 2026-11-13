-- ============================================================================
-- CHECK THIS FILE AGAINST THE LIVE SCHEMA BEFORE ANYONE RUNS IT. IT WAS
-- WRITTEN FROM THE MIGRATIONS IN THE REPOSITORY WHILE THE DATABASE CONNECTION
-- WAS DOWN (13 NOVEMBER 2026). READ, ON LIVE, FIRST:
--   select to_regclass('public.display_exchange_rates');          -- expect null
--   select column_name, data_type from information_schema.columns
--    where table_schema = 'public' and table_name = 'profiles' and column_name = 'settings';
--                                                                  -- expect jsonb
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--    where conrelid = 'public.profiles'::regclass and pg_get_constraintdef(oid) ilike '%settings%';
--                                                                  -- expect no row
-- IF ANY ANSWER DIFFERS, STOP AND TELL THE LEAD. NOT APPLIED. ONLY THE FOUNDER
-- APPLIES IT.
-- ============================================================================
--
-- DISPLAY EXCHANGE RATES (Agent CURRENCY, 13 November 2026).
--
-- THE MEASURED NEED. The founder (13 November 2026): add a currency setting so
-- a reader can see prices in pounds, dollars, euros and the rest. Vallo had no
-- rates anywhere: no table, no job, no conversion, and /settings/region said
-- so. A converted figure needs a dated rate, fetched on a schedule and read at
-- request time, never fetched per request (the source rate limits and asks for
-- once a day). This file is the one table that holds those rates.
--
-- NAIRA STAYS THE PRICE OF RECORD. These are DISPLAY rates: the "about £2,516"
-- guide beside a naira price on a browsing page. They are never used to
-- charge, refund, pay out, quote an offer or reconcile anything, and no money
-- function may read this table. The app's reasoning is in the header of
-- apps/web/src/lib/currency/currencies.ts.
--
-- WHAT THIS DOES.
--   public.display_exchange_rates   one row per currency (never NGN): how many
--                                   naira one unit is worth, the source, the
--                                   time the source says it updated and the
--                                   time Vallo fetched it. Written by
--                                   /api/cron/display-rates (service role,
--                                   upsert on currency, twice a day). Read by
--                                   the server at request time with the
--                                   service role; a rate older than 48 hours
--                                   by either clock is not shown.
--   RLS ON, NO GRANT to anon or authenticated, and no policy. The primary
--   source (ExchangeRate-API, open access) FORBIDS REDISTRIBUTION, so the rates
--   must not be readable through the public API by anybody holding the anon
--   key. The service role reads and writes them; nothing else can.
--
-- WHAT THIS DOES NOT DO.
--   - It adds nothing to public.profiles. The reader's choice is stored in the
--     existing jsonb column as profiles.settings.display =
--     { "currency": "GBP" | "auto" | ..., "areaUnit": "sqm" | "sqft" }, written
--     by the member's own RLS-bound session through the existing profile
--     update policy, as every other preference is. No constraint, no column,
--     no trigger. The account purge already clears settings to '{}', so the
--     choice goes with the account.
--   - It touches no money table, no money function, no existing grant.
--   - It schedules nothing in pg_cron; the job is Vercel Cron (vercel.json).
--   - Until it is applied the job's write fails (reported on the desk as
--     display_rates.write_failed) and every page shows naira only, exactly as
--     today. Nothing breaks.
--
-- SAFE TO RUN TWICE: create table if not exists, enable row level security is
-- idempotent, revoke and grant are idempotent, comment on replaces.
--
-- READ-BACK at the foot: the table exists with RLS on; has_table_privilege
-- shows anon and authenticated with no privilege on it and service_role with
-- select, insert and update (and no delete).

begin;

set local lock_timeout = '5s';

create table if not exists public.display_exchange_rates (
  currency          text primary key
                    check (currency ~ '^[A-Z]{3}$' and currency <> 'NGN'),
  ngn_per_unit      numeric(20, 9) not null check (ngn_per_unit > 0),
  source            text not null check (source in ('exchangerate-api', 'currency-api')),
  source_updated_at timestamptz not null,
  fetched_at        timestamptz not null default now()
);

alter table public.display_exchange_rates enable row level security;

revoke all on table public.display_exchange_rates from public, anon, authenticated;
grant select, insert, update on table public.display_exchange_rates to service_role;

comment on table public.display_exchange_rates is
  'DISPLAY ONLY. Naira per one unit of another currency, for the approximate guide beside a naira price on browsing pages. Never used to charge, refund, pay out or reconcile. Written twice a day by /api/cron/display-rates; not shown when older than 48 hours. No anon or authenticated grant: the source forbids redistribution.';
comment on column public.display_exchange_rates.ngn_per_unit is
  'How many naira one unit of currency is worth, nine decimal places, worked from the source''s US dollar table.';
comment on column public.display_exchange_rates.source_updated_at is
  'When the source says these rates were last updated. Staleness is judged on the older of this and fetched_at.';

commit;

-- ---------------------------------------------------------------- READ-BACK
-- 1. The table, with RLS on. Expect one row: display_exchange_rates | t
select c.relname, c.relrowsecurity
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relname = 'display_exchange_rates';

-- 2 and 3. Privileges, asked of each role by name with has_table_privilege.
--    NOT information_schema.role_table_grants: that view lists only the
--    grants the observing role is party to, so it can show nothing and look
--    clean when it simply cannot see. Expect exactly:
--      anon          f f f f
--      authenticated f f f f
--      service_role  t t t f
select r.role,
       has_table_privilege(r.role, 'public.display_exchange_rates', 'select') as can_select,
       has_table_privilege(r.role, 'public.display_exchange_rates', 'insert') as can_insert,
       has_table_privilege(r.role, 'public.display_exchange_rates', 'update') as can_update,
       has_table_privilege(r.role, 'public.display_exchange_rates', 'delete') as can_delete
  from (values ('anon'), ('authenticated'), ('service_role')) as r(role)
 order by r.role;

-- 4. After the first scheduled run (00:50 or 12:50 UTC), or a hand-run with
--    the cron bearer: ten rows, fetched within the hour.
-- select currency, ngn_per_unit, source, source_updated_at, fetched_at
--   from public.display_exchange_rates order by currency;

-- 5. How many members have chosen a display preference (for the founder's
--    curiosity; reads no one's choice).
-- select count(*) from public.profiles where settings ? 'display';
