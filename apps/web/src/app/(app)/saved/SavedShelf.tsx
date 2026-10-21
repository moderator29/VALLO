import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import type { ListingKind } from "@/lib/listings/types";
import { MediaFrame } from "@/components/app/MediaFrame";

/**
 * ONE SAVED PLACE AS AN OBJECT ON A SHELF (the founder's
 * `before-after-collection-shelves.jpg`, the "after" frame, and
 * ONE-PRODUCT-DECISIONS recommendation 6: things you own are collected, not
 * listed).
 *
 * A framed square thumbnail, the name with its area under it, the figure
 * right aligned in tabular ink with its unit grey, and one status word under
 * the figure, then a lit ledge under the whole object. The status word is
 * only ever a fact this row holds: "Verified" in the success ink when a
 * person checked the place, otherwise the market it is offered on, muted.
 *
 * The whole object is one link to the place, and its words are its name: no
 * aria-label over them, so a screen reader hears the title, the area, the
 * price and the status the eye reads (WCAG 2.5.3, label in name; an "Open
 * {title}" label used to hide the price and the status from it).
 *
 * Remove stays where the board
 * puts it (a swipe on touch and the quiet control under the shelf), because
 * a link may not hold a button.
 */
export function SavedShelf({
  href,
  title,
  where,
  photo,
  hue,
  kind,
  figure,
  status,
  verified,
  eager = false,
}: {
  href: string;
  title: string;
  where: string;
  photo: string | null;
  hue: number;
  kind: ListingKind;
  /** The price, already formatted by the page (figure in ink, unit grey). */
  figure: ReactNode;
  status: string;
  verified: boolean;
  eager?: boolean;
}) {
  return (
    <Link href={href} className="nf-shelf" data-testid="saved-shelf">
      <span className="nf-shelf__frame" aria-hidden="true">
        <span className="nf-shelf__thumb">
          {photo ? (
            <Image
              src={photo}
              alt=""
              fill
              sizes="72px"
              className="object-cover"
              {...(eager ? ({ loading: "eager", fetchPriority: "high" } as const) : {})}
            />
          ) : (
            <MediaFrame hue={hue} kind={kind} sizes="72px" />
          )}
        </span>
      </span>
      <span className="nf-shelf__words">
        <span className="nf-shelf__title">{title}</span>
        <span className="nf-shelf__where">{where}</span>
      </span>
      <span className="nf-shelf__value">
        <span className="nf-shelf__figure nf-numeric">{figure}</span>
        <span className="nf-shelf__status" data-verified={verified || undefined}>
          {status}
        </span>
      </span>
    </Link>
  );
}
