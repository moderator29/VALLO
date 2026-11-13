"use client";

import Image from "next/image";
import { useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { UiIcon } from "@/design-system/icons/UiIcon";
import type { ListingKind } from "@/lib/listings/types";
import { PhotoFrame } from "./PhotoFrame";
import { usePhotoViewer } from "./PhotoViewer";
import { clockOf, photosAsMedia, type GalleryMedia } from "./gallery-media";
import "@/app/css/catalogue.css";

/**
 * The photo grid.
 *
 * Reference 3 puts a real gallery grid in the content sheet with a "Show all"
 * action beside the section heading. This platform had neither: the only way to
 * see a listing's photography was to swipe the hero, there was no grid, no
 * count, and tapping a photo did nothing at all.
 *
 * The grid shows the first six frames. When there are more, the last tile
 * carries the remainder as a "+N" cap rather than silently truncating, and the
 * heading's trailing action opens a sheet holding the whole set - the brief's
 * "section header paired with a muted trailing action", which until now existed
 * on exactly one screen.
 *
 * Both the grid and the sheet open the shared lightbox rather than owning one.
 * Picking a photo in the sheet closes the sheet first, so scroll locking and
 * focus restoration never nest.
 */

/*
 * THE GALLERY STRIP (founder's reference, 13 October 2026): a "Gallery"
 * heading with "View all" opposite it and one row of three frames under it,
 * the third carrying "+N" when there are more. Six tiles in two rows was a
 * second hero halfway down the page; one row says "there is more" and the
 * sheet and the lightbox say the rest. Nothing is lost: "View all" opens the
 * whole set and any frame opens the lightbox at that frame.
 */
const PREVIEW = 3;

/** The strip's words, from the page's dictionary (`catalogue.detail`). */
export type PhotoGridCopy = {
  /** "Gallery" */
  title: string;
  /** "View all" */
  viewAll: string;
  /** "View all {count} photos and videos" */
  viewAllMedia: string;
};

export function ListingPhotoGrid({
  photos,
  media,
  hue,
  kind,
  /** Only used for the sheet's accessible name. */
  title,
  copy,
}: {
  copy?: PhotoGridCopy;
  photos: string[];
  /**
   * Photos and videos in the lister's order (`gallery-media.ts`). A video is a
   * tile with a play badge and opens the viewer playing. Optional: without it
   * the grid is the photo grid it always was.
   */
  media?: GalleryMedia[];
  hue: number;
  /**
   * Which market this is, so the frame drawn behind a missing photograph is a
   * drawing of THIS kind of place rather than the same city skyline every
   * listing used to get. See `MediaFrame`.
   */
  kind: ListingKind;
  title: string;
}) {
  const viewer = usePhotoViewer();
  const [showAll, setShowAll] = useState(false);
  const items = media && media.length > 0 ? media : photosAsMedia(photos);

  // The hero already is the photograph when there is only one. A grid of one
  // tile states nothing the reader cannot already see.
  if (items.length < 2) return null;

  const preview = items.slice(0, PREVIEW);
  const remainder = items.length - preview.length;

  /* The tapped tile's rectangle travels with the index, so the photograph
     grows out of the tile it was (PhotoViewer, motion 18). */
  function open(index: number, from?: Element | null, foldBack = true) {
    setShowAll(false);
    viewer?.open(index, from ? from.getBoundingClientRect() : null, { foldBack });
  }

  return (
    <section data-testid="listing-photo-grid">
      <div className="mb-sm flex items-baseline justify-between gap-md">
        <h2 className="nf-h3">{copy?.title ?? "Photos"}</h2>
        <Button
          variant="quiet"
          size="sm"
          className="nf-section-action"
          onClick={() => setShowAll(true)}
          aria-label={copy ? copy.viewAllMedia.replace("{count}", String(items.length)) : undefined}
          data-testid="photos-show-all"
        >
          {copy?.viewAll ?? `Show all ${items.length}`}
        </Button>
      </div>

      <ul className="grid grid-cols-3 gap-xs">
        {preview.map((item, i) => {
          const last = i === preview.length - 1 && remainder > 0;
          return (
            <li key={`${item.src}-${i}`}>
              <button
                type="button"
                onClick={(event) => open(i, event.currentTarget)}
                aria-label={
                  last
                    ? (copy?.viewAllMedia ?? "View all {count} photos and videos").replace("{count}", String(items.length))
                    : item.kind === "video"
                      ? `Play video ${i + 1} of ${items.length} full screen`
                      : `View photo ${i + 1} of ${items.length} full screen`
                }
                className="relative block aspect-[4/3] w-full overflow-hidden rounded-md transition-transform active:scale-[0.97] motion-reduce:transition-none"
              >
                {/* The "+N" cap stands for the rest of the set, so a video
                    badge under it would be a second mark on one tile. */}
                <Tile item={item} hue={hue} kind={kind} index={i} sizes="(max-width: 640px) 33vw, 220px" badge={!last} />
                {last && (
                  <span className="nf-numeric absolute inset-0 grid place-items-center bg-[var(--nf-overlay-media-strong)] nf-media-chip nf-media-chip--lg font-bold backdrop-blur-[2px]">
                    +{remainder}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <Sheet open={showAll} onOpenChange={setShowAll} title={`${title} photos`}>
        <ul className="grid grid-cols-2 gap-xs sm:grid-cols-3">
          {items.map((item, i) => (
            <li key={`all-${item.src}-${i}`}>
              <button
                type="button"
                onClick={(event) => open(i, event.currentTarget, false)}
                aria-label={
                  item.kind === "video"
                    ? `Play video ${i + 1} of ${items.length} full screen`
                    : `View photo ${i + 1} of ${items.length} full screen`
                }
                className="relative block aspect-[4/3] w-full overflow-hidden rounded-[var(--nf-container-radius)] transition-transform active:scale-[0.97] motion-reduce:transition-none"
              >
                <Tile item={item} hue={hue} kind={kind} index={i} sizes="(max-width: 640px) 50vw, 220px" />
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </section>
  );
}

/** One thumbnail, falling back to the listing's branded frame if it will not load. */
function Tile({
  item,
  hue,
  kind,
  index,
  sizes,
  badge = true,
}: {
  badge?: boolean;
  item: GalleryMedia;
  hue: number;
  kind: ListingKind;
  index: number;
  sizes: string;
}) {
  const [broken, setBroken] = useState(false);
  const still = item.kind === "photo" ? item.src : item.poster;
  return (
    <>
      <PhotoFrame hue={hue} index={index} kind={kind} />
      {still && !broken && (
        <Image
          src={still}
          alt=""
          fill
          sizes={sizes}
          onError={() => setBroken(true)}
          className="object-cover"
        />
      )}
      {item.kind === "video" && badge && (
        /* The play badge: a video among the photos, which opens playing. */
        <span
          className="absolute bottom-2 left-2 z-[1] inline-flex items-center gap-3xs rounded-xs nf-media-chip px-2xs py-3xs font-semibold"
          data-testid="grid-video-badge"
          /* A chip on a photograph keeps the night material in both themes:
             on paper it painted a white box with a white glyph in it. */
          data-theme="dark"
          aria-hidden="true"
        >
          <UiIcon name="circle-play" size={16} />
          {item.durationSeconds ? <span className="nf-numeric">{clockOf(item.durationSeconds)}</span> : null}
        </span>
      )}
    </>
  );
}
