-- CIRCLE: let owners and moderators remove a member from a community.
--
-- An owner can remove anyone except themselves; a moderator can remove
-- ordinary members but not other moderators or the owner. Removing a
-- member deletes their membership row, which cascades to the counter
-- trigger.

set lock_timeout = '5s';

create or replace function public.circle_remove_member(
  p_community uuid,
  p_user uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  v_caller_role text;
  v_target_role text;
begin
  if uid is null then return 'signed_out'; end if;

  v_caller_role := private.circle_role(p_community, uid);
  if v_caller_role is null then return 'not_member'; end if;
  if v_caller_role not in ('owner', 'moderator') then return 'not_allowed'; end if;

  -- Cannot remove yourself through this function (use circle_leave).
  if p_user = uid then return 'not_allowed'; end if;

  v_target_role := private.circle_role(p_community, p_user);
  if v_target_role is null then return 'not_member'; end if;

  -- A moderator cannot remove an owner or another moderator.
  if v_caller_role = 'moderator' and v_target_role in ('owner', 'moderator') then
    return 'not_allowed';
  end if;

  delete from public.circle_memberships m
   where m.community_id = p_community and m.user_id = p_user;

  return 'removed';
end;
$$;

revoke all on function public.circle_remove_member from public;
grant execute on function public.circle_remove_member to authenticated;
