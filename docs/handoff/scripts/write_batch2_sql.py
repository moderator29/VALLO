"""Write supabase/migrations/pending/institutions_logos_batch2_2026-11-10.sql and the logo manifest.
usage: python3 -I write_batch2_sql.py man_final.json emails.json seed.json more.json outdir
Only logos whose file exists in apps/web/public/schools and domains confirmed by confirm_email_domains.py."""
import json, os, re, sys
man = json.load(open(sys.argv[1])); em = json.load(open(sys.argv[2]))
schools = {s["slug"]: s for s in json.load(open(sys.argv[3])) + json.load(open(sys.argv[4]))}
out = sys.argv[5]
WEB = "/home/user/VALLO/apps/web/public/schools"
BASE = "https://www.vallospaces.com/schools/"
q = lambda s: "'" + s.replace("'", "''") + "'"
kept = sorted((r for r in man if r["decision"] == "kept" and os.path.exists(f"{WEB}/{r['slug']}.webp")), key=lambda r: r["slug"])
assert all(r["slug"] in schools for r in kept)
doms = sorted((r for r in em if r["domain"] and re.fullmatch(r"[a-z0-9-]+(\.[a-z0-9-]+)*\.(edu\.ng|edu)", r["domain"])), key=lambda r: r["slug"])
doms = [r for r in doms if not schools[r["slug"]].get("email_domains")]
logo_vals = ",\n".join(f"  ({q(r['slug'])}, {q(BASE + r['slug'] + '.webp')}, {q(r['page'])})" for r in kept)
dom_vals = ",\n".join(f"  ({q(r['slug'])}, {q(r['domain'])})" for r in doms)
n_logo, n_dom = len(kept), len(doms)
sql = f"""-- VALLO ROOMMATES: SCHOOL LOGOS, BATCH 2, AND CONFIRMED EMAIL DOMAINS (10 November 2026).
--
-- DEPENDS ON institutions_logos_and_aliases_2026-11-10.sql (the logo_url, logo_source and
-- aliases columns; already live) and on the school rows from roommates_5, the full list and
-- roommates_schools_more. Not run against live or a local copy. Additive and safe to run twice.
--
-- 1. {n_logo} logos. Each was taken from the school's OWN website (the logo image in the page
--    header, else a clearly logo-named og:image, else its apple-touch-icon or favicon), only
--    from a page whose title or text names the school, then reviewed by eye on contact sheets
--    (photographs, generic site icons, another body's mark and illegible marks were dropped;
--    a picture found for several schools was dropped for all of them). Each was converted to a
--    160 x 160 WebP (under 13 KB) and is served from this app's own origin:
--    apps/web/public/schools/<slug>.webp, so logo_url is https://www.vallospaces.com/schools/<slug>.webp
--    and logo_source is the school page it came from. Nothing is hotlinked from the school.
--    A logo is set where logo_url is null, and also where it still holds the earlier
--    upload.wikimedia.org link (the hosted copy replaces the hotlink). A logo a staff member
--    set to anything else is never overwritten.
--    LICENSING: a school's logo is its trademark. Showing it to identify the school in a picker
--    is ordinary use, but hosting a copy is a step beyond linking to it. The founder should
--    decide whether to keep the copies, and can remove any one by setting logo_url to null and
--    deleting its file. The manifest of what was fetched, from where, and what was rejected is
--    docs/handoff/scripts/school_logos_manifest.json.
-- 2. {n_dom} email domains, each confirmed from the school's own site: its home page was fetched on
--    10 November 2026 and names the school, the site's domain is a .edu.ng or .edu name (a
--    subdomain counts: a student address like name@live.school.edu.ng fits school.edu.ng), and
--    any addresses printed on the page or its contact page are on that same domain. Only rows
--    whose email_domains is empty are touched, and the check is switched on only with a domain.

update public.institutions i
   set logo_url = v.logo_url, logo_source = v.logo_source
  from (values
{logo_vals}
  ) as v(slug, logo_url, logo_source)
 where i.slug = v.slug
   and (i.logo_url is null or i.logo_url like 'https://upload.wikimedia.org/%');

update public.institutions i
   set email_domains = array[v.domain], email_verify_on = true
  from (values
{dom_vals}
  ) as v(slug, domain)
 where i.slug = v.slug and cardinality(i.email_domains) = 0;

do $check$
declare
  bad int;
begin
  select count(*) into bad from public.institutions where logo_url is not null and logo_url not like 'https://%';
  if bad > 0 then
    raise exception 'logo_url must be https: % rows are not', bad;
  end if;
  select count(*) into bad from public.institutions where email_verify_on and cardinality(email_domains) = 0;
  if bad > 0 then
    raise exception 'email check on without a domain: % rows', bad;
  end if;
  select count(*) into bad from public.institutions where logo_url like 'https://www.vallospaces.com/schools/%';
  if bad < {int(n_logo * 0.9)} then
    raise exception 'batch 2 logos missing: only % rows carry a hosted logo, expected about {n_logo}', bad;
  end if;
end
$check$;
"""
open(out + "/institutions_logos_batch2_2026-11-10.sql", "w").write(sql)
manifest = [dict(slug=r["slug"], kind=r.get("kind"), name=r.get("name"), source_page=r.get("page"), image_url=r.get("image"), bytes=r.get("bytes", 0), how=r.get("how"), decision=r["decision"]) for r in sorted(man, key=lambda r: (r.get("kind", ""), r["slug"]))]
json.dump(dict(generated="2026-11-10", note="A school's own site was the source; copies are 160px WebP in apps/web/public/schools. kept = in the SQL.", logos=manifest, email_domains=em), open("/home/user/VALLO/docs/handoff/scripts/school_logos_manifest.json", "w"), indent=1, ensure_ascii=False)
print(n_logo, "logos;", n_dom, "domains")
