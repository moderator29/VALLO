import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * The learning path's classes once shared the `nf-path` prefix with the money
 * layer's step list (`money-layer.css`), whose `.nf-path__step` is a three
 * column grid. On the listing wizard that put every step's words into a 2.75rem
 * column and drew them one letter to a line (1 November 2026). The two must
 * never share a class name again.
 */
describe("the learning path owns its class names", () => {
  const here = (name: string) => readFileSync(join(__dirname, name), "utf8");
  const money = readFileSync(join(__dirname, "../../app/css/money-layer.css"), "utf8");

  it("draws only nf-ppath classes, none of which the money layer styles", () => {
    const tsx = here("ProgressPath.tsx");
    const used = [...tsx.matchAll(/nf-ppath[\w-]*/g)].map((m) => m[0]);
    expect(used.length).toBeGreaterThan(5);
    for (const name of new Set(used)) expect(money).not.toContain(`.${name}`);
    expect(tsx).not.toMatch(/"nf-path[\s_"]/);
  });

  it("styles the same classes it draws", () => {
    const css = here("progress-path.css");
    expect(css).toContain(".nf-ppath__step");
    expect(css).not.toMatch(/\.nf-path[\s_{:.]/);
  });
});
