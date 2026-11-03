set lock_timeout = '5s';
alter table public.messages
  add constraint messages_body_len_chk check (char_length(body) <= 4000) not valid;
