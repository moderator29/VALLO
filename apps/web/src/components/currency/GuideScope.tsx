import type { ReactNode } from "react";
import { getDisplayMoney } from "@/lib/currency/server";
import { showsGuide } from "@/lib/currency/display";
import { DisplayMoneyProvider } from "./DisplayMoneyProvider";
import { guideCopyOf, type GuideCopy } from "./guide-copy";
import { RatesAttribution } from "./RatesAttribution";

/**
 * ONE BROWSING PAGE'S CURRENCY GUIDE: resolve, provide, credit. Server only.
 *
 * A browsing page (search, home, stays, a stay, a restaurant, saved) wraps
 * its content in this. It resolves the reader's currency and the fresh rate
 * for it once on the server (`getDisplayMoney`, memoised per request), hands
 * it to every `<PriceGuide>` below through the provider, and puts the rate
 * source's required credit once at the foot of the page when a guide can be
 * shown at all.
 *
 * MONEY PAGES DO NOT USE THIS. With no provider above it, a `<PriceGuide>`
 * draws nothing, so a money screen stays naira only even if a shared
 * component carrying a guide is ever placed on it.
 */
export async function GuideScope({
  copy,
  children,
}: {
  /** `t.experienceSettings.preferences`. */
  copy: GuideCopy & { attribution: string };
  children: ReactNode;
}) {
  const display = await getDisplayMoney();
  return (
    <DisplayMoneyProvider value={{ display, copy: guideCopyOf(copy) }}>
      {children}
      {showsGuide(display) && display.rate?.source === "exchangerate-api" ? (
        <p className="px-gutter py-xs text-center" data-testid="guide-credit">
          <RatesAttribution display={display} label={copy.attribution} />
        </p>
      ) : null}
    </DisplayMoneyProvider>
  );
}
