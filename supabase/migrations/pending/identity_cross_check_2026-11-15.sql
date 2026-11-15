-- ============================================================================
-- CHECK THIS FILE AGAINST THE LIVE SCHEMA BEFORE ANYONE RUNS IT. IT WAS
-- WRITTEN FROM THE MIGRATIONS IN THE REPOSITORY (15 NOVEMBER 2026), NOT FROM
-- THE LIVE DATABASE. READ, ON LIVE, FIRST:
--   select to_regclass('public.kyc_document_fingerprints');     -- expect null
--   select to_regclass('public.kyc_id_number_marks');           -- expect null
--   select to_regclass('public.agent_documents');               -- expect the table
--   select data_type from information_schema.columns
--    where table_schema = 'public' and table_name = 'agent_documents' and column_name = 'id';
--                                                                -- expect uuid
-- IF ANY ANSWER DIFFERS, STOP AND TELL THE LEAD. NOT APPLIED. ONLY THE FOUNDER
-- APPLIES IT, IN THE SUPABASE SQL EDITOR.
-- ============================================================================
--
-- IDENTITY CROSS-CHECKS ON THE VERIFICATION DESK (15 November 2026).
--
-- THE MEASURED NEED. A reviewer asked how to tell a forged ID from a real one
-- without taking the member's information outside Vallo. There is no free
-- public place to look a NIN or a BVN up, and the paid identity checks are
-- switched off. What Vallo can do for nothing, inside the admin panel, is
-- notice when the SAME ID NUMBER, the SAME FILE or a VERY SIMILAR PICTURE
-- turns up on a second account. That needs somewhere to keep a fingerprint of
-- each document and of each number. This file is those two tables and nothing
-- else.
--
-- WHAT THIS DOES.
--   public.kyc_document_fingerprints   one row per verification file (the
--       front or the back of a document): the SHA-256 of the file, a 64-bit
--       picture hash for an ID or a selfie (16 hex characters; null for a
--       file that is not a readable picture), its size, the document's kind
--       and whose it is. Written by the server (service role) the first time
--       a reviewer opens the person on the verification desk, and compared
--       with the rows of everybody opened before. NO PICTURE, NO PATH AND NO
--       NAME is in it: a fingerprint cannot be turned back into a document.
--   public.kyc_id_number_marks         one row per identity document whose
--       number a reviewer typed in: the kind of number and its HMAC-SHA256
--       under the server-held key (the same key and, for a NIN or a BVN, the
--       same hash as identity_verifications.nin_hmac and bvn_hmac). THE
--       NUMBER ITSELF IS NEVER STORED, here or anywhere.
--   RLS ON BOTH, NO POLICY, NO GRANT to anon or authenticated. Only the
--   service role reads or writes them, behind the kyc_review door in the
--   application (apps/web/src/lib/identity/cross-check/actions.ts).
--
-- WHAT THIS DOES NOT DO.
--   - It changes no existing table, column, function, policy or grant.
--   - It backfills nothing. Documents decided before this ran are compared
--     only once a reviewer opens that person again.
--   - It decides nothing. A match is shown to a reviewer, who escalates.
--   - Until it is applied the desk says "Not available yet" for the same
--     file and the similar picture, still compares a typed NIN or BVN with
--     the hashes already in identity_verifications and identity_checks, and
--     every other cross-check works. Nothing breaks.
--
-- ERASURE. Both tables hang off public.agent_documents with ON DELETE
-- CASCADE, and off auth.users the same way. The account purge deletes a
-- person's agent_documents rows, so their fingerprints and number marks go
-- in the same statement.
--
-- SAFE TO RUN TWICE: create table if not exists, create index if not exists,
-- enable row level security is idempotent, revoke and grant are idempotent,
-- comment on replaces.
--
-- SELF-CHECK at the foot, after the commit: it raises an exception unless
-- both tables exist with RLS on and no policy, anon and authenticated hold no
-- privilege on either, the service role can select, insert, update and delete
-- on both, and each delete cascade is in place. A failed check undoes
-- nothing: stop and tell the lead. A clean run ends with the notice
--   identity_cross_check_2026-11-15: self-check passed

begin;

set local lock_timeout = '5s';

create table if not exists public.kyc_document_fingerprints (
  document_id uuid not null references public.agent_documents(id) on delete cascade,
  side        text not null check (side in ('front', 'back')),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  kind        text not null check (length(kind) between 1 and 40),
  sha256      text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  dhash       text check (dhash is null or dhash ~ '^[0-9a-f]{16}$'),
  byte_size   integer not null check (byte_size > 0),
  created_at  timestamptz not null default now(),
  primary key (document_id, side)
);

create index if not exists kyc_document_fingerprints_sha256_idx
  on public.kyc_document_fingerprints (sha256);
