import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ARRANGEMENT_STATUSES, ARRANGEMENT_STEPS, deliveryWindowDays, stepAllowed, valloStateFor } from "./arrangement-states";

/* The newest definition of private.provider_arrangement_step_ok. Since 10
   November 2026 that is the rail preparation in the pending folder (two new
   states, refund_requested and requires_review); when the founder applies it
   and it moves into supabase/migrations, point this at the applied file. */
const MIGRATION = readFileSync(
  fileURLToPath(new URL("../../../../../supabase/migrations/pending/protected_rail_prep_2026-11-10.sql", import.meta.url)),
  "utf8",
);

/** The `when 'x' then p_to in (...)` rows of private.provider_arrangement_step_ok. */
function sqlSteps(): Record<string, string[]> {
  const body = MIGRATION.slice(MIGRATION.indexOf("provider_arrangement_step_ok(p_from text"));
  const steps: Record<string, string[]> = {};
  for (const m of body.slice(0, body.indexOf("end\n$function$")).matchAll(/when '([a-z_]+)' then p_to in \(([^)]*)\)/g)) {
    steps[m[1]!] = [...m[2]!.matchAll(/'([a-z_]+)'/g)].map((x) => x[1]!);
  }
  return steps;
}

describe("arrangement states (D73 Part B)", () => {
  it("the step table is the twin of private.provider_arrangement_step_ok", () => {
    const sql = sqlSteps();
    for (const from of ARRANGEMENT_STATUSES) {
      expect([...(sql[from] ?? [])].sort(), from).toEqual([...ARRANGEMENT_STEPS[from]].sort());
    }
  });

  it("every status in the table is one the database allows", () => {
    for (const s of ARRANGEMENT_STATUSES) expect(MIGRATION).toContain(`'${s}'`);
  });

  it("nothing leaves a final state, and a release is never undone", () => {
    expect(stepAllowed("released", "protected")).toBe(false);
    expect(stepAllowed("refunded", "released")).toBe(false);
    expect(stepAllowed("protected", "awaiting_payment")).toBe(false);
    expect(stepAllowed("awaiting_payment", "protected")).toBe(true);
    expect(stepAllowed("disputed", "split")).toBe(true);
  });

  it("maps the provider's state and status onto Vallo's", () => {
    expect(valloStateFor("AWAITING_PAYMENT", "PENDING")).toBe("awaiting_payment");
    expect(valloStateFor("OPENED", "ONGOING")).toBe("protected");
    expect(valloStateFor("OPENED", "INVESTIGATING")).toBe("disputed");
    expect(valloStateFor("CLOSED", "COMPLETED")).toBe("released");
    expect(valloStateFor("CLOSED", "CLAIMED")).toBe("released");
    expect(valloStateFor("CLOSED", "REFUNDED")).toBe("refunded");
    expect(valloStateFor("closed", "split")).toBe("split");
    // A pair the docs do not describe moves nothing.
    expect(valloStateFor("CLOSED", "ONGOING")).toBeNull();
    expect(valloStateFor("", "")).toBeNull();
  });

  it("bounds the provider's claim clock by the move-in date plus the claim window", () => {
    expect(deliveryWindowDays("2026-10-17", "2026-10-07")).toBe(13);
    expect(deliveryWindowDays("2026-10-01", "2026-10-07")).toBe(3);
    expect(deliveryWindowDays("2027-12-01", "2026-10-07")).toBeNull();
    expect(deliveryWindowDays(null, "2026-10-07")).toBeNull();
    expect(deliveryWindowDays("17/10/2026", "2026-10-07")).toBeNull();
  });
});
