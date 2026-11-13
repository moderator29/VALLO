import Link from "next/link";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { MapPillFlag } from "./MapPillFlag";
import "@/app/css/catalogue.css";
import "@/app/css/list-views.css";

/**
 * The floating Map / List switch on a phone (Track M), the pattern every
 * serious property app settled on: one lit pill above the dock that flips the
 * shelf between the results and the map. A link, not a button, because the
 * view lives in the address. From 640px it is hidden and the bar's toggle
 * does the job (list-views.css).
 *
 * It rises in once when the shelf arrives and presses at 0.98; reduced motion
 * gets neither.
 */
export function MapListPill({ href, to }: { href: string; to: "map" | "list" }) {
  return (
    <>
      {to === "map" ? <MapPillFlag /> : null}
      <Link href={href} prefetch data-testid="map-list-pill" data-to={to} className="nf-maplist-pill nf-m-press">
        <UiIcon name={to === "map" ? "map" : "grid"} size={20} aria-hidden />
        {to === "map" ? "Map" : "List"}
      </Link>
    </>
  );
}
