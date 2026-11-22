import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * EVERY SCREEN WAITS ONLY FOR THE FIELDS IT DRAWS (22 November 2026).
 *
 * Agents could not get past "About you": screen one's Continue waited for an
 * 11-digit NIN whose box is on screen two, so it stayed greyed out with
 * nothing on the screen to fill. This reads each form's `blocked()` and
 * checks the screen-one rule names no field that screen does not draw.
 */
const read = (name: string) => readFileSync(join(__dirname, name), "utf8");

function screenOneRule(source: string): string {
  const match = source.match(/if \(step === 0\) return ([^;]*);/);
  if (!match?.[1]) throw new Error("no screen-one rule found");
  return match[1];
}

describe("registration screens wait only for their own fields", () => {
  it("the agent's first screen does not wait for the NIN, the second does", () => {
    const source = read("AgentRegisterForm.tsx");
    expect(screenOneRule(source)).not.toMatch(/\bnin\b/);
    expect(source).toMatch(/if \(step === 1\) return !\/\^\\d\{11\}\$\/\.test\(nin\.trim\(\)\);/);
  });

  it("the owner's NIN box is on the first screen, where its rule is", () => {
    const source = read("OwnerRegisterForm.tsx");
    expect(screenOneRule(source)).toMatch(/\bnin\b/);
    const ninBox = source.indexOf("setNin(e.target.value");
    const screenTwo = source.indexOf("heading: own.where.title");
    expect(ninBox).toBeGreaterThan(0);
    expect(ninBox).toBeLessThan(screenTwo);
  });
});
