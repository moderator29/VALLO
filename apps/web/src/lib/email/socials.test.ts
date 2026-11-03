import { describe, expect, it } from "vitest";
import { configuredSocials } from "./socials";
import { socialLinksText, socialRowHtml } from "./render";
import { sortEmailImages } from "./images";
import { liveSocials } from "@/lib/brand/socials";
import { existsSync } from "node:fs";
import { join } from "node:path";

describe("the social row in every email footer", () => {
  it("draws the same accounts as the site footer, one linked mark each", () => {
    const keys = configuredSocials().map((s) => s.key);
    expect(keys).toEqual(liveSocials().map((s) => s.key));
    expect(keys.length).toBeGreaterThan(0);
    const html = socialRowHtml();
    for (const s of configuredSocials()) {
      expect(html).toContain(`href="${s.url}"`);
      expect(html).toContain(`alt="${s.label}"`);
      expect(existsSync(join(process.cwd(), "public/brand/email/social", `${s.key}.png`))).toBe(true);
    }
    expect(html).toContain('width="36" height="36"');
  });

  it("sorts as the social tier, never as an unsanctioned picture, and has a text line each", () => {
    const sorted = sortEmailImages(socialRowHtml());
    expect(sorted.social).toHaveLength(configuredSocials().length);
    expect(sorted.other).toEqual([]);
    expect(socialLinksText().split("\n")[0]).toBe("Follow us:");
  });
});
