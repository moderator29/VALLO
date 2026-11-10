import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * THE PENDING MIGRATION, READ AS TEXT. It is not applied anywhere, so this
 * holds the properties that matter to the file itself.
 */
const sql = readFileSync(join(process.cwd(), "..", "..", "supabase", "migrations", "pending", "staff_weekly_reports_2026-11-10.sql"), "utf8");
const code = sql
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n");

describe("staff_weekly_reports_2026-11-10.sql", () => {
  it("never pairs NOT NULL with ON DELETE SET NULL on a user reference", () => {
    for (const line of code.split("\n")) {
      if (/references\s+auth\.users/i.test(line) && /on delete set null/i.test(line)) expect(line).not.toMatch(/not null/i);
    }
    expect(code).toMatch(/author_id\s+uuid references auth\.users \(id\) on delete set null,/);
    expect(code).toMatch(/reviewed_by\s+uuid references auth\.users \(id\) on delete set null,/);
    // The only NOT NULL-free user columns: no constraint may force either to stay non-null.
    expect(code).not.toMatch(/author_id is not null/i);
    expect(code).not.toMatch(/reviewed_by is not null/i);
  });

  it("is additive and safe to run twice", () => {
    expect(code).not.toMatch(/\bdrop\s+(table|column|schema)\b/i);
    expect(code).not.toMatch(/\balter\s+table\b.*\bdrop\b/i);
    expect(code).toMatch(/create table if not exists public\.staff_weekly_reports/);
    expect(code).toMatch(/create unique index if not exists/);
    expect(code).toMatch(/create or replace function/);
    expect(code).toMatch(/on conflict \(id\) do nothing/);
    expect((code.match(/create policy/g) ?? []).length).toBe((code.match(/drop policy if exists/g) ?? []).length);
  });

  it("makes the week a Monday and one report per person per week", () => {
    expect(code).toMatch(/extract\(isodow from week_start\) = 1/);
    expect(code).toMatch(/\(author_id, week_start\)/);
    expect(code).toMatch(/status in\s*\('draft', 'submitted', 'reviewed', 'reopened'\)/);
  });

  it("guards with the admin role shape and never calls staff_can in a policy", () => {
    expect(code).toMatch(/private\.has_role\(\(select auth\.uid\(\)\), 'admin'::public\.app_role\)/);
    expect(code).toMatch(/private\.has_role\(\(select auth\.uid\(\)\), 'super_admin'::public\.app_role\)/);
    expect(code).not.toMatch(/staff_can/);
  });

  it("creates a private bucket with no storage.objects policy, and checks itself", () => {
    expect(code).toMatch(/'staff-report-proofs', 'staff-report-proofs', false/);
    expect(code).not.toMatch(/storage\.objects/);
    expect(code).toMatch(/do \$check\$/);
    expect(code).toMatch(/notify pgrst, 'reload schema'/);
  });
});
