import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LEAD_COUNT, LEAD_STEP_MS } from "./lead";

const css = readFileSync(join(process.cwd(), "src/app/css/feed-m.css"), "utf8");
const tokens = readFileSync(join(process.cwd(), "../../packages/design-tokens/src/tokens.css"), "utf8");

/** The feed's motion sheet keeps the rules the motion system sets (MOTION_SYSTEM section 1 and 2). */
describe("feed-m.css", () => {
  it("loops nothing: only the aurora and the assistant's thinking may", () => {
    expect(css).not.toMatch(/animation[^;]*\binfinite\b/);
  });

  it("staggers by the same step the TypeScript says", () => {
    /* The step is the shared token now (MOTION_SYSTEM section 0), so the
       token's value is what must agree with the TypeScript, and the cap is
       the last lead index. */
    expect(css).toContain("calc(min(var(--nf-i, 0), var(--nf-stagger-cap)) * var(--nf-stagger))");
    expect(tokens).toMatch(new RegExp(`--nf-stagger:\\s*${LEAD_STEP_MS}ms;`));
    expect(tokens).toMatch(new RegExp(`--nf-stagger-cap:\\s*${LEAD_COUNT - 1};`));
  });

  it("pops the heart and the repost only on the tap that turns them on", () => {
    /* The like pops its whole capsule (D72, reference 2); the repost turns
       its glyph. Both keyed on `data-pop`, which only the tap sets. */
    expect(css).toContain(".nf-act-pill--like[data-pop] {");
    expect(css).toContain(".nf-act-pill--repost[data-pop] svg");
    /* An already-liked post must not throw its heart as the feed loads. */
    expect(css).not.toMatch(/\[aria-pressed="true"\]\s*svg\s*\{\s*animation/);
  });

  it("moves only transform and opacity (translate, scale, rotate count as transform)", () => {
    /* Each @keyframes block, found by brace depth so a nested frame is not cut short. */
    const bodies: string[] = [];
    for (const start of css.matchAll(/@keyframes\s+[\w-]+\s*\{/g)) {
      let depth = 1;
      let i = (start.index ?? 0) + start[0].length;
      const from = i;
      while (depth > 0 && i < css.length) {
        if (css[i] === "{") depth += 1;
        else if (css[i] === "}") depth -= 1;
        i += 1;
      }
      bodies.push(css.slice(from, i - 1));
    }
    expect(bodies.length).toBeGreaterThan(5);
    for (const body of bodies) {
      for (const decl of body.matchAll(/([a-z-]+)\s*:\s*[^;{}]+;/g)) {
        expect(["opacity", "translate", "scale", "rotate", "transform"]).toContain(decl[1]);
      }
    }
  });
});
