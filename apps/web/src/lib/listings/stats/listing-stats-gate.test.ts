import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { listingPulse, listingStatItems } from "./format";

/**
 * EXAMPLES, AND THE SQL'S SHAPE (founder, 13 and 14 November 2026).
 *
 * 13 November: an example listing was never counted and never drawn. 14
 * November, after the founder saw no figure anywhere (every live listing was
 * an example): an example shows its views, saves and shares like any other,
 * because the people opening it are real, but never a time on Vallo, and the
 * Analytics desk still leaves examples out. So the page sends the view signal
 * for every listing, the recorders and the two public reads in
 * `listing_shares_2026-11-14.sql` do not filter `is_demo`, and the lister's
 * and the desk's functions in `listing_stats_2026-11-13.sql` still do. Both
 * pending files are held to the rules the brief set: safe to run twice,
 * definer functions with a fixed search path, the recorders for the server
 * alone, no address column anywhere.
 */
const WEB = join(__dirname, "..", "..", "..");
const SQL = readFileSync(join(WEB, "..", "..", "..", "supabase", "migrations", "pending", "listing_stats_2026-11-13.sql"), "utf8");
const SHARES_SQL = readFileSync(join(WEB, "..", "..", "..", "supabase", "migrations", "pending", "listing_shares_2026-11-14.sql"), "utf8");
const PAGE = readFileSync(join(WEB, "app", "(app)", "listing", "[id]", "page.tsx"), "utf8");
const COMPONENT = readFileSync(join(WEB, "components", "app", "listing", "ListingStats.tsx"), "utf8");

/** The body of one `create or replace function` statement. */
function fn(name: string): string {
  const start = SQL.indexOf(`create or replace function ${name}(`);
  expect(start, name).toBeGreaterThan(-1);
  const open = SQL.indexOf("$$", start);
  return SQL.slice(start, SQL.indexOf("$$;", open + 2));
}

/** The body of one function in the shares file, whichever way it is created. */
function sharesFn(name: string): string {
  const start = SHARES_SQL.search(new RegExp(`create (or replace )?function ${name.replace(".", "\\.")}\\(`));
  expect(start, name).toBeGreaterThan(-1);
  const open = SHARES_SQL.indexOf("$$", start);
  return SHARES_SQL.slice(start, SHARES_SQL.indexOf("$$;", open + 2));
}

