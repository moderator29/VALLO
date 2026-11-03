import Link from "next/link";
import { WholePrefetchLink } from "@/components/app/WholePrefetchLink";
import { BrandIcon, type BrandIconName, type BrandIconProp } from "@/design-system/icons/BrandIcon";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { Icon3D } from "@/components/ui/Icon3D";
import type { Icon3DName } from "@/components/ui/icon-3d";
import { IconPlate, ICON_PLATE_GLYPH } from "@/components/ui/IconPlate";
import { panelClass } from "@/components/ui/Panel";
import "@/app/css/home.css";

/**
 * The category row, to `GOVERNING-01` screen one and `GOVERNING-09` screen
 * one: each category a 3D glass object standing on its own rounded plate with
 * its label underneath.
 *
 * FOUR, NOT FIVE, ON THE PROPERTY SIDE. The render draws Buy, Rent, Manage,
 * Short Let, Invest. "Short Let" does not ship here, because a shortlet is the
 * Stays side and putting the door on both sides is the same inconsistency
 * Track E exists to remove (roles README, translation 5).
 *
 * NO COUNTS. The render prints none, and the product rule is that the
 * tiles drop their counts rather than print a figure `platform_stats()` cannot
 * yet produce honestly. The render and the honesty rule agree, which is the
 * easiest kind of decision there is.
 *
 * EVERY DOOR IS A CONTAINER NOW (the founder, 25 September 2026): the shared
 * panel card with the glass object standing in it and the word under it, on
 * both sides. The four across on the property side used to be a lit icon
 * plate with the word outside it; that plate turned into a navy square on
 * white paper in light mode. In light the doors are also a little smaller,
 * and the object stands on the card alone with no ground behind it
 * (home.css).
 *
 * THE SHAPE LAW: the card is a rounded rectangle on the container radius and
 * the object inside it is artwork rather than a control, so nothing here is a
 * capsule however it is measured.
 */
export type HomeCategory = {
  key: string;
  label: string;
  /** The supporting line under the label, where the render draws one. */
  meaning?: string;
  href: string;
  icon: BrandIconName;
  /** The line glyph for the flat plate (`variant="plates"`). */
  glyph?: UiIconName;
  /**
   * The founder's 3D object for this door (30 September). Drawn in place of
   * the plate or the glass object, in the same fixed box, so a door is one
   * object and its word.
   */
  art?: Icon3DName;
  /** Fetch the page whole before the tap (`WholePrefetchLink`); for light pages only. */
  whole?: boolean;
  /**
   * A tiered object (D29, `object-assets.ts`) for the door, drawn in place of
   * `art` on the plates variant: a real place for a space you buy or rent, a
   * matte symbol for an idea such as paying or listing. Session 3, W2.
   */
  object?: BrandIconProp;
};

export function CategoryRow({
  categories,
  label,
  columns = 4,
  variant = "tiles",
}: {
  categories: readonly HomeCategory[];
  /** The accessible name of the row, because it is navigation. */
  label: string;
  /** Four across on the property side, two across on the Stays side. */
  columns?: 2 | 4;
  /**
   * "plates" (UIUX item 15; spec section 4): the doors as 44px neutral icon
   * plates with their words, a row in ONE white card, flat in both themes.
   * "tiles" is the older glass-object card per door, kept for the Stays
   * side until it moves too.
   */
  variant?: "tiles" | "plates";
}) {
  if (variant === "plates") {
    return (
      <nav aria-label={label} className="nf-rise nf-rise-4 mt-md">
        <ul className="nf-home-doors" data-columns={columns} data-testid="home-categories">
          {categories.map((category) => {
            const Door = category.whole ? WholePrefetchLink : Link;
            return (
              <li key={category.key} className="min-w-0">
                <Door href={category.href} className="nf-home-door group" data-testid={`home-category-${category.key}`}>
                  {category.object ? (
                    <span className="nf-home-door__object" data-object={category.object}>
                      <BrandIcon name={category.object} size={48} />
                    </span>
                  ) : category.art ? (
                    <span
                      className="grid size-12 place-items-center transition-transform duration-[var(--nf-duration-press,120ms)] group-active:scale-[0.94] motion-reduce:transition-none"
                      data-art={category.art}
                    >
                      <Icon3D classic name={category.art} size={48} />
                    </span>
                  ) : (
                    <IconPlate size="md" tone="neutral">
                      <UiIcon name={category.glyph ?? "home"} size={ICON_PLATE_GLYPH.md} />
                    </IconPlate>
                  )}
                  <span className="nf-home-door__label">{category.label}</span>
                </Door>
              </li>
            );
          })}
        </ul>
      </nav>
    );
  }
  return (
    <nav aria-label={label} className="nf-rise nf-rise-4 mt-md">
      <ul className="nf-cat-row" data-columns={columns} data-testid="home-categories">
        {categories.map((category) => {
          const Door = category.whole ? WholePrefetchLink : Link;
          return (
            <li key={category.key} className="min-w-0">
              <Door
                href={category.href}
                className={panelClass({ variant: "card", className: "nf-cat-tile nf-tap" })}
                data-testid={`home-category-${category.key}`}
              >
                <span className="nf-cat-tile__plate" aria-hidden="true" {...(category.art ? { "data-art": category.art } : {})}>
                  {category.art ? (
                    <Icon3D classic name={category.art} size={64} className="[--nf-icon3d-size:100%]" />
                  ) : (
                    <BrandIcon name={category.icon} fill drawn={64} />
                  )}
                </span>
                <span className="nf-cat-tile__label">{category.label}</span>
                {category.meaning && (
                  <span className="nf-cat-tile__meaning">{category.meaning}</span>
                )}
              </Door>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
