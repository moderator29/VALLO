import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BANNER_ALT, bannerFilePath, bannerFor, type BannerFile } from "./banners";
import { configuredSocials } from "./socials";
import { socialRowHtml } from "./render";
import { liveSocials } from "@/lib/brand/socials";

describe("a banner for every kind of email", () => {
  it("gives each family its own picture, security the safe one, the rest the general one", () => {
    expect(bannerFor("listingApproved")).toBe("listing-live");
    expect(bannerFor("listingPassedReview")).toBe("listing-review");
    expect(bannerFor("inspectionScheduled")).toBe("viewing");
    expect(bannerFor("bookingConfirmed")).toBe("stay");
    expect(bannerFor("reservationConfirmed")).toBe("table");
    expect(bannerFor("supportReplied")).toBe("support");
    expect(bannerFor("unreadMessages")).toBe("message");
    expect(bannerFor("verificationRungPassed")).toBe("verification");
    expect(bannerFor("verificationCode")).toBe("email-banner-2");
    expect(bannerFor("paymentReceipt")).toBe("email-banner-1");
  });
  it.each(Object.keys(BANNER_ALT) as BannerFile[])("%s exists on disk and has a real alt", (name) => {
    expect(existsSync(join(process.cwd(), "public", bannerFilePath(name)))).toBe(true);
    expect(BANNER_ALT[name].length).toBeGreaterThan(8);
  });
});

describe("the account icons in every footer", () => {
  it("draws the same accounts as the site footer, as linked round icons that exist on disk", () => {
    expect(configuredSocials().map((s) => s.key)).toEqual(liveSocials().map((s) => s.key));
    const html = socialRowHtml();
    for (const s of configuredSocials()) {
      expect(html).toContain(`href="${s.url}"`);
      expect(html).toContain(`alt="${s.label}"`);
      expect(existsSync(join(process.cwd(), "public/brand/email/social", `${s.key}.png`))).toBe(true);
    }
  });
});
