-- PROTECTED PAYMENT CATEGORIES, ALL DISABLED (9 November 2026).
--
-- PROTECTED_PAYMENTS_BUILD.md section 9: which deals may ever reach the
-- protected rail (EscrowPay, built and switched off). Eight categories, each
-- `approved`, `pending_approval`, `not_supported` or `disabled`; every one
-- starts DISABLED. A category becomes approved only on the provider's written
-- approval naming Vallo's use case, recorded with its reference, the date and
-- the founder's sign-off; a successful sandbox payment is not approval. The
-- code's half is apps/web/src/lib/money/protected-categories.ts.
--
-- Members never read or write these tables: the server asks
-- private.protected_category_status(), which answers 'disabled' for anything
-- it cannot find. A row is never deleted, and every change is written to the
-- append-only event table. Additive only: two new tables, four functions,
-- three triggers, two feature flag rows, both of which leave the rail OFF.

set local lock_timeout = '5s';

create table if not exists public.protected_payment_categories (
  category               text primary key check (category in (
                           'residential_rent', 'shortlet', 'hotel_booking', 'commercial_rent',
                           'property_sale', 'land_sale', 'event_space', 'other')),
  status                 text not null default 'disabled'
                           check (status in ('approved', 'pending_approval', 'not_supported', 'disabled')),
  provider_approval_ref  text,
  approved_at            timestamptz,
  founder_signoff_by     uuid references auth.users(id) on delete set null,
  founder_signoff_at     timestamptz,
  note                   text,
  updated_at             timestamptz not null default now(),
  constraint protected_payment_categories_approval_is_written check (
    status <> 'approved'
    or (length(btrim(coalesce(provider_approval_ref, ''))) >= 4
        and approved_at is not null
        and founder_signoff_by is not null
        and founder_signoff_at is not null))
);

comment on table public.protected_payment_categories is
  'Which deal categories may reach the protected rail. All start disabled; approved only with the provider''s written approval reference, its date and the founder''s sign-off (PROTECTED_PAYMENTS_BUILD.md section 9). Never deleted; changes logged in protected_payment_category_events.';

create table if not exists public.protected_payment_category_events (
  id           bigint generated always as identity primary key,
  category     text not null references public.protected_payment_categories(category),
  from_status  text,
  to_status    text not null,
  provider_approval_ref text,
  changed_by   uuid,
  changed_at   timestamptz not null default now(),
  note         text
);

comment on table public.protected_payment_category_events is
  'Append-only history of every change to protected_payment_categories.';

alter table public.protected_payment_categories enable row level security;
alter table public.protected_payment_category_events enable row level security;
revoke all on public.protected_payment_categories from public, anon, authenticated;
revoke all on public.protected_payment_category_events from public, anon, authenticated;

create or replace function private.protected_payment_categories_guard()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if tg_op = 'DELETE' then
    raise exception 'a protected payment category is set to disabled, never deleted'
      using errcode = 'insufficient_privilege';
  end if;
  if tg_op = 'UPDATE' then
    if new.category is distinct from old.category then
      raise exception 'a category never changes its name' using errcode = 'insufficient_privilege';
    end if;
    new.updated_at := now();
  end if;
  return new;
end;
$function$;

drop trigger if exists protected_payment_categories_00_guard on public.protected_payment_categories;
create trigger protected_payment_categories_00_guard
  before insert or update or delete on public.protected_payment_categories
  for each row execute function private.protected_payment_categories_guard();

/* After the row is saved (so the history's reference to it holds), every new
   category and every change of status or approval reference is logged. */
create or replace function private.protected_payment_categories_log()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status
     or new.provider_approval_ref is distinct from old.provider_approval_ref then
    insert into public.protected_payment_category_events
      (category, from_status, to_status, provider_approval_ref, changed_by, note)
    values
      (new.category, case when tg_op = 'UPDATE' then old.status end, new.status,
       new.provider_approval_ref, coalesce(new.founder_signoff_by, auth.uid()), new.note);
  end if;
  return null;
end;
$function$;

revoke all on function private.protected_payment_categories_log() from public, anon, authenticated;

drop trigger if exists protected_payment_categories_zz_log on public.protected_payment_categories;
create trigger protected_payment_categories_zz_log
  after insert or update on public.protected_payment_categories
  for each row execute function private.protected_payment_categories_log();

create or replace function private.protected_payment_category_events_append_only()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  raise exception 'the category history is append-only' using errcode = 'insufficient_privilege';
end;
$function$;

drop trigger if exists protected_payment_category_events_append_only on public.protected_payment_category_events;
create trigger protected_payment_category_events_append_only
  before update or delete on public.protected_payment_category_events
  for each row execute function private.protected_payment_category_events_append_only();

/* The one read: anything missing, unknown or unreadable is 'disabled'. */
create or replace function private.protected_category_status(p_category text)
returns text
language sql
stable
security definer
set search_path to ''
as $function$
  select coalesce(
    (select c.status from public.protected_payment_categories c where c.category = p_category),
    'disabled');
$function$;

revoke all on function private.protected_category_status(text) from public, anon, authenticated;

insert into public.protected_payment_categories (category, status, note)
select c, 'disabled', 'Seeded disabled, 9 November 2026: no written approval yet.'
  from unnest(array['residential_rent', 'shortlet', 'hotel_booking', 'commercial_rent',
                    'property_sale', 'land_sale', 'event_space', 'other']) as c
on conflict (category) do nothing;

/* The founder's switch for the new provider: OFF, and the kill switch fails
   closed on a missing or failed read. The partner mark (Option 2, "Secured
   by" beside the pay button) is the presentation choice; it draws nothing
   while the rail is off and the mark asset has not been supplied. */
insert into public.feature_flags (key, enabled, note)
values
  ('payments_escrowpay_on', false,
   'The founder''s switch for the EscrowPay protected rail. Off until the signed agreement, sandbox credentials and written category approval (PROTECTED_PAYMENTS_BUILD.md section 0). Fails closed.'),
  ('protected_partner_mark_on', true,
   'Option 2 presentation: a small Secured by mark beside the pay button on a protected payment. Off means full white label (Option 3).')
on conflict (key) do nothing;
