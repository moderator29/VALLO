import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { listingStatItems } from "./format";

/**
 * THE EXAMPLE GATE AND THE SQL'S SHAPE (founder, 13 November 2026).
 *
 * An example listing must never show a stats row and never be counted: the
 * component returns before any read, the page mounts the beacon only for a
 * real listing, and every SQL path that counts or reads a listing filters
 * `is_demo`. The pending file is also held to the rules the brief set: safe to
 * run twice, definer functions with a fixed search path, the recorder for the
 * server alone, no address column anywhere.
 */
const WEB = join(__dirname, "..", "..", "..");
const SQL = readFileSync(join(WEB, "..", "..", "..", "supabase", "migrations", "pending", "listing_stats_2026-11-13.sql"), "utf8");
const PAGE = readFileSync(join(WEB, "app", "(app)", "listing", "[id]", "page.tsx"), "utf8");
const COMPONENT = readFileSync(join(WEB, "components", "app", "listing", "ListingStats.tsx"), "utf8");

/** The body of one `create or replace function` statement. */
function fn(name: string): string {
  const start = SQL.indexOf(`create or replace function ${name}(`);
  expect(start, name).toBeGreaterThan(-1);
  const open = SQL.indexOf("$$", start);
  return SQL.slice(start, SQL.indexOf("$$;", open + 2));
}

describe("an example listing never shows the row", () => {
  it("returns nothing and reads nothing for an example", () => {
    /* The component returns before its read; the pure rule refuses an example too. */
    const gate = COMPONENT.indexOf("if (isDemo) return null;");
    expect(gate).toBeGreaterThan(-1);
    expect(gate).toBeLessThan(COMPONENT.indexOf("await readListingStats("));
    expect(listingStatItems({ isDemo: true, publishedAt: null, figures: { views: 9, saves: 2 }, now: new Date() })).toBeNull();
  });

  it("is mounted on the listing page with the listing's own example flag, and the beacon only for a real one", () => {
    expect(PAGE).toMatch(/<ListingStats listingId=\{listing\.id\} isDemo=\{listing\.isDemo\}/);
    expect(PAGE).toContain("{!listing.isDemo && <ListingViewBeacon listingId={listing.id} />}");
    /* Inside its own Suspense, so the page never waits for the read. */
    expect(PAGE).toMatch(/<Suspense fallback=\{null\}>\s*<ListingStats /);
  });

  it("filters examples in every SQL path that counts or reads a listing", () => {
    for (const name of [
      "public.record_listing_view",
      "public.listing_public_stats",
      "public.listing_public_stats_many",
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
