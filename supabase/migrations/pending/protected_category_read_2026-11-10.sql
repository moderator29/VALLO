-- PROTECTED PAYMENT SCREENS, THE CATEGORY READ (10 November 2026).
--
-- NOT APPLIED. Run AFTER protected_rail_server_2026-11-10.sql, which adds
-- private.protected_category_for_agreement (this calls it), and after
-- END_OF_BATCH_2026-11-10.sql (applied), which added
-- private.protected_category_status. Additive: one read-only function.
-- Safe to run twice. Changes no row.
--
-- Why: the member's screens (apps/web/src/lib/money/protected-read.ts) read
-- under the member's own session, and the private schema is closed to them.
-- This answers one question for one agreement the caller is a party to:
-- which category the database puts the deal in, and that category's status.
-- A party is the renter, the owner, or the named payer (named_payer_id,
-- added by protected_rail_server_2026-11-10.sql).
-- Anyone else, and any agreement it cannot find, is told 'disabled'. It never
-- says more than the two words, and the code treats a missing function, an
-- error or any word but 'approved' as disabled, so the screens stay dark
-- until this is applied AND a category is approved in writing.
--
-- No object name carries a custody word (private.refuse_custody_objects).
begin;
set local lock_timeout = '5s';

create or replace function public.protected_category_status_for_agreement(p_agreement uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_party boolean;
  v_category text;
begin
  select exists (
    select 1 from public.deal_agreements a
     where a.id = p_agreement
       and (select auth.uid()) is not null
       and (select auth.uid()) in (a.renter_id, a.owner_id, a.named_payer_id)
  ) into v_party;
  if not coalesce(v_party, false) then
    return jsonb_build_object('category', 'other', 'status', 'disabled');
  end if;
  v_category := private.protected_category_for_agreement(p_agreement);
  return jsonb_build_object(
    'category', v_category,
    'status', coalesce(private.protected_category_status(v_category), 'disabled'));
end;
$function$;

revoke all on function public.protected_category_status_for_agreement(uuid) from public, anon;
grant execute on function public.protected_category_status_for_agreement(uuid) to authenticated;

-- Self-check: a stranger (no session here) is told disabled.
do $check$
begin
  if (public.protected_category_status_for_agreement(gen_random_uuid()) ->> 'status') <> 'disabled' then
    raise exception 'protected_category_read: a stranger was not told disabled';
  end if;
end
$check$;

commit;
