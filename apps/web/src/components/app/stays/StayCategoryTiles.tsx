import Link from "next/link";
/* C12: the tiles' sheet, out of `globals.css` (the host set-up loads it from `app/host/layout.tsx`). */
import "@/app/css/catalogue.css";
import "@/app/css/stays.css";
import type { Dictionary } from "@vallo/i18n/core";
import { BrandIcon, type BrandIconProp } from "@/design-system/icons/BrandIcon";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { Icon3D } from "@/components/ui/Icon3D";
import type { Icon3DName } from "@/components/ui/icon-3d";
import { panelClass } from "@/components/ui/Panel";

/**
 * The five category tiles of FD3DFE84, each with its 3D object (the founder,
 * 13 October 2026: no thin line icons here). The hotel is the clay hotel the
 * Stays home draws on its Hotels door; the other four are from the realistic
 * set the Property side draws, so both sides read as one family.
 *
 * `type` rides the stays search URL and narrows the projection by its `kind`
 * column (see /stays/search). The tile for the type in the address lights.
 */
export type StayCategory = {
  key: keyof Pick<Dictionary["catalogue"]["stays"], "hotels" | "apartments" | "resorts" | "guestHouses" | "serviced">;
  /** The clay 3D object, or the realistic one (`object`); exactly one is set. */
  art?: Icon3DName;
  object?: BrandIconProp;
  type: string;
};

export const STAY_CATEGORY_TILES: readonly StayCategory[] = [
  { key: "hotels", object: "hotel", type: "hotel" },
  { key: "apartments", object: "apartment-block", type: "apartment" },
  { key: "resorts", object: "stilt-beach-house", type: "resort" },
  { key: "guestHouses", object: "bungalow", type: "guest_house" },
  { key: "serviced", object: "serviced-block", type: "serviced_apartments" },
];

export function StayCategoryTiles({ t, active }: { t: Dictionary; active?: string }) {
  const copy = t.catalogue.stays;
  return (
    <ul className="nf-stays-tiles nf-scroll-x" data-testid="stay-category-tiles">
      {STAY_CATEGORY_TILES.map((tile) => {
        const on = active === tile.type;
        return (
          <li key={tile.key}>
            <Link
              href={`/stays/search?type=${tile.type}`}
              aria-current={on ? "true" : undefined}
              className={panelClass({ variant: "card", className: `nf-stays-tile ${on ? "nf-stays-tile--on" : ""}` })}
            >
              <span className="grid size-12 shrink-0 place-items-center" aria-hidden="true" data-art={tile.art ?? tile.object} data-host-plate>
                {tile.art ? <Icon3D classic name={tile.art} size={56} /> : tile.object ? <BrandIcon name={tile.object} size={56} preferRender /> : null}
              </span>
              <span>{copy[tile.key]}</span>
              <UiIcon name="arrow-right" size={16} className="nf-stays-tile__go" aria-hidden />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
