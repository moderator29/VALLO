import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * UI-01: the 14px control radius on anything 27px tall or less is a capsule,
 * and a numeral in a circle is round text. Small text badges take the extra
 * small radius; numbered discs are rounded squares.
 */
const src = (p: string) => readFileSync(join(process.cwd(), "src", p), "utf8");

describe("small text never sits in a capsule", () => {
  it("the Agent Mode badge, the admin count badges and the wizard's photo badge", () => {
    expect(src("components/agent/AgentNav.tsx")).toContain("gap-xs rounded-[var(--nf-radius-xs)] px-sm py-2xs");
    for (const file of ["app/admin/reference/ReferenceEditors.tsx", "app/admin/social/page.tsx"]) {
      expect(src(file), file).not.toContain("rounded-[var(--nf-radius-control)] border");
    }
    expect(src("components/agent/ApplyWizard.tsx")).not.toMatch(/gap-2xs rounded-\[var\(--nf-radius-control\)\] bg-/);
  });

  it("numbered steps are rounded squares, not circles", () => {
    expect(src("components/agent/ApplyWizard.tsx")).not.toMatch(/h-8 w-8 place-items-center rounded-full/);
    expect(src("app/(app)/listing/[id]/RentalPanel.tsx")).not.toMatch(/h-6 w-6 shrink-0 place-items-center rounded-full/);
  });
});
