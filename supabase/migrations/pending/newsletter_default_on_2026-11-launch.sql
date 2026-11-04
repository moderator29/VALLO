-- NEWS AND UPDATES ARE ON BY DEFAULT (the founder, 4 November 2026).
-- Run by hand in the Supabase SQL editor, in this order. Not a migration: it is
-- data, run once, so it lives in pending/ (which check-migrations ignores).

-- 1. UNDO A DEFAULT THAT WAS NEVER A CHOICE.
--    Every settings save (the interests step, for one) wrote the old default
--    `marketing: false` into the member's own row. 17 members hold exactly that
--    untouched default shape: marketing off while bookings, messages and
--    wallet are all on. They never saw a switch for it, so they are turned on.
--    Not touched: anyone with a different shape, such as the one member who
--    switched every topic off on purpose, and anyone with a per-channel answer.
update public.profiles
   set settings = jsonb_set(settings, '{notifications,marketing}', 'true'::jsonb)
 where (settings #>> '{notifications,marketing}') = 'false'
   and (settings #>> '{notifications,bookings}') = 'true'
   and (settings #>> '{notifications,messages}') = 'true'
   and (settings #>> '{notifications,wallet}') = 'true'
   and (settings #> '{notifications,channels,marketing}') is null;

-- 2. CHECK BEFORE SENDING. Expect 23 here (24 confirmed, minus the member who
--    switched everything off on purpose).
select count(*) as will_get_it
  from auth.users u left join public.profiles p on p.id = u.id
 where not coalesce(u.is_anonymous, false) and u.deleted_at is null
   and u.email_confirmed_at is not null and coalesce(btrim(u.email), '') <> ''
   and coalesce(p.settings #>> '{notifications,marketing}', '') <> 'false';

-- 3. QUEUE THE NEWSLETTER (once; a second run queues nothing).
select public.newsletter_enqueue('2026-11-launch');
