import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * THE "NEEDS YOU" STACK DRAWS ONE CARD PER ROW, NEVER A CARD INSIDE A CARD
 * (the founder's bug of 7 November 2026, refs/bug-notifications-stack.png).
 * A bundle opened in the front card ("2 new messages") holds rows of its own;
 * a descendant selector made each of those a second frosted card with its own
 * edge, shadow and glow, laid over the first. Every stack rule now reaches
 * only the list's direct items.
 */
const css = readFileSync(join(process.cwd(), "src/app/(app)/notifications/notifications.css"), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

describe("the needs-you stack", () => {
  it("styles only the list's direct items as cards", () => {
    const selectors = [...css.matchAll(/([^{}]+)\{/g)]
      .map((m) => (m[1] ?? "").replace(/\s+/g, " ").trim())
      .filter((sel) => sel.includes("nf-notif__group--stack") && sel.includes("nf-list-item"));
    expect(selectors.length).toBeGreaterThan(8);
    for (const sel of selectors) {
      for (const part of sel.split(",")) {
        if (!part.includes("nf-list-item")) continue;
        expect(part, part).toMatch(/\.nf-list-group > \.nf-list-item/);
      }
    }
  });

  it("keeps the warm glow off the rows of an opened bundle", () => {
    expect(css).toMatch(/\.nf-list-row__lead:not\(\.nf-notif__bundle \*\)::before/);
  });
});
