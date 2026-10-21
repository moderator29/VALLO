-- APPLIED 21 October 2026 (written as a draft, read against the live definition first). THE MESSAGE SCANNER STOPS CALLING A PHONE NUMBER AN
-- ACCOUNT NUMBER.
--
-- Agent D audit, 17 October 2026. private.scan_message flags an account
-- number with substring(body from '\d{10}'), which matches the first ten
-- digits of any eleven-digit Nigerian mobile number (08012345678) and of a
-- +234 number, so every phone number shared in a chat lands in the admin
-- flag queue as "Account number shared". The flag queue is how staff see
-- account numbers and payment talk (Terms, messaging rules); a queue full of
-- phone numbers hides the real ones. The fix keeps every other line and
-- matches ten digits with no digit on either side, and substring() with a
-- capture group returns the ten digits alone, so the masked value is
-- unchanged.
--
-- Body: the newest definition, 20260923235821_content_scanner_on_every_surface.sql
-- section 9. BEFORE APPLYING: compare with
--   select pg_get_functiondef('private.scan_message()'::regprocedure);
-- Probe: supabase/tests/probes-pending/scan-message-phone.sql.
set lock_timeout = '5s';

create or replace function private.scan_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  keyword_pattern constant text := '(payment|transfer|pay me|account number|acct|bank)';
  digits          text;
  v               record;
begin
  -- Ten digits standing alone. An eleven-digit Nigerian phone number
  -- (080...) or a +234 number holds a ten-digit run inside it, and the old
  -- pattern flagged every shared phone number as an account number. The
  -- app's own finder (lib/messages/account-moment.ts) refuses phones too.
  digits := substring(new.body from '(?:^|[^0-9])([0-9]{10})(?:[^0-9]|$)');
  if digits is not null then
    insert into public.message_flags (message_id, reason, matched)
    values (new.id, 'account_number', repeat('•', 6) || right(digits, 4));
  end if;
  if new.body ~* keyword_pattern then
    insert into public.message_flags (message_id, reason, matched)
    values (new.id, 'payment_keyword', substring(lower(new.body) from keyword_pattern));
  end if;

  v := private.content_verdict(new.body);
  if v.verdict <> 'clean' then
    perform private.open_content_alert(v.severity,
      case when v.verdict = 'hold' then 'Abuse in a message' else 'Watched phrase in a message' end,
      'A direct message matched the objectionable content list (' || v.category || '). Read the conversation.',
      'message', new.id::text);
  end if;
  return new;
end;
$fn$;
