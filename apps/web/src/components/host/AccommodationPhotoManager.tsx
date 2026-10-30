"use client";

import { addAccommodationPhoto, removeAccommodationPhoto, reorderAccommodationPhotos } from "@/lib/host/actions";
import { MAX_BUSINESS_PHOTOS } from "@/lib/host/photos";
import { PhotoManager } from "./PhotoManager";
import { useHostPageCopy } from "./host-copy";

/**
 * The host's photographs of their PROPERTY, on the `accommodation_photos`
 * spine.
 *
 * THE SURFACE THAT DID NOT EXIST, and whose absence was the hardest dead end
 * in the product: `missingFrom` blocks submission when an accommodation
 * carries no photograph, the table and bucket were built in M3, and no
 * application code ever wrote to them. Every hotel and every shortlet stopped
 * at the review step with a requirement nothing could meet.
 *
 * A named door onto `PhotoManager`, exactly as `BusinessPhotoManager` is. This
 * file decides only which table the photographs land in and the words a
 * property host reads. The guidance is a hotel's and a shortlet's rather than
 * a restaurant's, because the picture that sells a room is not the picture
 * that sells a table.
 */
export function AccommodationPhotoManager({
  accommodationId,
  userId,
  photos,
}: {
  accommodationId: string;
  userId: string;
  /** What is on record, cover first. */
  photos: { id: string; url: string }[];
}) {
  const words = useHostPageCopy().photoManager.property;
  return (
    <PhotoManager
      subjectId={accommodationId}
      userId={userId}
      photos={photos}
      copy={{
        title: words.title,
        guidance: words.guidance,
        ofSubject: words.ofSubject,
        fullNote: words.fullNote.replace("{max}", String(MAX_BUSINESS_PHOTOS)),
      }}
      add={({ storagePath }) => addAccommodationPhoto({ accommodationId, storagePath })}
      remove={({ photoId }) => removeAccommodationPhoto({ photoId })}
      reorder={(photoIds) => reorderAccommodationPhotos({ subjectId: accommodationId, photoIds })}
    />
  );
}
