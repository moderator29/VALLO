import { afterEach, describe, expect, it, vi } from "vitest";
import { configuredSocials } from "./socials";
import { socialLinksText, socialRowHtml } from "./render";
import { sortEmailImages } from "./images";

afterEach(() => vi.unstubAllEnvs());

describe("the social row in every email footer", () => {
  it("draws nothing when no account is set", () => {
    expect(configuredSocials({})).toEqual([]);
    expect(socialRowHtml()).toBe("");
    expect(socialLinksText()).toBe("");
  });

  it("draws one linked mark per account that is set, in a fixed order, https only", () => {
    expect(
      configuredSocials({
        NEXT_PUBLIC_VALLO_TIKTOK_URL: "https://tiktok.com/@vallo",
        NEXT_PUBLIC_VALLO_X_URL: "https://x.com/vallo",
        NEXT_PUBLIC_VALLO_FACEBOOK_URL: "http://facebook.com/vallo",
        NEXT_PUBLIC_VALLO_INSTAGRAM_URL: "javascript:alert(1)",
      }).map((s) => s.key),
    ).toEqual(["x", "tiktok"]);
  });

  it("renders linked 36px icons the image sorter knows, and a text line each", () => {
    vi.stubEnv("NEXT_PUBLIC_VALLO_X_URL", "https://x.com/vallo");
    vi.stubEnv("NEXT_PUBLIC_VALLO_INSTAGRAM_URL", "https://instagram.com/vallo");
    const html = socialRowHtml();
    expect(html).toContain('href="https://x.com/vallo"');
    expect(html).toContain('alt="Instagram"');
    expect(html).toContain('width="36" height="36"');
    const sorted = sortEmailImages(html);
    expect(sorted.social).toHaveLength(2);
    expect(sorted.other).toEqual([]);
    expect(socialLinksText()).toBe("Follow us:\nX: https://x.com/vallo\nInstagram: https://instagram.com/vallo");
  });
});
