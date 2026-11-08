"use client";

import { UiIcon } from "@/design-system/icons/UiIcon";
import { banner } from "@/lib/ui/toast";
import type { SavedCollection } from "@/lib/saved/collections";

/**
 * Share a saved collection via Web Share API (native share sheet on phone,
 * clipboard fallback on desktop). The shared URL includes the collection id
 * so the receiver lands on exactly that list.
 */
export function ShareCollection({ collection }: { collection: SavedCollection | null }) {
  if (!collection) return null;

  async function share() {
    const url = `${window.location.origin}/saved?list=${collection!.id}`;
    const title = collection!.name;
    const text = `Take a look at my "${title}" collection on Vallo`;

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      banner.success("Link copied");
    } catch {
      banner.error("Could not copy the link. Try again.");
    }
  }

  return (
    <button
      type="button"
      className="nf-chip nf-chip--quiet inline-flex items-center gap-1"
      onClick={share}
      aria-label={`Share ${collection.name}`}
      data-testid="share-collection"
    >
      <UiIcon name="share" size={14} />
      Share
    </button>
  );
}
