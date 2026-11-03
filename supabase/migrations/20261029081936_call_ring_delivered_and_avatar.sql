/* WHAT THE CALLER SEES WHILE THE OTHER PERSON'S PHONE RINGS (29 October 2026,
   the founder: "make it show calling when the person is not online and
   ringing when the person is, like WhatsApp").

   "Ringing" used to mean only that the server had written a ringing row. Now
   it means the callee's own app has the call on screen: the client tells the
   server so through call_ring_delivered, which stamps the callee's
   participant row once. The caller's snapshot reports it as other_ringing;
   until then the caller reads "Calling". The same snapshot now carries the
   other person's profile photo (other_avatar_url, the public URL the
   messages screen already uses), and the missed-call notice names the
   caller in its title and links with ?missed=<call> so a push can be
   drawn quietly and collapse on its own tag. */
set lock_timeout = '5s';

alter table public.call_participants add column if not exists ring_delivered_at timestamptz;

create or replace function public.call_ring_delivered(p_call uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  n integer;
begin
  if me is null then raise exception 'call:signed_out' using errcode = '42501'; end if;
  update public.call_participants p
     set ring_delivered_at = now()
   where p.call_id = p_call and p.user_id = me
     and p.role in ('CALLEE', 'SUBJECT')
     and p.state in ('INVITED', 'RINGING')
     and p.ring_delivered_at is null
     and exists (select 1 from public.calls c where c.id = p.call_id and c.state = 'RINGING');
  get diagnostics n = row_count;
  if n > 0 then
    /* The caller's open screen listens to this row, so it hears at once. */
    update public.calls set version = version + 1, updated_at = now()
     where id = p_call and state = 'RINGING';
  end if;
end;
$$;
revoke all on function public.call_ring_delivered(uuid) from public, anon;
grant execute on function public.call_ring_delivered(uuid) to authenticated;

create or replace function private.call_snapshot(p_call uuid, p_viewer uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select jsonb_build_object(
    'id', c.id,
    'kind', c.kind,
    'purpose', c.purpose,
    'state', c.state,
    'version', c.version,
    'conversation_id', c.conversation_id,
    'review_id', c.review_id,
    'role', me.role,
    'my_state', me.state,
    'is_initiator', c.initiator_id = p_viewer,
    'other_name', case when c.purpose = 'ADMIN_REVIEW' and me.role = 'SUBJECT' then 'Vallo review team'
                       else private.call_person_name(other.user_id) end,
    'other_avatar_url', case when c.purpose = 'ADMIN_REVIEW' and me.role = 'SUBJECT' then null
                             else (select nullif(btrim(pr.avatar_url), '') from public.profiles pr where pr.id = other.user_id) end,
    'other_state', other.state,
    'other_ringing', coalesce(other.ring_delivered_at is not null and c.state = 'RINGING', false),
    'scheduled_for', c.scheduled_for,
    'created_at', c.created_at,
    'ringing_at', c.ringing_at,
    'ring_expires_at', c.ring_expires_at,
    'accepted_at', c.accepted_at,
    'connected_at', c.connected_at,
    'interrupted_at', c.interrupted_at,
    'ended_at', c.ended_at,
    'end_reason', c.end_reason,
    'duration_seconds', c.duration_seconds,
    'server_now', now())
  from public.calls c
  left join public.call_participants me on me.call_id = c.id and me.user_id = p_viewer
  left join lateral (
    select p.user_id, p.state, p.ring_delivered_at from public.call_participants p
     where p.call_id = c.id and p.user_id <> p_viewer
     order by p.invited_at limit 1) other on true
  where c.id = p_call;
$function$;

create or replace function private.call_on_terminal(p_call uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  c public.calls;
  callee uuid;
  words text;
  marker text;
  mins integer;
  secs integer;
begin
  select * into c from public.calls where id = p_call;

  -- Everybody still in the room leaves with the call; their time is counted.
  update public.call_participants p
     set connected_seconds = p.connected_seconds
           + greatest(0, floor(extract(epoch from (c.ended_at - p.joined_at))))::integer,
         state = 'LEFT',
         left_at = c.ended_at
   where p.call_id = c.id and p.state = 'JOINED' and p.joined_at is not null;

  -- Anybody who never answered missed it.
  update public.call_participants p
     set state = 'MISSED'
   where p.call_id = c.id and p.state in ('INVITED', 'RINGING')
     and c.state in ('MISSED', 'BUSY', 'CANCELLED', 'EXPIRED', 'FAILED');

  update public.calls
     set participant_seconds = (select coalesce(sum(p.connected_seconds), 0)
                                  from public.call_participants p where p.call_id = c.id)
   where id = c.id;

  select p.user_id into callee
    from public.call_participants p
   where p.call_id = c.id and p.role in ('CALLEE', 'SUBJECT')
   limit 1;

  words := private.call_kind_words(c.kind);

  -- The marker in the conversation. Best effort: a refused marker (a message
  -- limit, a block written a second ago) never undoes the call's own ending.
  if c.purpose = 'CONVERSATION' and c.conversation_id is not null and c.initiator_id is not null then
    if c.state = 'ENDED' and c.connected_at is not null and c.duration_seconds is not null then
      mins := c.duration_seconds / 60;
      secs := c.duration_seconds % 60;
      marker := upper(left(words, 1)) || substr(words, 2) || ', '
        || case when mins > 0 then mins::text || ' min ' else '' end || secs::text || ' s';
    else
      marker := upper(left(words, 1)) || substr(words, 2) || ', ' || case c.state
        when 'ENDED' then 'ended'
        when 'DECLINED' then 'declined'
        when 'CANCELLED' then 'cancelled'
        when 'MISSED' then 'missed'
        when 'BUSY' then 'missed (busy)'
        when 'FAILED' then 'could not connect'
        when 'EXPIRED' then 'expired'
        else lower(c.state) end;
    end if;
    begin
      insert into public.messages (conversation_id, sender_id, body, call_id)
      values (c.conversation_id, c.initiator_id, marker, c.id)
      on conflict do nothing;
    exception when others then
      insert into public.call_events (call_id, source, event, detail)
      values (c.id, 'system', 'marker.skipped', jsonb_build_object('sqlstate', sqlstate));
    end;
  end if;

  -- The person who was called hears about a call they did not take. The push
  -- is quiet (no ring) and names the caller; ?missed= marks it for the push
  -- policy and still opens the thread.
  if callee is not null and c.state in ('MISSED', 'BUSY')
     or (callee is not null and c.state = 'CANCELLED' and c.ringing_at is not null) then
    perform private.notify(callee,
      case when c.purpose = 'ADMIN_REVIEW' then 'system'::public.notification_kind else 'message'::public.notification_kind end,
      case when c.purpose = 'ADMIN_REVIEW' then 'Missed ' || words
           else 'Missed ' || words || ' from ' || private.call_person_name(c.initiator_id) end,
      case when c.purpose = 'ADMIN_REVIEW' then 'The Vallo review team tried to call you.'
           else 'Tap to open the chat and call back.' end,
      private.call_href(c.id, callee, false)
        || case when c.purpose = 'CONVERSATION' then '?missed=' || c.id::text else '' end);
  end if;

  -- A review call that ended hands the review back for an outcome.
  if c.purpose = 'ADMIN_REVIEW' and c.review_id is not null then
    update public.call_reviews r
       set status = 'ACCEPTED', updated_at = now()
     where r.id = c.review_id and r.status = 'IN_CALL';
    insert into public.call_review_entries (review_id, author_id, kind, body)
    select c.review_id, null, 'ATTENDANCE',
           format('Call %s: %s. Subject joined: %s. Connected for %s s.',
                  left(c.id::text, 8), lower(c.state),
                  case when exists (select 1 from public.call_participants p
                                     where p.call_id = c.id and p.role = 'SUBJECT' and p.first_joined_at is not null)
                       then 'yes' else 'no' end,
                  coalesce(c.duration_seconds, 0));
  end if;
end;
$function$;
