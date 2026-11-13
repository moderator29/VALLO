import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { panelClass } from "@/components/ui/Panel";
import { IconPlate } from "@/components/ui/IconPlate";
import { amenityLabel } from "@/components/app/filters/amenities";
import { ICON } from "@/components/app/Screen";
import "@/app/css/catalogue.css";

/**
 * The amenity tiles of 9E8B56ED: glass squares with a glyph and a word.
 *
 * Only what the lister stated. `limit` keeps the first row to the five the
 * render shows plus a "More" tile that jumps to the full list; with no limit
 * every amenity is drawn, which is what the Amenities section does.
 */
const AMENITY_ICON: Record<string, UiIconName> = {
  pool: "pool",
  wifi: "wifi",
  kitchen: "kitchen",
  parking: "parking",
  /* The listing's own security, never the verified tick: that glyph is the
     product's check mark and must not stand for a guard at a gate. */
  security: "shield-lock",
  generator: "bolt",
  /* Not the bolt: that is backup power, and the two sat side by side
     looking like the same amenity twice. */
  gym: "trending-up",
  ac: "snowflake",
  tv: "picture",
  furnished: "home",
  balcony: "building-apartment",
  garden: "map",
  laundry: "washing-machine",
  water: "droplet",
  shower: "bath",
  breakfast: "utensils",
  workspace: "document",
  elevator: "arrow-up",
};

export function ListingAmenityTiles({
  amenities,
  limit,
  moreHref,
  moreLabel,
  variant = "tiles",
}: {
  /**
   * "plates": the founder's reference row of 13 October 2026, a round
   * monochrome icon plate with the word under it, at most `limit` and then a
   * "+N" plate that leads to the full list. Built only from the listing's own
   * amenity codes, like the tiles.
   */
  variant?: "tiles" | "plates";
  amenities: string[];
  limit?: number;
  moreHref?: string;
  moreLabel?: string;
}) {
  if (amenities.length === 0) return null;
  const shown = limit ? amenities.slice(0, limit) : amenities;
  const remainder = amenities.length - shown.length;
  /*
   * THE LEAD ROW SCROLLS, THE SECTION WRAPS, and both tiles are small.
   *
   * The render draws six small square tiles across the lead card, each a
   * glyph over a two-line caption, and a "More" tile at the end. Ours were
   * three per row at 5rem tall with the label wrapping inside them, which
   * is the same information at three times the size and is what the
   * founder's send-back calls enormous. `limit` is what the lead row
   * passes, so it is also the signal that this is the scrolling row.
   */
  const row = limit !== undefined;
  if (variant === "plates") {
    /*
     * ONE ROW, AS THE REFERENCE DRAWS IT. A phone has room for five columns,
     * so it shows four plates and "+N"; from 30rem there are six columns and
     * the fifth plate joins them with a "+N" one smaller. The two "+N" links
     * are each `display: none` outside their own width, so only one is ever
     * in the page or in the accessibility tree.
     */
    const more = moreLabel ?? "More";
    const narrowRest = amenities.length - Math.min(shown.length, 4);
    const moreLink = (count: number, which: "narrow" | "wide") => (
      <li key={which} className={`nf-amenity-plate nf-amenity-plate--${which}`}>
        <a
          href={moreHref}
          className="nf-amenity-plate__more nf-tap"
          aria-label={`+${count} ${more}`}
          data-testid="amenity-plates-more"
        >
          {/* The neutral plate, like every plate beside it: the white solid
              disc read as a different control (founder, 13 November 2026). */}
          <IconPlate size="md" shape="round">
            <span className="nf-numeric">+{count}</span>
          </IconPlate>
          <span>{more}</span>
        </a>
      </li>
    );
    /* Without a limit it is the Amenities section's full list: the same
       plates, wrapping, so the page draws amenities one way only. */
    const capped = limit !== undefined;
    return (
      <ul
        className={capped ? "nf-amenity-plates" : "nf-amenity-plates nf-amenity-plates--all"}
        data-testid={capped ? "amenity-plates" : "amenity-plates-all"}
      >
        {shown.map((code, i) => (
          <li
            key={code}
            className={capped && i === 4 ? "nf-amenity-plate nf-amenity-plate--wide" : "nf-amenity-plate"}
            data-amenity={code}
          >
            <IconPlate size="md" shape="round">
              <UiIcon name={AMENITY_ICON[code] ?? "circle-check"} size={20} />
            </IconPlate>
            <span>{amenityLabel(code)}</span>
          </li>
        ))}
        {moreHref && narrowRest > 0 && shown.length > 4 && moreLink(narrowRest, "narrow")}
        {moreHref && remainder > 0 && moreLink(remainder, "wide")}
      </ul>
    );
  }
  return (
    <ul
      className={row ? "nf-amenity-row nf-scroll-x" : "nf-amenity-grid"}
      data-testid="amenity-tiles"
    >
      {shown.map((code) => (
        <li key={code} className={panelClass({ variant: "card", className: "nf-amenity-tile" })}>
          <UiIcon name={AMENITY_ICON[code] ?? "circle-check"} size={ICON.inline} />
          <span>{amenityLabel(code)}</span>
        </li>
      ))}
      {remainder > 0 && moreHref && (
        <li className="contents">
          <a href={moreHref} className={panelClass({ variant: "card", className: "nf-amenity-tile" })}>
            <UiIcon name="more" size={ICON.inline} />
            <span>
              {moreLabel ?? "More"} (+{remainder})
            </span>
          </a>
        </li>
      )}
    </ul>
  );
}
