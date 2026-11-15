import { describe, expect, it } from "vitest";
import { unbackedClaim } from "@/lib/trust/claims";
import { JOB_DESCRIPTIONS, STAFF_POSITIONS } from "@/lib/admin/staff-positions";

describe("job descriptions", () => {
  it("claims", () => {
    const found: string[] = [];
    for (const p of STAFF_POSITIONS) {
      const j = JOB_DESCRIPTIONS[p];
      const text = [j.title, j.summary, j.reportsTo, ...j.responsibilities, ...j.expectations, ...j.escalate].join(" ");
      const c = unbackedClaim(text);
      if (c) found.push(`${p}: ${c}`);
    }
    expect(found).toEqual([]);
  });
});
