"""Write supabase/migrations/pending/roommates_schools_more_2026-11-10.sql and
institutions_logos_and_aliases_2026-11-10.sql from the pieces build_schools_sql.py checked.

usage: python3 -I write_pending_sql.py piecesdir counts.json outdir
"""
import json, sys
from collections import Counter

d, counts, out = sys.argv[1], json.load(open(sys.argv[2])), sys.argv[3]
more_rows = open(d + "/_more_rows.sql").read()
logo_vals = open(d + "/_logo_values.sql").read()
alias_vals = open(d + "/_alias_values.sql").read()
n = counts["more"]; by = counts["by_kind"]; nlogo = counts["logos"]; nalias = counts["aliases"]
need = 545 + n - 10

more = f"""-- VALLO ROOMMATES: MORE SCHOOLS (10 November 2026).
--
-- Adds {n} institutions to public.institutions that the first directory left out:
-- {by.get('college', 0)} colleges (nursing and midwifery colleges, private colleges of education),
-- {by.get('polytechnic', 0)} polytechnics (private polytechnics the first list could not place),
-- {by.get('other', 0)} schools of nursing and midwifery, {by.get('university', 0)} universities
-- (the Wikipedia-only ones the NUC page does not list).
--
-- DEPENDS ON roommates_5_institutions.sql AND roommates_schools_full_list_2026-11-10.sql
-- being applied first (it skips any slug they already created, and the final check
-- counts their rows too). Not run against live or a local copy.
--
-- Sources, all read on 10 November 2026:
--   Nursing and midwifery: Nursing and Midwifery Council of Nigeria, "Updated list of
--   approved colleges of nursing and departments of nursing with their accreditation
--   status, December 2025" (nmcn.gov.ng/docs/New_List_of_Approved_Schools_Dec_2025.pdf).
--   Schools with accreditation withdrawn, departments inside a university, and entries
--   whose name could not be read cleanly from the PDF layout were left out.
--   Private polytechnics and private colleges of education: Wikipedia, List of
--   polytechnics in Nigeria and List of colleges of education in Nigeria (private
--   colleges table), the rows the first list could not place.
--   Universities: Wikipedia, List of universities in Nigeria.
--   NBTE (nbte.gov.ng) and NCCE (ncceonline.edu.ng) were tried: the NBTE institution
--   list page is not published and the NCCE site is not reachable from our network, so
--   neither could be a name list.
--
-- Rules as before: additive, on conflict (slug) do nothing, so staff edits and earlier
-- rows are never overwritten; safe to run twice. State codes follow public.states
-- (Kebbi is KE). kind is only from the table's check (university, polytechnic, college,
-- other). short_name is null because no acronym students use was confirmed. Email
-- domains are empty and email_verify_on false except where the school's own home page
-- was fetched on 10 November 2026 and named the school (see
-- docs/handoff/SCHOOLS_DIRECTORY_SOURCES.md). Everything was checked by script for
-- duplicate slugs, names and (short name, state) against all 545 earlier rows.

insert into public.institutions (slug, name, short_name, kind, state_code, city, email_domains, email_verify_on) values
{more_rows}
on conflict (slug) do nothing;

do $check$
declare
  have int;
begin
  select count(*) into have from public.institutions;
  -- 545 earlier rows plus {n} here; allow 10 for rows staff removed or renamed.
  if have < {need} then
    raise exception 'more schools incomplete: % rows, expected at least {need}', have;
  end if;
end
$check$;
"""

logos = f"""-- VALLO ROOMMATES: SCHOOL LOGOS AND SEARCH ALIASES (10 November 2026).
--
-- DEPENDS ON roommates_5_institutions.sql, roommates_schools_full_list_2026-11-10.sql and
-- roommates_schools_more_2026-11-10.sql being applied first (logos and aliases are set by
-- slug, so a school that is not there yet is simply skipped, and a later run fills it).
-- Not run against live or a local copy. Additive and safe to run twice.
--
-- 1. Three new columns on public.institutions: logo_url, logo_source, aliases.
--    The table's grants (select to anon and authenticated, staff-only write through
--    RLS, roommates_1_core.sql) are table level, so the new columns are readable exactly
--    like the existing ones and no grant changes.
-- 2. {nlogo} logos, found on the English Wikipedia article for each school (the file
--    its page uses for the logo, seal or crest), recorded as a 128px thumbnail on
--    upload.wikimedia.org and the file's description page as logo_source. Each address
--    was fetched on 10 November 2026 and answered HTTP 200 with an image content type.
--    Schools with no verified logo keep logo_url null and the app draws a neutral
--    school icon. Never overwrites a logo staff set (where logo_url is null).
--    LICENSING: a school's logo is its trademark. Recording the address to identify the
--    school in a picker is ordinary use, but many of these files are non-free and hosted
--    on en.wikipedia, not Commons, with their own file page terms. The founder should
--    review licensing, and may prefer to copy the files into a Vallo storage bucket and
--    repoint logo_url (the app's image policy already trusts the Vallo bucket).
-- 3. {nalias} schools get aliases people type ('OAU Ife', 'Unilag Akoka', 'FUTA Akure',
--    'Poly Ibadan', 'Ife', 'Ibadan'). Existing aliases are kept; new ones are added.
-- 4. private.rm_institution (the small institution object inside roommate and room
--    cards) is replaced with create or replace to add logoUrl; same signature, so its
--    grants stay.

alter table public.institutions
  add column if not exists logo_url text check (logo_url is null or (logo_url like 'https://%' and char_length(logo_url) <= 500)),
  add column if not exists logo_source text check (logo_source is null or (logo_source like 'https://%' and char_length(logo_source) <= 500)),
  add column if not exists aliases text[] not null default '{{}}' check (cardinality(aliases) <= 20);

create or replace function private.rm_institution(p_id uuid)
returns jsonb language sql stable security definer set search_path to '' as $$
  select jsonb_build_object('id', i.id, 'slug', i.slug, 'name', i.name, 'shortName', i.short_name, 'kind', i.kind, 'stateCode', i.state_code, 'city', i.city, 'logoUrl', i.logo_url)
    from public.institutions i where i.id = p_id;
$$;

update public.institutions i
   set logo_url = v.logo_url, logo_source = v.logo_source
  from (values
{logo_vals}
  ) as v(slug, logo_url, logo_source)
 where i.slug = v.slug and i.logo_url is null;

update public.institutions i
   set aliases = (select coalesce(array_agg(distinct a), '{{}}') from unnest(i.aliases || v.aliases) as a)
  from (values
{alias_vals}
  ) as v(slug, aliases)
 where i.slug = v.slug and not (i.aliases @> v.aliases);

do $check$
declare
  bad int;
begin
  select count(*) into bad from public.institutions where logo_url is not null and logo_url not like 'https://%';
  if bad > 0 then
    raise exception 'logo_url must be https: % rows are not', bad;
  end if;
end
$check$;
"""
open(out + "/roommates_schools_more_2026-11-10.sql", "w").write(more)
open(out + "/institutions_logos_and_aliases_2026-11-10.sql", "w").write(logos)
print("written")
