import { describe, expect, it } from "vitest";
import {
  CATEGORY_STATUSES,
  DEFAULT_CATEGORY_STATUS,
  PROTECTED_CATEGORIES,
  categoryMayUseProtectedRail,
  isProtectedCategory,
  readCategoryStatus,
} from "./protected-categories";

describe("the protected rail's categories", () => {
  it("are the eight of PROTECTED_PAYMENTS_BUILD.md section 9", () => {
    expect(PROTECTED_CATEGORIES).toEqual([
      "residential_rent",
      "shortlet",
      "hotel_booking",
      "commercial_rent",
      "property_sale",
      "land_sale",
      "event_space",
      "other",
    ]);
  });

  it("start disabled, and anything unreadable is disabled", () => {
    expect(DEFAULT_CATEGORY_STATUS).toBe("disabled");
    expect(readCategoryStatus(undefined)).toBe("disabled");
    expect(readCategoryStatus("APPROVED")).toBe("disabled");
    expect(readCategoryStatus("approved ")).toBe("disabled");
    expect(readCategoryStatus(null)).toBe("disabled");
  });

  it("let only an approved category reach the rail", () => {
    for (const status of CATEGORY_STATUSES) {
      expect(categoryMayUseProtectedRail(status)).toBe(status === "approved");
    }
  });

  it("recognise only their own names", () => {
    expect(isProtectedCategory("shortlet")).toBe(true);
    expect(isProtectedCategory("event_space_booking")).toBe(false);
    expect(isProtectedCategory(42)).toBe(false);
  });
});
