import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The welcome screen receives only the dictionary sections it reads
 * (app/welcome/page.tsx, welcomeWords). If one of its components starts
 * reading another section, this fails before the screen shows a blank.
 */
const SRC = join(__dirname, "..", "..");
const PASSED = new Set(["common", "interests", "onboardingMotion", "shape", "welcomeCards", "signUp", "platform"]);
const FILES = ["components/app/welcome/FirstRun.tsx", "components/app/welcome/InterestChoices.tsx", "components/app/welcome/ArrivalAsks.tsx"];

describe("the welcome screen's words", () => {
  it("reads only the sections the page passes", () => {
    const read = new Set<string>();
    for (const file of FILES) {
      const source = readFileSync(join(SRC, file), "utf8");
      for (const m of source.matchAll(/\bt\.([a-zA-Z0-9]+)/g)) read.add(m[1]!);
    }
    expect([...read].filter((section) => !PASSED.has(section))).toEqual([]);
  });
  it("reads only the one key passed inside platform, shape and signUp", () => {
    const only: Record<string, string> = { platform: "lite", shape: "wall", signUp: "hearAbout" };
    for (const file of FILES) {
      const source = readFileSync(join(SRC, file), "utf8");
      for (const m of source.matchAll(/\bt\.(platform|shape|signUp)\.([a-zA-Z0-9]+)/g)) {
        expect(m[2]).toBe(only[m[1]!]);
      }
    }
  });
});
