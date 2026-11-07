import { recentHref, type RecentListing } from "@/lib/search/memory";

/**
 * Which recently viewed places the offline screen may offer: only those whose
 * page this phone kept, so no link leads back to the offline screen
 * (`components/app/offline/OfflineRecent.tsx`). Pure, so it is tested here.
 */
export const MAX_SHOWN = 5;

/** The places whose page the phone kept, in the order they were opened, at most MAX_SHOWN. */
export async function keptOnly(
  entries: readonly RecentListing[],
  isKept: (absoluteUrl: string) => Promise<boolean>,
  origin: string,
): Promise<RecentListing[]> {
  const kept: RecentListing[] = [];
  for (const entry of entries) {
    if (await isKept(new URL(recentHref(entry), origin).href)) kept.push(entry);
    if (kept.length >= MAX_SHOWN) break;
  }
  return kept;
}

