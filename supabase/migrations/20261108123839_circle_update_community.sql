-- CIRCLE: let owners and moderators update their community settings.
--
-- Allowed changes: name, description, visibility, rules.
-- Only the owner may change visibility (public <-> private).
-- Moderators may update name, description, and rules.

set lock_timeout = '5s';

create or replace function public.circle_update_community(
  p_community uuid,
  p_name text default null,
  p_description text default null,
  p_visibility text default null,
  p_rules text[] default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  v_role text;
begin
  if uid is null then return 'signed_out'; end if;

  v_role := private.circle_role(p_community, uid);
  if v_role is null then return 'not_member'; end if;
  if v_role not in ('owner', 'moderator') then return 'not_allowed'; end if;

  -- Only the owner may toggle visibility
  if p_visibility is not null and v_role <> 'owner' then
    return 'not_allowed';
  end if;

  if p_visibility is not null and p_visibility not in ('public', 'private') then
    return 'bad_visibility';
  end if;

  update public.circle_communities c
  set
    name        = coalesce(btrim(p_name), c.name),
    description = coalesce(btrim(p_description), c.description),
    visibility  = coalesce(p_visibility, c.visibility),
    rules       = coalesce(
      (select array_agg(left(btrim(r), 200)) from unnest(p_rules) r where btrim(r) <> ''),
      c.rules
    ),
    updated_at  = now()
  where c.id = p_community;

  return 'ok';
end;
$$;

revoke all on function public.circle_update_community from public;
grant execute on function public.circle_update_community to authenticated;
