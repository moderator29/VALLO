"use client";

import { useParams, usePathname } from "next/navigation";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import { panelClass } from "@/components/ui/Panel";
import { Skeleton } from "@/components/ui/Skeleton";
import { LoadingShell } from "@/components/app/ScreenSkeleton";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { handoffFor } from "@/lib/listings/handoff";
import { aimPhotoMorph } from "@/lib/motion/photo-morph";
import "@/app/css/catalogue.css";
import "@/app/css/space-card.css";

/**
 * THE LISTING IN ONE FRAME (recommendation B4, 30 September 2026).
 *
 * The listing route's loading state. When the tap came from a card on this
 * tab, the card left its facts in `lib/listings/handoff.ts`; this paints them
 * straight away in the real page's own boxes:
 *
 *   - the gallery's lead pane, inset in the space card's top at the gallery's
 *     aspect (3:2, 16:10 from sm), with the photo the card had already
 *     drawn (the browser has it, so nothing is downloaded twice), and the
 *     flight from the card aimed at it when the page is not ready yet
 *     (`aimPhotoMorph`: the whole hero box, as the gallery does);
 *   - the lead panel under it, inside the same card, with the title in the
 *     page's `nf-h2`, the place line and the card's price line.
 *
 * The rest of the page keeps its skeleton, so the real page streams in over
 * this with the photo and title where they already were. A cold open (a
 * shared link, a refresh) has no handoff and renders `fallback`, the route's
 * ordinary skeleton. Every string here is one the card printed.
 */
export function ListingHandoffShell({ fallback, verifiedLabel, id }: {
  fallback: ReactNode;
  /** The listing, when the caller knows it better than the route params do
      (the `(app)` group's own loading boundary, above the `[id]` segment). */
  id?: string;
  /** Kept for callers that still pass it; an example mark is never drawn here (D24). */
  exampleLabel?: string;
  verifiedLabel: string;
}) {
  const params = useParams<{ id?: string }>();
  const hit = handoffFor(id ?? (typeof params?.id === "string" ? params.id : null));
  const hero = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    if (hit) aimPhotoMorph(hero.current, hit.id);
  }, [hit]);
  if (!hit) return <>{fallback}</>;

  return (
    <div className="nf-cat-surface mx-auto max-w-5xl" data-testid="listing-handoff" aria-busy="true">
      <div className="grid gap-xl lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
        <div className="min-w-0">
          {/* The space card's top, as the page draws it (`.nf-sc-top`): the
              photograph inset in the card, then the separate lead panel. */}
          <div className="nf-sc nf-sc-top">
            <div ref={hero} className="nf-gallery--framed nf-vt-morph relative">
              <div className="nf-handoff__pane relative aspect-[3/2] w-full overflow-hidden sm:aspect-[16/10]">
                {hit.drawn ? (
                  // eslint-disable-next-line @next/next/no-img-element -- the exact URL the card drew, already cached; an optimiser URL would be a second download
                  <img src={hit.drawn} alt="" className="h-full w-full object-cover" decoding="sync" />
                ) : (
                  <Skeleton radius="none" className="h-full w-full" />
                )}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 [background-image:var(--nf-scrim-media)]" />
                {/* D24: only an earned mark crosses into the detail page's first
                    frame. The card's example mark is not drawn here, so a tap
                    never paints a label the page itself no longer carries. */}
                {hit.mark === "verified" ? (
                  <p className="nf-gallery-marks">
                    <span className="nf-badge nf-badge--verified nf-gallery-mark">{verifiedLabel}</span>
                  </p>
                ) : null}
              </div>
            </div>
            <section className="nf-sc-top__panel nf-detail-lead">
              <h1 className="nf-h2 break-words">{hit.title}</h1>
              <p className="mt-inline-tight inline-flex max-w-full items-center gap-inline nf-body text-[var(--nf-content-secondary)]">
                <UiIcon name="location" size={20} className="shrink-0 text-[var(--nf-brand-secondary)]" />
                <span className="min-w-0">{hit.place}</span>
              </p>
              {hit.price ? (
                <p className="nf-handoff__price mt-md">
                  <span className="nf-numeric">{hit.price}</span>
                  {hit.priceNote ? <span className="nf-handoff__note"> {hit.priceNote}</span> : null}
                </p>
              ) : null}
              <div className="mt-lg space-y-xs" aria-hidden="true">
                <Skeleton height="0.875rem" radius="sm" />
                <Skeleton width="72%" height="0.875rem" radius="sm" />
              </div>
            </section>
          </div>
        </div>
        <aside className={panelClass({ className: "hidden p-lg lg:block" })} aria-hidden="true">
          <Skeleton width="60%" height="1.5rem" radius="sm" />
          <Skeleton className="mt-md" height="3rem" radius="sm" />
          <Skeleton className="mt-md" height="3.5rem" radius="sm" />
        </aside>
      </div>
    </div>
  );
}

/**
 * THE GROUP'S OWN WAIT KNOWS A LISTING TOO (round 5, measured in a production
 * build). A card's link is prefetched only as far as the nearest loading
 * boundary, and for every `(app)` page that is the group's `loading.tsx`, not
 * the listing's own. So the frame the router commits on the tap, the one the
 * view transition captures as "the new page", was the group's generic rows:
 * no hero for the card's photograph to fly into, and no title or price. It
 * faded where it was and the listing appeared a beat later with nothing
 * carried across. Here the group's boundary asks first: a listing this tab's
 * card just handed its glance to gets the listing's own one-frame shell;
 * every other screen keeps the generic rows (`fallback`).
 */
export function ListingHandoffGate({ fallback, verifiedLabel }: { fallback: ReactNode; verifiedLabel: string }) {
  const path = usePathname();
  const id = /^\/listing\/([^/]+)\/?$/.exec(path ?? "")?.[1];
  if (!id || !handoffFor(id)) return <>{fallback}</>;
  return (
    <LoadingShell label="Loading this place" className="mx-auto w-full max-w-5xl">
      <ListingHandoffShell id={id} verifiedLabel={verifiedLabel} fallback={fallback} />
    </LoadingShell>
  );
}
