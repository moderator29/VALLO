import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { JOB_DESCRIPTIONS, STAFF_POSITIONS } from "./staff-positions";
import { staffAccessGranted } from "../email/staff-messages";

/**
 * The position list and each position's default scopes live twice: in SQL
 * (`private.staff_position_title`, `private.staff_position_scopes`) and here.
 * This reads the newest definition so the two cannot drift. Since 10
 * November 2026 that is the pending file (step 2 of the staff roles) that
 * repeats every earlier position and adds Marketing Manager, Content Manager,
 * Technical Administrator and Customer Support Lead, so it is the whole list.
 */
const MIGRATION = fileURLToPath(
  new URL(
    "../../../../../supabase/migrations/pending/staff_roles_step2_2026-11-10.sql",
    import.meta.url,
  ),
);
const sql = readFileSync(MIGRATION, "utf8");

function sqlBundles(): Map<string, string[]> {
  const body = sql.slice(sql.indexOf("function private.staff_position_scopes"));
  const bundles = new Map<string, string[]>();
  for (const m of body.matchAll(/when '([a-z_]+)' then array\[([^\]]*)\]/g)) {
    const key = m[1]!;
    if (bundles.has(key)) continue;
    bundles.set(key, [...m[2]!.matchAll(/'([a-z_]+)'/g)].map((x) => x[1]!));
  }
  return bundles;
}

function sqlTitles(): Map<string, string> {
  const body = sql.slice(sql.indexOf("function private.staff_position_title"), sql.indexOf("function private.staff_position_scopes"));
  return new Map([...body.matchAll(/when '([a-z_]+)' then '([^']+)'/g)].map((m) => [m[1]!, m[2]!]));
}

describe("staff positions", () => {
  it("names the same positions, titles and default scopes as the database", () => {
    const bundles = sqlBundles();
    const titles = sqlTitles();
    expect([...bundles.keys()].sort()).toEqual([...STAFF_POSITIONS].sort());
    for (const position of STAFF_POSITIONS) {
      expect(titles.get(position), position).toBe(JOB_DESCRIPTIONS[position].title);
      expect([...(bundles.get(position) ?? [])].sort(), position).toEqual([...JOB_DESCRIPTIONS[position].scopes].sort());
    }
  });

  it("allows exactly these positions in the grants check constraint", () => {
    const check = sql.slice(sql.indexOf("staff_grants_position_known check"), sql.indexOf("create or replace function"));
    const allowed = [...check.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
    expect(allowed).toEqual([...STAFF_POSITIONS].sort());
  });

  it("gives every position a real description", () => {
    for (const position of STAFF_POSITIONS) {
      const job = JOB_DESCRIPTIONS[position];
      expect(job.summary.length, position).toBeGreaterThan(40);
      expect(job.responsibilities.length, position).toBeGreaterThanOrEqual(3);
      expect(job.expectations.length, position).toBeGreaterThanOrEqual(3);
      expect(job.escalate.length, position).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("the staff access email", () => {
  it("names the position and links its description when one was granted", () => {
    const mail = staffAccessGranted({ name: "Ada", scopeWords: "Reports and moderation", position: "moderator" });
    expect(mail.subject).toContain("Moderator");
    expect(mail.text).toContain("Moderator");
    expect(mail.text).toContain("/admin/handbook/position");
    expect(mail.text).toContain(JOB_DESCRIPTIONS.moderator.responsibilities[0]!.slice(0, 30));
  });

  it("still reads correctly without a position", () => {
    const mail = staffAccessGranted({ name: "Ada", scopeWords: "Support" });
    expect(mail.subject).toBe("You have Vallo staff access");
    expect(mail.text).not.toContain("/admin/handbook/position");
    expect(mail.text.toLowerCase()).not.toContain("wallet");
  });
});
