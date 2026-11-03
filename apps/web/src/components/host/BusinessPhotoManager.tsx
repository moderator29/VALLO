"use client";

import { addBusinessPhoto, removeBusinessPhoto, reorderBusinessPhotos } from "@/lib/host/actions";
import { MAX_BUSINESS_PHOTOS } from "@/lib/host/photos";
import { PhotoManager } from "./PhotoManager";
import { useHostPageCopy } from "./host-copy";

/**
 * The owner's photographs of their VENUE, on the `business_photos` spine.
 *
 * A named door onto `PhotoManager`, which carries the whole argument for the
 * anatomy, the upload and the cover. This file decides only two things: which
 * table the photographs land in, and the words a venue owner reads. The
 * accommodation twin is `AccommodationPhotoManager`, and they share one body
 * so the two surfaces cannot come to disagree about the cover, the ceiling or
 * a refusal.
 */
export function BusinessPhotoManager({
  businessId,
  userId,
  photos,
}: {
  businessId: string;
  userId: string;
  /** What is on record, cover first. */
  photos: { id: string; url: string }[];
}) {
  const words = useHostPageCopy().photoManager.venue;
  return (
    <PhotoManager
      subjectId={businessId}
      userId={userId}
      photos={photos}
      copy={{
        title: words.title,
        guidance: words.guidance,
        ofSubject: words.ofSubject,
        fullNote: words.fullNote.replace("{max}", String(MAX_BUSINESS_PHOTOS)),
      }}
      add={({ storagePath }) => addBusinessPhoto({ businessId, storagePath })}
      remove={({ photoId }) => removeBusinessPhoto({ photoId })}
      reorder={(photoIds) => reorderBusinessPhotos({ subjectId: businessId, photoIds })}
    />
  );
}
