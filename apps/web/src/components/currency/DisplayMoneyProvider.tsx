"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { DisplayMoney } from "@/lib/currency/display";

/**
 * The reader's currency and the fresh rate for it, for every `<Price>` below.
 *
 * A layout or page resolves it ONCE on the server (`getDisplayMoney()` in
 * `lib/currency/server.ts`) and passes it here with the guide copy, so forty
 * cards in a list do not each need it as a prop. A `<Price>` with no provider
 * above it and no `display` prop shows naira only, which is always correct.
 */

/** The words round a guide figure (`experienceSettings.preferences`). */
export type GuideCopy = {
  /** "about {amount}" */
  about: string;
  /** "less than {amount}" */
  under: string;
  /** "approximately {amount}, as a guide. You pay in naira." */
  aboutSpoken: string;
};

export type DisplayMoneyValue = { display: DisplayMoney; copy: GuideCopy };

const DisplayMoneyContext = createContext<DisplayMoneyValue | null>(null);

export function DisplayMoneyProvider({ value, children }: { value: DisplayMoneyValue; children: ReactNode }) {
  return <DisplayMoneyContext.Provider value={value}>{children}</DisplayMoneyContext.Provider>;
}

/** The provider's value, or null when there is none. */
export function useDisplayMoney(): DisplayMoneyValue | null {
  return useContext(DisplayMoneyContext);
}

/** The guide copy out of a dictionary's preferences block. */
export function guideCopyOf(preferences: GuideCopy): GuideCopy {
  return { about: preferences.about, under: preferences.under, aboutSpoken: preferences.aboutSpoken };
}
