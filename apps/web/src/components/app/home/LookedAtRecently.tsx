"use client";

import { useSyncExternalStore } from "react";
import { useHydrated } from "@/components/motion/useInView";
import { Button } from "@/components/ui/Button";
import { SpaceCard } from "@/components/ui/space-card/SpaceCard";
import { SaveButton, useSaveControl } from "@/components/app/SaveControl";
import { drawnSrcIn, handOff } from "@/lib/listings/handoff";
import {
  clearRecentListings,
  recentHref,
  recentListingsServerSnapshot,
  recentListingsSnapshot,
  subscribeRecent,
  type RecentListing,
} from "@/lib/search/memory";
import "@/app/css/space-card.css";

/**
 * "RECENTLY VIEWED" (recommendation B2, 30 September 2026; drawn as the space
 * card on 13 October 2026, `components/ui/space-card`).
 *
 * The phone already remembers the last eight listings opened
 * (`rememberListing`, written by `RecordVisit` on the listing page). This row
 * reads them back on Home, under the hero band, as compact cards in a sideways
 * row: the photograph, the title, the price line the listing's own card
 * printed, a heart. It sits beside "Up next" and does not replace it.
 *
 * REAL ONLY. Hidden when empty, on the server and on a phone that has opened
 * nothing. Device only (what a phone opened is kept on the phone, never read by
 * the server); forgotten on sign-out (`ForgetOnSignOut`). An older entry with
 * no photo or price still shows, with a plain plate and no price line, never a
 * made-up one. An example listing keeps no mark here (D24).
 *
 * A tap hands the card's facts to the listing's loading shell (B4), so the
 * listing opens in one frame from here too.
 */
export function LookedAtRecently({
  copy,
}: {
  copy: { title: string; clear: string; clearLabel: string; verified: string };
}) {
  const entries = useSyncExternalStore(subscribeRecent, recentListingsSnapshot, recentListingsServerSnapshot);
  const hydrated = useHydrated();
  const filled = entries.length > 0;
  /*
   * THE SLOT HOLDS THE ROW'S HEIGHT OPEN BEFORE THE ROW EXISTS (13 October
   * 2026, layout stability). The row reads the phone's memory, so the server
   * draws none of it and it used to arrive after hydration and push Home down.
   * Now the server always draws this empty slot; `member-loop.css` gives it
   * the row's height from the first frame when the head script has seen a
   * remembered listing (`data-recent-listings` on the root), the row fills the
   * space it was holding, and a phone that turns out to have nothing collapses
   * the slot (`data-empty`, set only once hydrated and still empty).
   */
  return (
    <div
      className="nf-lookback-slot"
      data-filled={filled ? "" : undefined}
      data-empty={hydrated && !filled ? "" : undefined}
    >
      {filled ? <LookedAtRow entries={entries} copy={copy} /> : null}
    </div>
  );
}

function LookedAtRow({
  entries,
  copy,
}: {
  entries: RecentListing[];
  copy: { title: string; clear: string; clearLabel: string; verified: string };
}) {
  return (
    <section className="nf-lookback mt-group" aria-labelledby="lookback-title" data-testid="looked-at-recently">
      <div className="nf-lookback__head">
        <h2 id="lookback-title" className="nf-section-label">
          {copy.title}
        </h2>
        <Button variant="quiet" size="sm" aria-label={copy.clearLabel} onClick={clearRecentListings}>
          {copy.clear}
        </Button>
      </div>
      <ul className="nf-feature-row nf-scroll-x nf-scroll-x--gutter">
        {entries.map((entry) => (
          <li key={entry.id} className="nf-feature-row__item">
            <LookbackCard entry={entry} copy={copy} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function LookbackCard({ entry, copy }: { entry: RecentListing; copy: { verified: string } }) {
  const save = useSaveControl(entry.id);
  return (
    <SpaceCard
      variant="compact"
      href={recentHref(entry)}
      title={entry.title}
      photos={entry.photo ? [entry.photo] : []}
      /* D24: no example mark; the glance's "example" mark draws nothing, and
         Verified is only ever set on a row that is not an example. */
      status={entry.mark === "verified" ? copy.verified : null}
      heart={<SaveButton saved={save.saved} pending={save.pending} onToggle={save.toggle} title={entry.title} />}
      price={entry.price ? { amount: entry.price, unit: entry.priceNote || null } : null}
      mediaId={entry.id}
      onOpen={(event, media) => {
        /* The one-frame hand-off is the listing shell's; a stay or a venue has its own. */
        if (entry.href && !entry.href.startsWith("/listing/")) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        handOff(
          {
            id: entry.id,
            title: entry.title,
            place: entry.place,
            photo: entry.photo ?? null,
            price: entry.price ?? null,
            priceNote: entry.priceNote ?? "",
            mark: entry.mark ?? null,
          },
          drawnSrcIn(media, entry.photo),
        );
      }}
    />
  );
}
