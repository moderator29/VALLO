"use client";

import { useEffect, useState } from "react";
import { readRecentListings, recentHref, type RecentListing } from "@/lib/search/memory";
import { PAGE_CACHE_PREFIX } from "@/lib/offline/page-cache";
import { KEPT_PRICE_WORDS } from "./KeptPriceNote";
import { keptOnly } from "@/lib/offline/recent-kept";

/**
 * RECENTLY VIEWED, ON THE OFFLINE SCREEN (Agent NATIVE, job 3; founder's
 * brief section 4: "access to previously saved content, recently viewed
 * content").
 *
 * The places this phone opened last (`lib/search/memory.ts`, the same memory
 * Home's "Looked at recently" row reads), but ONLY the ones whose page this
 * phone actually kept (`public/sw.js`, one page cache per viewer): a link that
 * would open this same offline screen again is worse than no link. Each opens
 * with a full load, which the worker answers from the phone.
 *
 * Honest about what it is: the prices are the ones the listing's card showed
 * when it was opened, so the section says, once, that they are saved on this
 * device and may have changed (UX_SYSTEM section 11). Nothing is drawn when
 * the phone kept none of them, which is most first visits.
 *
 * No photographs: an image the worker did not keep is a broken tile, and the
 * point of this screen is that everything on it works.
 */
/** Whether the worker's page caches (one per viewer) hold this address. */
async function inPageCaches(): Promise<(url: string) => Promise<boolean>> {
  if (typeof caches === "undefined") return async () => false;
  const names = (await caches.keys()).filter((n) => n.startsWith(PAGE_CACHE_PREFIX));
  const stores = await Promise.all(names.map((n) => caches.open(n)));
  return async (url) => (await Promise.all(stores.map((s) => s.match(url)))).some(Boolean);
}

export function OfflineRecent({ heading = "Recently viewed on this phone" }: { heading?: string }) {
  const [items, setItems] = useState<RecentListing[]>([]);
  useEffect(() => {
    let cancelled = false;
    void inPageCaches()
      .then((isKept) => keptOnly(readRecentListings(), isKept, location.origin))
      .then(
        (kept) => {
          if (!cancelled) setItems(kept);
        },
        () => {
          /* Storage refused: the section simply does not draw. */
        },
      );
    return () => {
      cancelled = true;
    };
  }, []);
  if (items.length === 0) return null;
  const anyPrice = items.some((item) => item.price);
  return (
    <section className="mx-auto mt-section w-full max-w-lg space-y-row text-left" aria-label={heading} data-testid="offline-recent">
      <h2 className="nf-h3 text-content">{heading}</h2>
      {anyPrice ? <p className="nf-caption text-muted">{KEPT_PRICE_WORDS}</p> : null}
      <ul className="space-y-row">
        {items.map((item) => (
          <li key={item.id}>
            {/* A plain anchor: the client router cannot fetch with no signal,
                and a full load is what the worker answers from the phone. */}
            <a href={recentHref(item)} className="nf-panel nf-panel--card block p-card">
              <span className="nf-body block font-semibold text-content">{item.title}</span>
              {item.place ? <span className="nf-caption block text-content-2">{item.place}</span> : null}
              {item.price ? (
                <span className="nf-body-sm mt-row block font-semibold tabular-nums text-content">
                  {item.price}
                  {item.priceNote ? <span className="nf-caption font-normal text-muted"> {item.priceNote}</span> : null}
                </span>
              ) : null}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
