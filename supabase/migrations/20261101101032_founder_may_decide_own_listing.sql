-- THE FOUNDER MAY DECIDE THEIR OWN LISTING, APPLICATION AND BUSINESS.
-- Nobody-reviews-their-own-case stays for every other staff member. One named
-- account (the founder's, who is also a super admin) is exempt, so they can run
-- and test their own workspace end to end. Money, sanctions and identity
-- document rules are NOT touched.
create table if not exists private.founder_accounts (
  user_id uuid primary key,
  note text
);
revoke all on private.founder_accounts from public, anon, authenticated;
insert into private.founder_accounts (user_id, note)
values ('2255d905-0f31-437e-b719-aa2e4a18e03d', 'phantomfcalls: the founder')
on conflict do nothing;

create or replace function private.is_founder(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user is not null
     and exists (select 1 from private.founder_accounts f where f.user_id = p_user)
     and exists (select 1 from public.user_roles r where r.user_id = p_user and r.role::text = 'super_admin')
$$;
revoke all on function private.is_founder(uuid) from public, anon, authenticated;

create or replace function public.am_i_founder()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_founder((select auth.uid()))
$$;
revoke all on function public.am_i_founder() from public, anon;
grant execute on function public.am_i_founder() to authenticated;

create or replace function private.refuse_self_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  subject uuid;
begin
  if new.reviewer_id is null
     or (new.reviewer_id is not distinct from old.reviewer_id
         and new.reviewed_at is not distinct from old.reviewed_at) then
    return new;
  end if;
  if private.is_founder(new.reviewer_id) then
    return new;
  end if;
  if tg_table_name = 'listings' then
    select a.user_id into subject from public.agents a where a.id = new.agent_id;
    if subject is null and new.assigned_agent_id is not null then
      select a.user_id into subject from public.agents a where a.id = new.assigned_agent_id;
    end if;
  else
    subject := new.user_id;
  end if;
  if subject is not null and subject = new.reviewer_id then
    raise exception 'Nobody reviews their own %. Leave it for another reviewer.',
      case when tg_table_name = 'listings' then 'listing' else 'application' end
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function private.refuse_self_review_host()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  subject uuid;
begin
  if new.reviewer_id is null then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if tg_table_name = 'business_verification_checks' then
      if new.reviewer_id is not distinct from old.reviewer_id
         and new.decided_at is not distinct from old.decided_at then
        return new;
      end if;
    elsif new.reviewer_id is not distinct from old.reviewer_id
          and new.reviewed_at is not distinct from old.reviewed_at then
      return new;
    end if;
  end if;

  if private.is_founder(new.reviewer_id) then
    return new;
  end if;

  if tg_table_name = 'businesses' then
    subject := new.owner_id;
  else
    select b.owner_id into subject from public.businesses b where b.id = new.business_id;
  end if;

  if subject is not null and subject = new.reviewer_id then
    raise exception 'Nobody reviews their own business. Leave it for another reviewer.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
