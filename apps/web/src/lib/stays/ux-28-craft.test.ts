import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { stayDateLabel } from "./date-label";

/**
 * UX-28: small inconsistencies on flow screens. One back control on the
 * workspace chooser; checkout says the dates the way the stay page did; the
 * length rule is a sign-up rule, not a sign-in one.
 */
const src = (p: string) => readFileSync(join(process.cwd(), "src", p), "utf8");

describe("flow craft", () => {
  it("(a) the chooser draws no second back arrow", () => {
    const chooser = src("components/supply/AddWorkspaceChooser.tsx");
    expect(chooser).not.toContain("aria-label={copy.back}");
    /* The overview step offers "choose again" instead of a second back arrow.
       Since the StepFrame migration it is the frame's `secondary` action
       (`label: copy.chooseAgain`), not an inline `{copy.chooseAgain}` node. */
    expect(chooser).toContain("copy.chooseAgain");
  });

  it("(b) checkout shows 'Sat 10 Oct', not an ISO date", () => {
    expect(stayDateLabel("2026-10-10")).toBe("Sat 10 Oct");
    const checkout = src("app/(app)/checkout/page.tsx");
    expect(checkout).toContain("stayDateLabel(checkIn)");
    expect(checkout).toContain("stayDateLabel(checkOut)");
  });

  it("(c) sign-in does not apply the sign-up length rule", () => {
    const actions = src("lib/auth/actions.ts");
    expect(actions).toContain('validateCredentials(formData, w, "sign-in")');
    expect(actions).toContain('purpose === "sign-up" && password.length < 8');
  });
});
