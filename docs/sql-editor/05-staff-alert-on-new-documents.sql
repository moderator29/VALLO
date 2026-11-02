-- Run in the Supabase SQL editor (2 November 2026). New verification
-- documents tell the people who review them, once per person per submission
-- (a statement-level trigger: the ID, the selfie and the address filed
-- together are one message, not three). The connector stopped for approval
-- on the DROP TRIGGER line, which is why this is a file.
--
-- (The desk fix that was part 1 of this file is applied: migration
-- 20261102223038_manual_kyc_3_desk_decisions_cast.)
set lock_timeout = '5s';

create or replace function private.announce_kyc_documents()
returns trigger
language plpgsql
security definer
set search_path to ''
as $fn$
declare
  who uuid;
begin
  begin
    for who in
      select distinct coalesce(n.uploader_id,
               (select a.user_id from public.agent_applications a where a.id = n.application_id))
        from added n
       where n.kind in ('identity', 'selfie', 'address', 'business')
         and n.review_status = 'pending'
    loop
      if who is not null then
        perform private.tell_scope('kyc_review', 'Someone is waiting to be verified',
          'New ID documents were sent. Open the verification desk to review them.', '/admin/kyc',
          array[who]);
      end if;
    end loop;
  exception when others then
    raise warning 'announce_kyc_documents: %', sqlerrm;
  end;
  return null;
end;
$fn$;
revoke all on function private.announce_kyc_documents() from public, anon, authenticated;

drop trigger if exists zz_announce_kyc_documents on public.agent_documents;
create trigger zz_announce_kyc_documents after insert on public.agent_documents
  referencing new table as added
  for each statement execute function private.announce_kyc_documents();
