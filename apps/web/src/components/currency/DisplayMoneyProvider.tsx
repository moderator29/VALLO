"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { DisplayMoney } from "@/lib/currency/display";
import { DEFAULT_AREA_UNIT, formatArea, type AreaUnit } from "@/lib/currency/area";
import { DEFAULT_DISTANCE_UNIT, formatDistance } from "@/lib/currency/distance";

/**
 * The reader's currency and the fresh rate for it, for every `<Price>` below.
 *
 * A layout or page resolves it ONCE on the server (`getDisplayMoney()` in
 * `lib/currency/server.ts`) and passes it here with the guide copy, so forty
 * cards in a list do not each need it as a prop. A `<Price>` with no provider
 * above it and no `display` prop shows naira only, which is always correct.
 */

/* GuideCopy and guideCopyOf live in a plain module (./guide-copy), because a
   server component (GuideScope) calls guideCopyOf, and a function exported
   from a "use client" module cannot be called on the server. */
import type { GuideCopy } from "./guide-copy";
export type { GuideCopy } from "./guide-copy";

export type DisplayMoneyValue = { display: DisplayMoney; copy: GuideCopy };

const DisplayMoneyContext = createContext<DisplayMoneyValue | null>(null);

export function DisplayMoneyProvider({ value, children }: { value: DisplayMoneyValue; children: ReactNode }) {
  return <DisplayMoneyContext.Provider value={value}>{children}</DisplayMoneyContext.Provider>;
}

/** The provider's value, or null when there is none. */
export function useDisplayMoney(): DisplayMoneyValue | null {
  return useContext(DisplayMoneyContext);
}

/** The reader's floor-area unit and its short label, square metres when there is no provider. */
export function useAreaUnit(): { unit: AreaUnit; sqft: string } {
  const context = useDisplayMoney();
  return { unit: context?.display.areaUnit ?? DEFAULT_AREA_UNIT, sqft: context?.copy.sqftShort ?? "sq ft" };
}

/**
 * A stored square-metre figure in the reader's unit: "120 m²" or "1,292 sq ft".
 * `sqmLabel` is the surface's own "m²" copy.
 */
export function useAreaText(): (sqm: number, sqmLabel: string) => string {
  const { unit, sqft } = useAreaUnit();
  return (sqm, sqmLabel) => formatArea(sqm, unit, { sqm: sqmLabel, sqft });
}

/**
 * A stored kilometre figure in the reader's unit: "27 km" or "17 mi".
 * `kmLabel` is the surface's own "km" copy.
 */
export function useDistanceText(): (km: number, kmLabel: string) => string {
  const context = useDisplayMoney();
  const unit = context?.display.distanceUnit ?? DEFAULT_DISTANCE_UNIT;
  const mi = context?.copy.miShort ?? "mi";
  return (km, kmLabel) => formatDistance(km, unit, { km: kmLabel, mi });
}
