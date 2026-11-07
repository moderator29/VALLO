"use client";

import { banner } from "@/lib/ui/toast";
import { useEffect, useState } from "react";
import type { Dictionary } from "@vallo/i18n/core";
import { RemoteImage } from "@/components/ui/RemoteImage";
import { missingRequired, offeredSlots, type ShotSlot, type UtilityClaims } from "@/lib/listings/shot-list";
import { readPhotoSlots, setPhotoSlot } from "@/lib/listings/shot-list-actions";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

type Copy = Dictionary["afterTheGate"]["shots"];

/**
 * V-70. The shot list under the wizard's photo grid: each photo gets a label
 * saying what it shows, and the list says which of the four required shots
 * (front, living room, kitchen, a bedroom) are still missing. A utility label
 * is offered only when the listing claims that utility. Saved as it is
 * chosen; the database checks ownership and the claim.
 */
export function ShotList({
  listingId,
  photos,
  claims,
  copy,
}: {
  listingId: string | null;
  photos: { id: string; url: string }[];
  claims: UtilityClaims;
  copy: Copy;
}) {
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [pending, start] = useSafeTransition();
  const ids = photos.map((photo) => photo.id).join(",");

  useEffect(() => {
    if (!listingId || !ids) return;
    let live = true;
    void readPhotoSlots(listingId).then((read) => {
      if (live) setLabels(read);
    });
    return () => {
      live = false;
    };
  }, [listingId, ids]);

  if (!listingId || photos.length === 0) return null;
  const offered = offeredSlots(claims);
  const missing = missingRequired(photos.map((photo) => labels[photo.id] as ShotSlot | undefined));

  return (
    <section className="mt-md grid gap-sm" data-testid="shot-list" aria-label={copy.heading}>
      <h3 className="nf-h4">{copy.heading}</h3>
      <p className="nf-body-sm text-[var(--nf-content-secondary)]">{copy.lede}</p>
      <ul className="grid gap-xs">
        {photos.map((photo, index) => (
          <li key={photo.id} className="flex items-center gap-sm">
            <RemoteImage src={photo.url} alt="" width={96} height={72} sizes="4rem" className="h-12 w-16 shrink-0 rounded-[var(--nf-radius-sm)] object-cover" />
            <label className="sr-only" htmlFor={`shot-${photo.id}`}>
              {copy.labelFor.replace("{n}", String(index + 1))}
            </label>
            <select
              id={`shot-${photo.id}`}
              className="nf-field min-w-0 flex-1"
              value={labels[photo.id] ?? ""}
              disabled={pending}
              onChange={(event) => {
                const slot = event.target.value === "" ? null : (event.target.value as ShotSlot);
                const before = labels[photo.id];
                setLabels((now) => {
                  const next = { ...now };
                  if (slot) next[photo.id] = slot;
                  else delete next[photo.id];
                  return next;
                });
                start(async () => {
                  try {
                    const result = await setPhotoSlot({ photoId: photo.id, slot });
                    if (!result.ok) {
                      banner.error(result.error);
                      setLabels((now) => {
                        const next = { ...now };
                        if (before) next[photo.id] = before;
                        else delete next[photo.id];
                        return next;
                      });
                    }
                  } catch (error) {
                    if (!tapFailedOffline(error)) throw error;
                  }
                });
              }}
            >
              <option value="">{copy.unlabelled}</option>
              {offered.map((slot) => (
                <option key={slot} value={slot}>
                  {copy.slots[slot]}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>
      <p className="nf-caption" role="status">
        {missing.length === 0
          ? copy.complete
          : copy.missing.replace("{slots}", missing.map((slot) => copy.slots[slot].toLowerCase()).join(", "))}
      </p>
    </section>
  );
}