create index if not exists kyc_document_fingerprints_owner_idx
  on public.kyc_document_fingerprints (owner_id);
create index if not exists kyc_document_fingerprints_pictures_idx
  on public.kyc_document_fingerprints (kind, created_at desc) where dhash is not null;

alter table public.kyc_document_fingerprints enable row level security;
revoke all on table public.kyc_document_fingerprints from public, anon, authenticated;
grant select, insert, update, delete on table public.kyc_document_fingerprints to service_role;

comment on table public.kyc_document_fingerprints is
  'Identity cross-checks (15 Nov 2026). One row per verification file: its SHA-256, a 64-bit picture hash for an ID or selfie, its size, the document kind and its owner. Lets the verification desk notice the same file or a very similar picture on a second account without downloading anybody else''s document. No picture, path or name. Service role only.';
comment on column public.kyc_document_fingerprints.dhash is
  'The 64-bit difference hash of the picture as 16 hex characters (the hash lib/photo-hash uses for listing photographs). Null for a file that is not a readable picture.';

create table if not exists public.kyc_id_number_marks (
  document_id uuid primary key references public.agent_documents(id) on delete cascade,
  owner_id    uuid not null references auth.users(id) on delete cascade,
  id_type     text not null check (id_type in ('nin', 'bvn', 'passport', 'drivers_licence', 'voters_card')),
  number_hmac text not null check (number_hmac ~ '^[0-9a-f]{64}$'),
  recorded_by uuid references auth.users(id) on delete set null,
  recorded_at timestamptz not null default now()
);

create index if not exists kyc_id_number_marks_hmac_idx
  on public.kyc_id_number_marks (number_hmac);
create index if not exists kyc_id_number_marks_owner_idx
  on public.kyc_id_number_marks (owner_id);

alter table public.kyc_id_number_marks enable row level security;
revoke all on table public.kyc_id_number_marks from public, anon, authenticated;
grant select, insert, update, delete on table public.kyc_id_number_marks to service_role;

comment on table public.kyc_id_number_marks is
  'Identity cross-checks (15 Nov 2026). The keyed hash of the number a reviewer typed from an identity document, so the same number on a second account is recognised. HMAC-SHA256 under the server-held key; the number itself is never stored. Service role only.';
comment on column public.kyc_id_number_marks.number_hmac is
  'HMAC-SHA256, hex. For a NIN or BVN it is the same hash as identity_verifications.nin_hmac and bvn_hmac; other documents are hashed with their kind as a prefix, so two kinds never collide.';

commit;

-- --------------------------------------------------------------- SELF-CHECK
-- Asks each role by name with has_table_privilege (never
-- information_schema's grant views, which answer only about the observing
-- role). Raises on the first thing that is not as intended.
do $check$
declare
  t text;
  r text;
  p text;
begin
  foreach t in array array['kyc_document_fingerprints', 'kyc_id_number_marks'] loop
    if to_regclass('public.' || t) is null then
      raise exception 'identity_cross_check_2026-11-15: table public.% is missing', t;
    end if;
    if not (select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
             where n.nspname = 'public' and c.relname = t) then
      raise exception 'identity_cross_check_2026-11-15: row level security is off on public.%', t;
    end if;
    if exists (select 1 from pg_policies where schemaname = 'public' and tablename = t) then
      raise exception 'identity_cross_check_2026-11-15: public.% has a policy; it is meant to have none', t;
    end if;
    foreach r in array array['anon', 'authenticated'] loop
      foreach p in array array['select', 'insert', 'update', 'delete'] loop
        if has_table_privilege(r, 'public.' || t, p) then
          raise exception 'identity_cross_check_2026-11-15: % can % on public.%', r, p, t;
        end if;
      end loop;
    end loop;
    foreach p in array array['select', 'insert', 'update', 'delete'] loop
      if not has_table_privilege('service_role', 'public.' || t, p) then
        raise exception 'identity_cross_check_2026-11-15: service_role cannot % on public.%', p, t;
      end if;
    end loop;
    /* Each table goes when its document goes, and when its owner goes. */
    if (select count(*) from pg_constraint
         where conrelid = ('public.' || t)::regclass and contype = 'f' and confdeltype = 'c'
           and confrelid in ('public.agent_documents'::regclass, 'auth.users'::regclass)) < 2 then
      raise exception 'identity_cross_check_2026-11-15: public.% is missing a delete cascade', t;
    end if;
  end loop;
  raise notice 'identity_cross_check_2026-11-15: self-check passed';
end;
$check$;

-- After the first reviewer opens a person on the verification desk, expect
-- rows here (counts only; nothing personal is selected):
-- select kind, side, count(*), count(dhash) as with_picture_hash
--   from public.kyc_document_fingerprints group by kind, side order by kind, side;
-- select id_type, count(*) from public.kyc_id_number_marks group by id_type;
