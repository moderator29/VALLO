-- Caps a message body at 4,000 characters in the database itself, so a direct
-- request with the public key cannot store a multi-megabyte message. The app
-- already stops at 2,000 (lib/messages/schema.ts); this is the backstop.
-- NOT VALID checks every new or changed row without scanning the old ones.
alter table public.messages
  add constraint messages_body_len_chk check (char_length(body) <= 4000) not valid;
