import { describe, expect, it } from "vitest";
import { appStoreId, playPackageId, prefersNativeApp, relatedApplications, smartBannerContent } from "./store-links";

/**
 * THE TWO STORE LISTINGS, READ FROM THEIR OWN ADDRESSES.
 *
 * The real values are pinned here: the Apple id and the Android package of
 * the live apps. The country trap has its own test, because the address the
 * App Store hands you carries one and it sends every reader abroad to a store
 * they cannot buy from.
 */
const APPLE = "https://apps.apple.com/app/vallo/id6818483899";
const PLAY = "https://play.google.com/store/apps/details?id=com.vallospaces.app";

describe("the App Store address", () => {
  it("reads the id with no country, which is the form to publish", () => {
    expect(appStoreId(APPLE)).toBe("6818483899");
  });

  it("still reads the id from an address that carries a country, so an old link is not silently ignored", () => {
    expect(appStoreId("https://apps.apple.com/ng/app/vallo/id6818483899")).toBe("6818483899");
    expect(appStoreId("https://apps.apple.com/gb/app/vallo/id6818483899")).toBe("6818483899");
    expect(appStoreId("https://apps.apple.com/app/id6818483899")).toBe("6818483899");
    expect(appStoreId("https://apps.apple.com/app/vallo/id6818483899?mt=8")).toBe("6818483899");
  });

  it("reads nothing from an address that is not the App Store", () => {
    for (const bad of [
      "",
      undefined,
      null,
      "https://apps.apple.com/",
      "https://apps.apple.com/app/vallo",
      "http://apps.apple.com/app/vallo/id6818483899",
      "https://example.com/app/vallo/id6818483899",
      "https://apps.apple.com.evil.test/app/id6818483899",
    ]) {
      expect(appStoreId(bad), String(bad)).toBeNull();
    }
  });
});

describe("the banner Safari draws above the page", () => {
  it("is the one tag Apple reads, with the live id", () => {
    expect(smartBannerContent(APPLE)).toBe("app-id=6818483899");
  });

  it("is absent until an App Store address is set, rather than pointing nowhere", () => {
    expect(smartBannerContent(undefined)).toBeNull();
    expect(smartBannerContent("")).toBeNull();
    expect(smartBannerContent("coming soon")).toBeNull();
  });
});

describe("the Play address", () => {
  it("reads the package of the live app", () => {
    expect(playPackageId(PLAY)).toBe("com.vallospaces.app");
    expect(playPackageId(`${PLAY}&hl=en`)).toBe("com.vallospaces.app");
  });

  it("reads nothing from an address that is not a Play listing", () => {
    for (const bad of ["", undefined, null, "https://play.google.com/store/apps", "https://play.google.com/store/apps/details", "https://example.com/store/apps/details?id=com.vallospaces.app"]) {
      expect(playPackageId(bad), String(bad)).toBeNull();
    }
  });
});

describe("what the manifest tells Chrome", () => {
  it("names the real app, with its package and its listing", () => {
    expect(relatedApplications(PLAY)).toEqual([{ platform: "play", id: "com.vallospaces.app", url: PLAY }]);
    expect(prefersNativeApp(PLAY)).toBe(true);
  });

  it("names nothing, and keeps the installable page, until the listing is set", () => {
    expect(relatedApplications(undefined)).toEqual([]);
    expect(prefersNativeApp(undefined)).toBe(false);
    expect(prefersNativeApp("")).toBe(false);
  });
});

describe("the two addresses the deploy settings carry", () => {
  it("are the ones the badges accept, so one value serves the badge, the banner and the manifest", async () => {
    const { storeBadges } = await import("@/components/site/landing/store-badges");
    const badges = storeBadges({ appStoreUrl: APPLE, playStoreUrl: PLAY, native: false });
    expect(badges).toEqual([
      { store: "ios", href: APPLE },
      { store: "android", href: PLAY },
    ]);
  });
});
