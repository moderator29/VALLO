import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * WHAT THE THREE REGISTRATION FORMS FILE, THE DESK READS (22 November 2026).
 *
 * A firm that chose "have your principal confirm you" filed the principal's
 * address and the desk never selected it, so the reviewer had nobody to write
 * to; the office address, LASRERA number and declared team were missing the
 * same way. This holds every column `rowFor` writes to the columns the
 * applications desk selects, and the firm's answers to the section that
 * draws them.
 */
const SRC = join(__dirname, "..", "..");
const read = (path: string) => readFileSync(join(SRC, path), "utf8");

/* Written for the record or the machinery, not for a reviewer to read. */
const NOT_FOR_THE_DESK = new Set(["user_id", "consents"]);

function writtenColumns(): string[] {
  const source = read("lib/supply/registration-actions.ts");
  const body = source.slice(source.indexOf("function rowFor("), source.indexOf("async function tellThem("));
  const keys = new Set<string>();
  for (const match of body.matchAll(/^\s+([a-z_]+):/gm)) keys.add(match[1]!);
  return [...keys].filter((key) => key.includes("_") || ["email", "status", "type", "phone", "city", "area"].includes(key));
}

describe("the applications desk reads what the registration forms file", () => {
  const selected = read("lib/admin/queries.ts").match(/const APPLICATION_COLUMNS =\s*"([^"]+)"/)?.[1] ?? "";

  it("finds the columns on both sides", () => {
    expect(selected.length).toBeGreaterThan(100);
    expect(writtenColumns()).toEqual(expect.arrayContaining(["principal_email", "firm_team", "ownership_document", "agency_fee_bps"]));
  });

  it.each(writtenColumns().filter((c) => !NOT_FOR_THE_DESK.has(c)))("selects %s", (column) => {
    expect(selected.split(/[\s,()]+/)).toContain(column);
  });

  it("draws the firm's route, the principal's address, the office and the team", () => {
    const page = read("app/admin/agents/page.tsx");
    const firm = page.slice(page.indexOf('role === "firm" ?'));
    for (const field of ["application.businessAddress", "application.lasreraNumber", "application.associationProof", "application.principalEmail", "application.firmTeam"]) {
      expect(firm).toContain(field);
    }
  });
});
