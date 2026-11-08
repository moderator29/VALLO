"use client";

import { banner } from "@/lib/ui/toast";
import { uploadToStorage } from "@/lib/media/upload";
import { useId, useRef, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { Button } from "@/components/ui/Button";
import { RemoteImage } from "@/components/ui/RemoteImage";
import type { ActionResult } from "@/lib/actions/envelope";
import {
  MAX_BUSINESS_PHOTOS,
  PHOTO_ACCEPTED_MIME,
  PHOTO_MAX_LABEL,
  rejectPhoto,
} from "@/lib/host/photos";
import { loadBrowserClient } from "@/lib/supabase/load-client";
import { useHostPageCopy } from "./host-copy";
import { moveId } from "./photo-order";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

/**
 * AN OWNER'S PHOTOGRAPHS, ONE SURFACE FOR BOTH SPINES.
 *
 * WHAT WAS TRUE BEFORE THIS. `business_photos` had a manager at
 * `/host/photos` and `accommodation_photos` had none at all, although its
 * table, its bucket, its four storage policies and its catalogue trigger were
 * built in M3. So a restaurant could send its pictures and a hotel could not,
 * while the submission gate in `lib/host/onboarding.ts` refuses an
 * accommodation with no photograph. Every hotel and every shortlet filled in
 * nine steps and could never press send.
 *
 * WHY ONE COMPONENT RATHER THAN A SECOND COPY. The act is identical on both
 * spines: put the object in the same public bucket under the person's own uid
 * prefix, then have a server action record the path after checking that prefix
 * again. The tables differ only in which owner helper RLS consults. A second
 * copy of this file is how the two surfaces come to disagree about the cover,
 * the ceiling or the refusal wording, and the two upload ceilings already
 * disagreed once across layers. `BusinessPhotoManager` and
 * `AccommodationPhotoManager` are the two named doors onto this one body.
 *
 * THE UPLOAD IS THE DOCUMENT UPLOADER'S TWO-STEP, for its reasons: the browser
 * puts the object in the bucket, storage RLS enforces the uid prefix, and the
 * server records the path only after checking that prefix itself. A person who
 * closes the tab keeps every photograph that finished.
 *
 * THE FIRST PHOTOGRAPH IS THE COVER, and the screen says so rather than
 * offering a control that cannot be built honestly yet: position is unique per
 * subject, so a reorder is a swap through a free slot and there is no free slot
 * at ten photographs. Removing the cover promotes the next one, which is a
 * reorder anybody can perform and nobody has to be taught.
 */
const ORDER_WORDS = {
  earlier: "Move earlier",
  later: "Move later",
  makeCover: "Make cover",
  hint: "Drag a photograph to reorder, or use the buttons. The first is the cover.",
};

export function PhotoManager({
  /** The row the photographs hang on: a business, or an accommodation. */
  subjectId,
  userId,
  photos,
  copy,
  add,
  remove: removeAction,
  reorder,
}: {
  subjectId: string;
  userId: string;
  /** What is on record, cover first. */
  photos: { id: string; url: string }[];
  copy: {
    /** The heading, and the noun the sentences use. */
    title: string;
    /** What to photograph, in the owner's own terms. */
    guidance: string;
    /** "of your hotel", "of your venue": how a photograph is described. */
    ofSubject: string;
    /** The sentence when the subject is full. */
    fullNote: string;
  };
  add: (input: { storagePath: string }) => Promise<ActionResult<{ id: string }>>;
  remove: (input: { photoId: string }) => Promise<ActionResult<null>>;
  /** Save a new order (every photograph id, cover first). Absent, the grid is fixed. */
  reorder?: (photoIds: string[]) => Promise<ActionResult<null>>;
}) {
  const w = useHostPageCopy().photoManager.controls;
  const router = useRouter();
  const inputId = useId();
  const input = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [removing, startRemoving] = useSafeTransition();

  const full = photos.length >= MAX_BUSINESS_PHOTOS;

  /* The order the host sees while a save is in flight, so a drop lands at once
     and a failed save puts the grid back. */
  const [order, setOrder] = useState<string[] | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const shown = order
    ? order.map((id) => photos.find((p) => p.id === id)).filter((p): p is { id: string; url: string } => Boolean(p))
    : photos;

  function move(photoId: string, to: number) {
    if (!reorder) return;
    const ids = shown.map((p) => p.id);
    const toIndex = Math.max(0, Math.min(ids.length - 1, to));
    const next = moveId(ids, photoId, toIndex);
    if (next === ids) return;
    setOrder(next);
    startRemoving(async () => {
      try {
        const result = await reorder(next);
        if (!result.ok) {
          banner.error(result.error);
          setOrder(null);
          return;
        }
        banner.success("Reordered");
        router.refresh();
        setOrder(null);
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  }

  async function pick(chosen: File | undefined) {
    if (!chosen) return;
    const refusal = rejectPhoto(chosen, w);
    if (refusal) {
      banner.error(refusal);
      return;
    }
    setBusy(true);
    try {
      const ext = chosen.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      /* The bucket's own convention: the first folder is the uploader's uid,
         which is what its four policies check. `accommodation-photos` is the
         public photo bucket for the whole estate; the P3 migration's header
         sets out why the business spine shares it rather than inventing one. */
      const path = `${userId}/${subjectId}/${crypto.randomUUID()}.${ext}`;
      const supabase = await loadBrowserClient();
      if (!supabase) {
        banner.error(w.uploadFailed);
        return;
      }
      const uploaded = await uploadToStorage({
        supabase,
        bucket: "accommodation-photos",
        path,
        body: chosen,
        contentType: chosen.type,
      });
      if (!uploaded.ok) {
        banner.error(w.uploadFailed);
        return;
      }
      const result = await add({ storagePath: path });
      if (!result.ok) {
        banner.error(result.error);
        return;
      }
      banner.success("Photo added");
      router.refresh();
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  function takeDown(photoId: string) {
    startRemoving(async () => {
      try {
        const result = await removeAction({ photoId });
        if (!result.ok) {
          banner.error(result.error);
          return;
        }
        banner.success("Photo removed");
        router.refresh();
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  }

  return (
    <section className="nf-panel nf-panel--card block nf-host-group">
      <h2 className="nf-host-group__title">{copy.title}</h2>
      <p className="nf-host-group__note">{copy.guidance}</p>
      {reorder && photos.length > 1 ? <p className="nf-caption mt-inline">{ORDER_WORDS.hint}</p> : null}
      <p className="nf-caption mt-inline">{w.coverNote.replace("{max}", String(MAX_BUSINESS_PHOTOS))}</p>

      {photos.length > 0 && (
        <ul className="mt-group grid grid-cols-2 gap-row sm:grid-cols-3">
          {shown.map((photo, index) => (
            <li
              key={photo.id}
              className="min-w-0"
              data-testid="host-photo"
              {...(reorder
                ? {
                    draggable: true,
                    onDragStart: (event: DragEvent<HTMLLIElement>) => {
                      setDragging(photo.id);
                      event.dataTransfer.effectAllowed = "move";
                    },
                    onDragOver: (event: DragEvent<HTMLLIElement>) => {
                      if (dragging) event.preventDefault();
                    },
                    onDrop: (event: DragEvent<HTMLLIElement>) => {
                      event.preventDefault();
                      if (dragging && dragging !== photo.id) move(dragging, index);
                      setDragging(null);
                    },
                    onDragEnd: () => setDragging(null),
                  }
                : {})}
            >
              <RemoteImage
                src={photo.url}
                alt={
                  index === 0
                    ? w.coverAlt
                    : w.photoAlt.replace("{n}", String(index + 1)).replace("{subject}", copy.ofSubject)
                }
                width={400}
                height={300}
                sizes="(min-width: 640px) 200px, 45vw"
                className="h-32 w-full rounded-md border border-[var(--nf-border-subtle)] object-cover"
              />
              {/* STACKED, NOT A ROW. At 390 two of these sit side by side and
                  a label beside a control has about 80px to live in: the
                  control ran out past the card's edge and the word under it
                  broke in two. The name of the photograph and the way to
                  remove it are a stack at every width. */}
              <div className="mt-inline">
                <span className="nf-overline block">
                  {index === 0 ? w.cover : w.photo.replace("{n}", String(index + 1))}
                </span>
                {/* GLASS, NOT GHOST. A ghost button is transparent and
                    borderless by design, so under a photograph and beside a
                    bold overline it read as a caption rather than a control:
                    at 390 in dark the words "Take down" sat under the picture
                    looking like its title. The quiet glass edge is the least
                    that makes it legible as something to press, and it is not
                    the rose destructive treatment, because three rose buttons
                    in a grid of three photographs shout at an owner tidying
                    their own pictures. */}
                {reorder && shown.length > 1 ? (
                  <div className="mb-inline flex gap-xs">
                    <Button
                      variant="secondary"
                      size="sm"
                      full
                      disabled={removing || busy || index === 0}
                      onClick={() => move(photo.id, index === 1 ? 0 : index - 1)}
                    >
                      {index === 1 ? ORDER_WORDS.makeCover : ORDER_WORDS.earlier}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      full
                      disabled={removing || busy || index === shown.length - 1}
                      onClick={() => move(photo.id, index + 1)}
                    >
                      {ORDER_WORDS.later}
                    </Button>
                  </div>
                ) : null}
                <Button
                  variant="secondary"
                  size="sm"
                  full
                  disabled={removing || busy}
                  onClick={() => takeDown(photo.id)}
                >
                  {w.takeDown}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <input
        ref={input}
        id={inputId}
        type="file"
        accept={PHOTO_ACCEPTED_MIME.join(",")}
        className="sr-only"
        disabled={busy || full}
        onChange={(event) => void pick(event.target.files?.[0])}
      />
      {full ? (
        <p className="nf-caption mt-group">{copy.fullNote}</p>
      ) : (
        <label htmlFor={inputId} className="nf-panel nf-panel--card nf-host-drop mt-group">
          <UiIcon name="picture" size={20} className="shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block nf-body-sm font-semibold">
              {busy ? w.uploading : photos.length === 0 ? w.addFirst : w.addAnother}
            </span>
            <span className="block nf-caption">
              {w.formats.replace("{formats}", w.acceptedFormats).replace("{size}", PHOTO_MAX_LABEL)}
            </span>
          </span>
        </label>
      )}

    </section>
  );
}
