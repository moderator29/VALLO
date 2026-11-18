"use client";

import { addRoomTypePhoto, removeRoomTypePhoto, reorderRoomTypePhotos } from "@/lib/host/actions";
import { MAX_BUSINESS_PHOTOS } from "@/lib/host/photos";
import { PhotoManager } from "./PhotoManager";
import { useHostPageCopy } from "./host-copy";

/**
 * The host's photographs of one ROOM TYPE, on the `room_type_photos` spine.
 *
 * The third named door onto `PhotoManager`, beside `AccommodationPhotoManager`
 * and `BusinessPhotoManager`: the same bucket, the same uid-prefixed path
 * (`<uid>/<room type id>/<uuid>.<ext>`), the same ceiling of ten, the same
 * cover rule and the same reorder. This file decides only which table the
 * photographs land in and the words a host reads about a room. Drawn inside a
 * fold that already names the room and is already a card, so it is `bare`.
 */
export function RoomTypePhotoManager({
  roomTypeId,
  roomName,
  userId,
  photos,
}: {
  roomTypeId: string;
  roomName: string;
  userId: string;
  /** What is on record, cover first. */
  photos: { id: string; url: string }[];
}) {
  const words = useHostPageCopy().photoManager.room;
  return (
    <PhotoManager
      bare
      subjectId={roomTypeId}
      userId={userId}
      photos={photos}
      copy={{
        title: words.title.replace("{room}", roomName),
        guidance: words.guidance,
        ofSubject: words.ofSubject,
        fullNote: words.fullNote.replace("{max}", String(MAX_BUSINESS_PHOTOS)),
      }}
      add={({ storagePath }) => addRoomTypePhoto({ roomTypeId, storagePath })}
      remove={({ photoId }) => removeRoomTypePhoto({ photoId })}
      reorder={(photoIds) => reorderRoomTypePhotos({ subjectId: roomTypeId, photoIds })}
    />
  );
}
