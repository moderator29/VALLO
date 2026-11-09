import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  EXAMPLE_COLLECTION_RETIREMENT,
  daysUntilRetirement,
  isOverdue,
  retirementInstant,
} from "./retirement";

/**
 * THE ALARM ON THE EXAMPLE COLLECTION.
 *
 * Forty two properties that do not exist are in the catalogue because it was
 * otherwise empty. They are temporary. Everything about a temporary dataset
 * says it will still be here in two years unless something loud objects, so
 * this is the something.
 *
 * IF YOU ARE READING THIS BECAUSE THE BUILD WENT RED, here is what it means
 * and what to do.
 *
 *   The retirement date has passed and this tree still ships the example
 *   collection with nothing that removes it. That is not a broken test. It is
 *   the test doing the only job it has.
 *
 *   The fix is a migration that deletes the example rows, after which this
 *   spec finds it and goes quiet. `excludeDemo` on `ListingSearchFilter`
 *   hides them from every read in the meantime and is the right first move if
 *   the deletion needs a moment's thought.
 *
 *   Moving the date is allowed and deleting this spec is not. Change
 *   `EXAMPLE_COLLECTION_RETIREMENT`, change `listings.demo_retire_after` in a
 *   migration, and write in the migration header what changed about the world.
 *   A date that moves with a reason on record is a decision. A check deleted
 *   because it went red is how the collection becomes permanent.
 */

const MIGRATIONS = fileURLToPath(new URL("../../../../../supabase/migrations", import.meta.url));

/** Does the tree carry a migration that takes the example rows out? */
function retirementMigration(): string | null {
  for (const name of readdirSync(MIGRATIONS).sort()) {
    if (!name.endsWith(".sql")) continue;
    const sql = readFileSync(`${MIGRATIONS}/${name}`, "utf8").toLowerCase();
    if (/delete\s+from\s+public\.listings[\s\S]{0,200}is_demo/.test(sql)) return name;
  }
  return null;
}

describe("the example collection has a deletion date", () => {
  it("is a real date, written down, not a sentiment", () => {
    expect(EXAMPLE_COLLECTION_RETIREMENT).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Number.isNaN(retirementInstant().getTime())).toBe(false);
  });

  /**
   * The date in the code and the date on the rows have to be the same date, or
   * the alarm rings about something the database does not believe.
   * `listings.demo_retire_after` was stamped by the migration named here.
   */
  it("is the same date the migration wrote onto the rows", () => {
    /* The date was moved on 9 November 2026 (from 2026-11-07), so the write
       that now holds the truth is the extension migration, not the original
       applied one it supersedes (which stays immutable). The constant and the
       migration must still agree. */
    const migration = readFileSync(
      `${MIGRATIONS}/pending/example_collection_retirement_extended_to_2027-05-07.sql`,
      "utf8",
    );
    expect(migration).toContain(`date '${EXAMPLE_COLLECTION_RETIREMENT}'`);
    expect(migration).toContain("demo_retire_after");
  });

  it("counts down, and counts past zero once it is overdue", () => {
    const dayBefore = new Date(retirementInstant().getTime() - 86_400_000);
    const dayAfter = new Date(retirementInstant().getTime() + 86_400_000);

    expect(isOverdue(dayBefore)).toBe(false);
    expect(isOverdue(dayAfter)).toBe(true);
    expect(daysUntilRetirement(dayBefore)).toBe(1);
    expect(daysUntilRetirement(dayAfter)).toBe(-1);
  });
});

describe("and the collection comes down on it", () => {
  /**
   * THIS IS THE SPEC THAT FAILS. Read the block at the top of this file.
   */
  it("is not overdue, or has already been removed", () => {
    if (!isOverdue()) {
      expect(isOverdue()).toBe(false);
      return;
    }

    const removal = retirementMigration();
    expect(
      removal,
      `The example collection was due out on ${EXAMPLE_COLLECTION_RETIREMENT}, ` +
        `${Math.abs(daysUntilRetirement())} days ago, and no migration in this tree removes it. ` +
        "Forty two properties that do not exist are still published under Vallo's name. " +
        "Write the migration that deletes them, or move the date and say in that " +
        "migration's header what changed. Do not delete this spec.",
    ).not.toBeNull();
  });
});
