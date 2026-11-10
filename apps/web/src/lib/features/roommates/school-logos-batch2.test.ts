import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * THE HOSTED SCHOOL LOGOS AND THE EMAIL DOMAINS IN BATCH 2 (10 November 2026), read as text.
 * Every logo the SQL names is a file in public/schools, small, a real WebP, and addressed on this
 * app's own origin over https, once per school; every confirmed domain is a .edu.ng or .edu name.
 */
const ROOT = join(__dirname, "..", "..", "..", "..", "..", "..");
const SQL_FILE = join(ROOT, "supabase", "migrations", "pending", "institutions_logos_batch2_2026-11-10.sql");
const PUBLIC_SCHOOLS = join(ROOT, "apps", "web", "public", "schools");
const have = existsSync(SQL_FILE);
const sql = have ? readFileSync(SQL_FILE, "utf8") : "";

const logos = [...sql.matchAll(/^\s*\('([a-z0-9-]+)', '(https:\/\/[^']+)', '(https:\/\/[^']+)'\)/gm)].map((m) => ({ slug: m[1]!, url: m[2]!, source: m[3]! }));
const domains = [...sql.matchAll(/^\s*\('([a-z0-9-]+)', '([a-z0-9.-]+)'\)/gm)].map((m) => ({ slug: m[1]!, domain: m[2]! }));

describe.skipIf(!have)("batch 2 school logos and domains", () => {
  it("names a good number of logos and sets them by one update from a values list", () => {
    expect(logos.length).toBeGreaterThan(100);
    expect((sql.match(/^update public\.institutions/gm) ?? []).length).toBe(2);
    expect(sql).toMatch(/i\.logo_url is null or i\.logo_url like 'https:\/\/upload\.wikimedia\.org\/%'/);
    expect(sql).toMatch(/cardinality\(i\.email_domains\) = 0/);
  });
  it("uses https, this app's origin, and one logo per school", () => {
    const seen = new Set<string>();
    const urls = new Set<string>();
    for (const l of logos) {
      expect(l.url).toBe(`https://www.vallospaces.com/schools/${l.slug}.webp`);
      expect(seen.has(l.slug), `duplicate ${l.slug}`).toBe(false);
      seen.add(l.slug);
      urls.add(l.url);
      expect(l.source.startsWith("https://")).toBe(true);
      expect(l.url.length).toBeLessThanOrEqual(500);
    }
    expect(urls.size).toBe(logos.length);
  });
  it("every logo is a file in public/schools, under 20 KB, and a real WebP", () => {
    for (const l of logos) {
      const file = join(PUBLIC_SCHOOLS, `${l.slug}.webp`);
      expect(existsSync(file), l.slug).toBe(true);
      expect(statSync(file).size, l.slug).toBeLessThan(20 * 1024);
      const head = readFileSync(file).subarray(0, 12);
      expect(head.subarray(0, 4).toString("ascii"), l.slug).toBe("RIFF");
      expect(head.subarray(8, 12).toString("ascii"), l.slug).toBe("WEBP");
    }
  });
  it("leaves no unreferenced logo file behind", () => {
    const { readdirSync } = require("node:fs") as typeof import("node:fs");
    const named = new Set(logos.map((l) => `${l.slug}.webp`));
    for (const f of readdirSync(PUBLIC_SCHOOLS)) expect(named.has(f), `orphan ${f}`).toBe(true);
  });
  it("confirms only .edu.ng or .edu domains, once per school, and switches the check on with them", () => {
    const seen = new Set<string>();
    for (const d of domains) {
      expect(d.domain).toMatch(/^[a-z0-9-]+(\.[a-z0-9-]+)*\.(edu\.ng|edu)$/);
      expect(seen.has(d.slug), `duplicate ${d.slug}`).toBe(false);
      seen.add(d.slug);
    }
    expect(sql).toContain("set email_domains = array[v.domain], email_verify_on = true");
  });
  it("ends with a self-check and is registered in the README as not applied", () => {
    expect(sql).toMatch(/do \$check\$/);
    const readme = readFileSync(join(ROOT, "supabase", "migrations", "pending", "README.md"), "utf8");
    expect(readme).toMatch(/institutions_logos_batch2_2026-11-10\.sql[^\n]*NOT APPLIED/);
  });
});
