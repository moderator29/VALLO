import { describe, expect, it } from "vitest";
import { showsSiteFoot } from "./site-foot-routes";

describe("where the website's foot is drawn inside the product", () => {
  it("sits under the browsing pages a stranger lands on", () => {
    for (const path of ["/search", "/search/", "/stays", "/restaurants"]) expect(showsSiteFoot(path), path).toBe(true);
    expect(showsSiteFoot("/search", "list")).toBe(true);
    expect(showsSiteFoot("/search", null)).toBe(true);
  });

  it("is never under the map, a listing, or a screen that needs an account", () => {
    expect(showsSiteFoot("/search", "map")).toBe(false);
    for (const path of ["/", "/home", "/listing/7c1e9a52-3b84-4d6f-9a21-5e0d8f4b6c13", "/stay/1", "/search/saved", "/messages", "/wallet", "/settings", null, undefined, ""]) {
      expect(showsSiteFoot(path), String(path)).toBe(false);
    }
  });
});
