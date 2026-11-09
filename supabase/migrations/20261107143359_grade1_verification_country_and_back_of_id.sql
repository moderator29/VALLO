-- PLATFORM GRADE 1 (P0.3, 7 November 2026): the verification flow asks which
-- country issued the ID, and photographs the back of a two-sided card. Both
-- additive and nullable: every existing row and every existing caller is
-- untouched. docs/identity/MANUAL_VERIFICATION.md.

-- An ID issued outside Nigeria that is neither a passport nor a driving licence.
alter type public.document_subtype add value if not exists 'national_id';

alter table public.agent_documents
  add column if not exists issuing_country text,
  add column if not exists back_storage_path text;

alter table public.agent_documents
  drop constraint if exists agent_documents_issuing_country_iso,
  add constraint agent_documents_issuing_country_iso
    check (issuing_country is null or issuing_country ~ '^[A-Z]{2}$'),
  drop constraint if exists agent_documents_back_only_identity,
  add constraint agent_documents_back_only_identity
    check (back_storage_path is null or (kind = 'identity' and char_length(back_storage_path) between 3 and 512));

comment on column public.agent_documents.issuing_country is
  'ISO 3166-1 alpha-2 code of the country that issued an identity document (Grade 1 verification).';
comment on column public.agent_documents.back_storage_path is
  'The back of a two-sided identity card, in the same private bucket and the uploader''s own folder.';

-- The back of the card is held to the same rule as the front: it is filed
-- from the uploader's own folder, or not at all.
create or replace function private.document_is_in_uploaders_folder()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  if split_part(coalesce(new.storage_path, ''), '/', 1) <> coalesce(new.uploader_id::text, '') then
    raise exception 'A document is filed from its uploader''s own folder.' using errcode = '42501';
  end if;
  if new.back_storage_path is not null
     and split_part(new.back_storage_path, '/', 1) <> coalesce(new.uploader_id::text, '') then
    raise exception 'A document is filed from its uploader''s own folder.' using errcode = '42501';
  end if;
  return new;
end;
$function$;
