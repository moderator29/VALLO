import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { contentSecurityPolicy } from "@/lib/security/csp";

/**
 * THE SCHOOLS DIRECTORY SQL, READ AS TEXT (10 November 2026). The files are
 * pending (not applied), so these checks are what stands between a typo and the
 * founder pasting it: column counts, no duplicate slug or name, ISO state codes,
 * kinds from the table's check, https-only logo addresses, and a Content
 * Security Policy that lets every logo host draw.
 */
const PENDING = join(__dirname, "..", "..", "..", "..", "..", "..", "supabase", "migrations", "pending");
const FILES = {
  first: "roommates_5_institutions.sql",
  full: "roommates_schools_full_list_2026-11-10.sql",
  more: "roommates_schools_more_2026-11-10.sql",
  logos: "institutions_logos_and_aliases_2026-11-10.sql",
};
const have = Object.values(FILES).every((f) => existsSync(join(PENDING, f)));
const read = (f: string) => readFileSync(join(PENDING, f), "utf8");

const STATES = "AB AD AK AN BA BY BE BO CR DE EB ED EK EN GO IM JI KD KN KT KE KO KW LA NA NI OG ON OS OY PL RI SO TA YO ZA FC".split(" ");
const KINDS = ["university", "polytechnic", "college", "other"];
const lit = String.raw`(null|'(?:[^']|'')*')`;
const ROW = new RegExp(String.raw`^\s*\('((?:[^']|'')+)', '((?:[^']|'')+)', ${lit}, '(\w+)', '(\w+)', ${lit}, '\{([^}]*)\}', (true|false)\)`, "gm");
type Row = { slug: string; name: string; short: string | null; kind: string; state: string; city: string | null; domains: string[]; verify: boolean };
const unq = (s: string) => (s === "null" ? null : s.slice(1, -1).replace(/''/g, "'"));
function rows(sql: string): Row[] {
  return [...sql.matchAll(ROW)].map((m) => ({ slug: m[1]!, name: m[2]!.replace(/''/g, "'"), short: unq(m[3]!), kind: m[4]!, state: m[5]!, city: unq(m[6]!), domains: m[7]!.split(",").filter(Boolean), verify: m[8] === "true" }));
}
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");

