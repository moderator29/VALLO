"use client";

import { useHostCopy } from "@/components/host/host-copy";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { Button } from "@/components/ui/Button";
import { setAccommodationFacilities } from "@/lib/host/actions";
import { STAY_FACILITIES } from "@/lib/host/facilities";
import { countOf } from "@vallo/i18n/core";
import { useClientLocale } from "@/lib/i18n/use-client-locale";
import "@/app/css/catalogue.css";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";
import { banner } from "@/lib/ui/toast";

/**
 * WHAT THE PROPERTY OFFERS. `GOVERNING-10` screen four, the facilities half.
 *
 * WHY IT MATTERS MORE THAN IT LOOKS. `accommodation_amenities` has had its
 * table, its owner helper and its RLS since M3 and nothing ever wrote a row,
 * while the stays filter lets a guest ask for wifi, parking or air
 * conditioning by name and the catalogue projection folds the codes into
 * `catalogue_entries.amenity_codes`. So every one of those filters returned
 * nothing for every hotel on the platform. This is the control that fills the
 * table.
 *
 * THE RENDER DRAWS THESE AS TILES AND THEY NOW SHIP AS TILES.
 *
 * They shipped as `nf-chip`, a row of pills, under a note saying the shape law
 * beat the image. That note answered the wrong question. The shape law is
 * about RADIUS, measured as drawn radius over drawn short side: it says a
 * control carrying text is a rounded rectangle and never a capsule, and it has
 * nothing to say about whether a control is a pill-shaped row or a square tile
 * with its mark above its word. `GOVERNING-10` screen four draws a three
 * across grid of tiles, mark over label, and that is a layout the law never
 * ruled on.
 *
 * SO BOTH ARE OBEYED HERE. `.nf-stays-tile` is the render's tile and it is on
 * `--nf-radius-control`, 14px on a tile whose short side is never under 56px,
 * a ratio of a quarter, which is a rounded rectangle by the law's own test.
 *
 * TWO TILES OF THE RENDER ARE ABSENT AND IT IS SAID IN `lib/host/facilities.ts`
 * RATHER THAN QUIETLY: "Restaurant" and "Airport shuttle" have no row in
 * `public.amenities`, so drawing them would be drawing a control that saves
 * nothing. That is the defect the property wizard shipped with, three codes in
 * the interface and none in the table, and it is not repeated here.
 */
export function FacilitiesPicker({
  accommodationId,
  chosen,
  picked: heldPicked,
  onPick,
}: {
  accommodationId: string;
  /** The codes on record. */
  chosen: readonly string[];
  /**
   * The ticked codes, when the wizard holds them (so Back keeps them and the
   * wizard can ask before they are lost). Left out, the picker holds its own.
   */
  picked?: readonly string[];
  onPick?: (codes: string[]) => void;
}) {
  const hw = useHostCopy();
  const locale = useClientLocale();
  const router = useRouter();
  const [ownPicked, setOwnPicked] = useState<Set<string>>(() => new Set(chosen));
  const picked = heldPicked ? new Set(heldPicked) : ownPicked;
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  /* Said by the one banner at the top of the screen (founder, 7 November 2026,
     "THE BANNER EVERYWHERE"); it was a line under the control. */
  useEffect(() => {
    if (notice) banner(notice.text, { tone: notice.tone === "error" ? "error" : "success" });
  }, [notice]);
  const [pending, start] = useSafeTransition();

  function toggle(code: string) {
    setNotice(null);
    const next = new Set(picked);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    if (onPick) onPick([...next]);
    else setOwnPicked(next);
  }

  function save() {
    setNotice(null);
    start(async () => {
      try {
        const result = await setAccommodationFacilities({
          accommodationId,
          codes: [...picked],
        });
        if (!result.ok) {
          setNotice({ tone: "error", text: result.error });
          return;
        }
        setNotice({
          tone: "ok",
          text:
            result.data.codes.length === 0
              ? "Saved. This property claims no facilities, so none is shown to a guest."
              : `Saved. ${countOf(result.data.codes.length, "facilities", locale)} on record.`,
        });
        router.refresh();
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  }

  return (
    <section className="nf-panel nf-panel--card block nf-host-group">
      <h2 className="nf-host-group__title">What the property offers</h2>
      <p className="nf-host-group__note">
        Only what a guest can actually use. A guest searching for parking or air conditioning is
        shown the places that claim them, so a claim that is not true is a bad review waiting.
      </p>

      {/* `--phrases`: these labels are phrases ("Air conditioning", "Backup
          power"), so the grid is two to a row on a phone. Three columns drew
          "Air conditioning" over five hyphenated lines at 320 and 360. */}
      <div className="nf-stays-tiles nf-stays-tiles--phrases" role="group" aria-label={hw.facilitiesLabel}>
        {STAY_FACILITIES.map((facility) => {
          const on = picked.has(facility.code);
          return (
            <button
              key={facility.code}
              type="button"
              aria-pressed={on}
              disabled={pending}
              className="nf-stays-tile items-center text-center"
              onClick={() => toggle(facility.code)}
            >
              <UiIcon name={facility.mark} size={24} className="shrink-0" />
              <span className="nf-stays-tile__title">{facility.label}</span>
            </button>
          );
        })}
      </div>

      <Button
        variant="secondary"
        size="lg"
        full
        className="mt-md"
        disabled={pending}
        loading={pending}
        onClick={save}
      >
        Save the facilities
      </Button>

    </section>
  );
}