describe("an example listing shows its counts, never a time on Vallo", () => {
  it("reads an example like any other, and leaves its age out", () => {
    expect(COMPONENT).not.toContain("if (isDemo) return null;");
    expect(COMPONENT).toMatch(/const days = isDemo \|\| !figures \? null : daysLive\(/);
    expect(listingStatItems({ isDemo: true, publishedAt: "2026-01-01T00:00:00Z", figures: { views: 9, saves: 2 }, now: new Date() })?.map((i) => i.key)).toEqual(["views", "saves"]);
    expect(listingPulse({ figures: { views: 9, saves: 2 } })?.map((t) => t.key)).toEqual(["views", "saves"]);
  });

  it("is mounted on the listing page with the listing's own example flag and rating, and the beacon for every listing", () => {
    expect(PAGE).toMatch(/<ListingStats listingId=\{listing\.id\} isDemo=\{listing\.isDemo\}/);
    expect(PAGE).toMatch(/<ListingStats [^>]*rating=\{listing\.rating\} reviewCount=\{listing\.reviewCount\}/);
    expect(PAGE).toContain("<ListingViewBeacon listingId={listing.id} />");
    expect(PAGE).not.toContain("!listing.isDemo && <ListingViewBeacon");
    /* Inside its own Suspense, so the page never waits for the read. */
    expect(PAGE).toMatch(/<Suspense fallback=\{null\}>\s*<ListingStats /);
  });

  it("still filters examples for the lister and the Analytics desk", () => {
    for (const name of [
      "public.my_listing_stats",
      "private.listing_counters_on_save",
      "private.listing_daily_on_enquiry",
      "private.listing_daily_on_viewing",
      "public.admin_listing_stats_daily",
      "public.admin_listing_stats_ranked",
    ]) {
      expect(fn(name), name).toMatch(/not l\.is_demo/);
    }
  });

  it("counts and answers an example in the shares file, and only a published listing", () => {
    for (const name of ["public.record_listing_view", "public.record_listing_share", "public.listing_public_stats", "public.listing_public_stats_many"]) {
      const body = sharesFn(name);
      expect(body, name).not.toMatch(/is_demo/);
      expect(body, name).toContain("l.status = 'PUBLISHED'");
      expect(body, name).toContain("security definer");
      expect(body, name).toContain("set search_path = ''");
    }
  });
});

describe("the shares SQL", () => {
  it("is one transaction, safe to run twice, and reads itself back", () => {
    expect(SHARES_SQL).toMatch(/\nbegin;\n/);
    expect(SHARES_SQL).toMatch(/\ncommit;\n/);
    expect(SHARES_SQL).not.toMatch(/add column (?!if not exists)/i);
    expect(SHARES_SQL).toContain("drop constraint if exists listing_view_marks_kind_check");
    for (const name of ["listing_public_stats(uuid)", "listing_public_stats_many(uuid[])"]) {
      expect(SHARES_SQL).toContain(`drop function if exists public.${name};`);
      expect(SHARES_SQL).toContain(`grant execute on function public.${name} to anon, authenticated, service_role;`);
    }
    expect(SHARES_SQL).toContain("has_function_privilege");
    expect(SHARES_SQL).toContain("has_table_privilege");
    expect(SHARES_SQL).toContain("raise exception 'probe_passed'");
    expect(SHARES_SQL).not.toMatch(/\bdelete from\b|\btruncate\b|\bdrop table\b/i);
    expect(SHARES_SQL).not.toContain("—");
  });

  it("keeps a share to one per person per listing per day, for the server alone, with no raw viewer", () => {
    const body = sharesFn("public.record_listing_share");
    expect(body).toContain("values (v_target, v_today, 's', v_who)");
    expect(body).toContain("on conflict do nothing");
    expect(body).toContain("extensions.hmac(");
    expect(body).toContain("private.listing_stats_internal(p_viewer)");
    expect(body).toMatch(/a\.user_id is distinct from p_viewer and aa\.user_id is distinct from p_viewer/);
    expect(SHARES_SQL).toContain("check (kind in ('i', 'o', 's'))");
    expect(SHARES_SQL).toContain("revoke execute on function public.record_listing_share(uuid, uuid, text) from public, anon, authenticated;");
    expect(SHARES_SQL).toContain("grant execute on function public.record_listing_share(uuid, uuid, text) to service_role;");
    expect(SHARES_SQL).not.toMatch(/\bip(_address)?\b\s+(text|inet)/i);
  });

  it("changes nothing in the view recorder but the example filter", () => {
    const squash = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, " ").trim();
    const before = squash(fn("public.record_listing_view")).replace(" and not l.is_demo", "");
    expect(squash(sharesFn("public.record_listing_view"))).toBe(before);
  });
});

describe("the pending SQL", () => {
  it("is safe to run twice", () => {
    expect(SQL).not.toMatch(/create table (?!if not exists)/i);
    expect(SQL).not.toMatch(/create index (?!if not exists)/i);
    expect(SQL).not.toMatch(/create function /i);
    expect(SQL).not.toMatch(/add column (?!if not exists)/i);
    for (const trigger of SQL.matchAll(/create trigger (\w+)/g)) {
      expect(SQL, trigger[1]).toContain(`drop trigger if exists ${trigger[1]} `);
    }
  });

  it("makes every function a definer with an empty search path", () => {
    const fns = [...SQL.matchAll(/create or replace function ([\w.]+)\(/g)].map((m) => m[1]!);
    expect(fns.length).toBeGreaterThanOrEqual(12);
    for (const name of fns) {
      const body = fn(name);
      expect(body, name).toContain("security definer");
      expect(body, name).toContain("set search_path = ''");
    }
  });

  it("gives the recorder to the server alone and the desk to no anonymous caller", () => {
    expect(SQL).toContain("revoke execute on function public.record_listing_view(uuid, uuid, text) from public, anon, authenticated;");
    expect(SQL).toContain("grant execute on function public.record_listing_view(uuid, uuid, text) to service_role;");
    expect(SQL).toMatch(/revoke execute on function public\.admin_listing_stats_daily\(integer, uuid\) from public, anon;/);
    expect(SQL).toContain("revoke all on public.listing_counters from public, anon, authenticated;");
    expect(SQL).toContain("has_function_privilege");
    expect(SQL).toContain("has_table_privilege");
  });

  it("stores no address and no raw viewer, and says it is unverified against live", () => {
    expect(SQL).not.toMatch(/\bip(_address)?\b\s+(text|inet)/i);
    expect(fn("public.record_listing_view")).toContain("extensions.hmac(");
    expect(SQL).toMatch(/UNVERIFIED AGAINST LIVE/);
    expect(SQL).not.toContain("—");
  });
});