describe.skipIf(!have)("the schools directory SQL", () => {
  const first = have ? rows(read(FILES.first)) : [];
  const full = have ? rows(read(FILES.full)) : [];
  const more = have ? rows(read(FILES.more)) : [];
  const all = [...first, ...full, ...more];

  it("parses every row of every file (column count: eight values per row)", () => {
    for (const f of [FILES.first, FILES.full, FILES.more]) {
      const sql = read(f);
      const tuples = (sql.match(/^\s*\('[a-z0-9-]+', /gm) ?? []).length;
      expect(rows(sql).length, f).toBe(tuples);
    }
    expect(first).toHaveLength(55);
    expect(full).toHaveLength(490);
    expect(more.length).toBeGreaterThan(150);
  });

  it("has no duplicate slug, name, or short name within a state, across all files", () => {
    const slugs = new Set<string>();
    const names = new Set<string>();
    const shorts = new Set<string>();
    for (const r of all) {
      expect(slugs.has(r.slug), `slug ${r.slug}`).toBe(false);
      slugs.add(r.slug);
      expect(names.has(fold(r.name)), `name ${r.name}`).toBe(false);
      names.add(fold(r.name));
      if (r.short) {
        const k = `${fold(r.short)}|${r.state}`;
        expect(shorts.has(k), `short ${r.short} ${r.state}`).toBe(false);
        shorts.add(k);
      }
    }
  });

  it("uses the table's slug, name, short name and city limits, ISO state codes and allowed kinds", () => {
    for (const r of more) {
      expect(r.slug).toMatch(/^[a-z0-9-]{2,80}$/);
      expect(r.name.length).toBeGreaterThanOrEqual(3);
      expect(r.name.length).toBeLessThanOrEqual(140);
      expect(STATES).toContain(r.state);
      expect(KINDS).toContain(r.kind);
      if (r.short) expect(r.short.length).toBeLessThanOrEqual(30);
      if (r.city) expect(r.city.length).toBeLessThanOrEqual(80);
    }
    expect(more.some((r) => r.state === "KE")).toBe(true);
  });

  it("switches a school's email check on only with a domain, and never guesses one", () => {
    for (const r of more) {
      expect(r.verify, r.slug).toBe(r.domains.length > 0);
      for (const d of r.domains) expect(d).toMatch(/^[a-z0-9.-]+\.[a-z]{2,}$/);
    }
  });

  it("is additive: on conflict do nothing, no update, delete or drop of rows", () => {
    const sql = read(FILES.more);
    expect(sql).toMatch(/on conflict \(slug\) do nothing/);
    expect(sql).not.toMatch(/^\s*(delete|drop|truncate)\b/im);
    expect(sql.replace(/--[^\n]*/g, "")).not.toMatch(/\bupdate\s+public\./i);
  });

  describe("the logos and aliases file", () => {
    const sql = have ? read(FILES.logos) : "";
    const known = new Set(all.map((r) => r.slug));
    const logoBlock = sql.slice(sql.indexOf("set logo_url = v.logo_url"), sql.indexOf("as v(slug, logo_url, logo_source)"));
    const tuples = [...logoBlock.matchAll(/^\s*\('([^']+)', '([^']+)', '([^']+)'\)/gm)].map((m) => ({ slug: m[1]!, url: m[2]!, source: m[3]! }));

    it("adds the three columns with https and length checks, safely twice", () => {
      expect(sql).toMatch(/add column if not exists logo_url text check \(logo_url is null or \(logo_url like 'https:\/\/%'/);
      expect(sql).toMatch(/add column if not exists logo_source text check/);
      expect(sql).toMatch(/add column if not exists aliases text\[\] not null default '\{\}'/);
      expect(sql).toMatch(/where i\.slug = v\.slug and i\.logo_url is null/);
    });
    it("sets logos by one update from a values list, with https addresses on a known slug", () => {
      expect(tuples.length).toBeGreaterThan(15);
      expect((sql.match(/^update public\.institutions/gm) ?? []).length).toBe(2);
      const seen = new Set<string>();
      for (const t of tuples) {
        expect(known.has(t.slug), t.slug).toBe(true);
        expect(seen.has(t.slug), `duplicate logo row ${t.slug}`).toBe(false);
        seen.add(t.slug);
        expect(t.url).toMatch(/^https:\/\/upload\.wikimedia\.org\/[^\s']+$/);
        expect(t.url).not.toContain("?");
        expect(t.source).toMatch(/^https:\/\/(en\.wikipedia\.org|commons\.wikimedia\.org)\/wiki\/File:/);
      }
    });
    it("names real aliases for the schools people shorten", () => {
      for (const a of ["OAU Ife", "Unilag Akoka", "FUTA Akure", "Poly Ibadan", "'Ife'", "'Ibadan'"]) expect(sql).toContain(a);
    });
    it("replaces the institution card function with the same signature and adds logoUrl", () => {
      expect(sql).toMatch(/create or replace function private\.rm_institution\(p_id uuid\)/);
      expect(sql).toContain("'logoUrl', i.logo_url");
    });
    it("runs after the three seed files and says so", () => {
      expect(sql).toMatch(/DEPENDS ON/);
      for (const f of [FILES.first, FILES.full, FILES.more]) expect(sql).toContain(f);
    });
    it("every logo host is allowed by img-src, and only by img-src", () => {
      const hosts = new Set(tuples.map((t) => new URL(t.url).origin));
      expect(hosts.size).toBeGreaterThan(0);
      const policy = contentSecurityPolicy("TESTNONCE");
      const directive = (name: string) => policy.split(";").map((d) => d.trim()).find((d) => d.startsWith(name + " ")) ?? "";
      for (const h of hosts) {
        expect(directive("img-src"), h).toContain(h);
        for (const other of ["script-src", "connect-src", "default-src", "frame-src"]) expect(directive(other), `${other} ${h}`).not.toContain(h);
      }
      expect(/(^|\s)https:(\s|$)/.test(directive("img-src"))).toBe(false);
    });
  });
});
