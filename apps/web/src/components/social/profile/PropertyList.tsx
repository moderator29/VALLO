import Link from "next/link";
import { formatMoney } from "@vallo/i18n/core";
import { UiIcon } from "@/design-system/icons/UiIcon";
import type { PropertyCard } from "@/lib/social/profile-tabs-queries";
import { RemoteImage } from "@/components/ui/RemoteImage";
import { countOf } from "@vallo/i18n/core";

/**
 * An agent's live places, on their own page.
 *
 * A plate rather than a row: somebody looking at an agent's Properties tab is
 * looking for a flat, and a flat is a photograph first. The facts underneath
 * are the four that decide whether to tap: what it is, where it is, how much,
 * and how many rooms.
 *
 * Money goes through `formatMoney` and nothing here divides by 100. The column
 * is integer kobo and it stays that way until the moment it is printed.
 */
export function PropertyList({ properties }: { properties: PropertyCard[] }) {
  return (
    <ul className="flex flex-col gap-[var(--nf-social-gap)]">
      {properties.map((property) => (
        <li key={property.id}>
          <Link href={`/listing/${property.id}`} className="nf-panel nf-panel--card nf-post nf-post--listing">
            {property.photoUrl ? (
              <RemoteImage
                src={property.photoUrl}
                alt=""
                width={800}
                height={600}
                sizes="(max-width: 640px) 100vw, 640px"
                className="nf-post__plate"
                loading="lazy"
              />
            ) : null}
            <div className="nf-post__under">
              <p className="text-[length:var(--nf-text-body)] font-bold tracking-[-0.015em] text-[var(--nf-content-primary)]">
                {property.title}
              </p>
              <p className="mt-2xs inline-flex items-center gap-2xs text-[length:var(--nf-text-caption)] text-[var(--nf-content-primary)]">
                <UiIcon name="location" size={13} />
                {[property.area, property.city].filter(Boolean).join(", ")}
              </p>
              <div className="mt-sm flex flex-wrap items-center justify-between gap-sm">
                <p className="nf-numeric text-[length:var(--nf-text-body-lg)] font-bold tracking-[-0.03em] text-[var(--nf-content-primary)]">
                  {formatMoney(property.priceMinor, "en")}{" "}
                  <span className="text-[length:var(--nf-text-overline)] font-normal tracking-normal text-[var(--nf-content-muted)]">
                    {property.pricePeriod === "year" ? "a year" : "a night"}
                  </span>
                </p>
                <p className="text-[length:var(--nf-text-overline)] text-[var(--nf-content-primary)]">
                  {countOf(property.bedrooms, "bedrooms")}
                  {" · "}
                  {countOf(property.bathrooms, "bathrooms")}
                </p>
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
