import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * A GUIDE NEVER SHOWS A SCREEN THAT NO LONGER EXISTS (DOCS_AND_PRESENCE_UPGRADE.md
 * section 5). Every `/help/shots/<id>.webp` a page references must be a shot
 * the capture plan (scripts/marketing/capture/plan.mjs, GUIDES) still
 * produces, so a removed or renamed capture fails here instead of leaving a
 * guide pointing at a screen that is gone.
 */
const SRC = join(__dirname, "..", "..");
const PLAN = join(SRC, "..", "..", "..", "scripts", "marketing", "capture", "plan.mjs");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === "node_modules" ? [] : files(full);
    return /\.(ts|tsx|mdx?)$/.test(name) && !/\.test\./.test(name) ? [full] : [];
  });
}

describe("guide screenshots", () => {
  it("references only shots the capture plan still produces", async () => {
    const plan = (await import(pathToFileURL(PLAN).href)) as { GUIDE_SHOT_IDS: string[] };
    const known = new Set(plan.GUIDE_SHOT_IDS);
    expect(known.size).toBeGreaterThan(0);
    const missing: string[] = [];
    for (const file of files(SRC)) {
      for (const match of readFileSync(file, "utf8").matchAll(/\/help\/shots\/([a-z0-9-]+)\.webp/g)) {
        if (!known.has(match[1]!)) missing.push(`${file.slice(SRC.length + 1)}: ${match[1]}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("gives every guide shot a light twin and a guide that uses it", async () => {
    const plan = (await import(pathToFileURL(PLAN).href)) as { CAPTURES: { id: string; dest?: string; usedBy?: string }[] };
    const guides = plan.CAPTURES.filter((c) => c.dest === "guides");
    for (const c of guides) expect(c.usedBy, c.id).toBeTruthy();
    const ids = new Set(guides.map((c) => c.id));
    for (const c of guides) if (!c.id.endsWith("-lt") && !c.id.startsWith("d-")) expect(ids.has(`${c.id}-lt`), c.id).toBe(true);
  });
});
