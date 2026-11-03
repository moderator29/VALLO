import { describe, expect, it } from "vitest";
import { configuredSocials } from "./socials";
import { socialLinksText, socialRowHtml } from "./render";
import { sortEmailImages } from "./images";
import { liveSocials } from "@/lib/brand/socials";

describe("the follow-us line in every email footer", () => {
  it("lists the same accounts as the site footer, as plain clickable words", () => {
    const keys = configuredSocials().map((s) => s.key);
    expect(keys).toEqual(liveSocials().map((s) => s.key));
    expect(keys.length).toBeGreaterThan(0);
    const html = socialRowHtml();
    expect(html).toContain("Follow us:");
    for (const s of configuredSocials()) {
      expect(html).toContain(`href="${s.url}"`);
      expect(html).toContain(`>${s.label}</a>`);
    }
    /* No pictures: words only. */
    expect(sortEmailImages(html).other).toEqual([]);
    expect(html).not.toContain("<img");
  });

  it("is also printed in the plain text, one line per account", () => {
    const lines = socialLinksText().split("\n");
    expect(lines[0]).toBe("Follow us:");
    expect(lines).toHaveLength(configuredSocials().length + 1);
  });
});
