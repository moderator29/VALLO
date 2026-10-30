"use client";

import { useEffect } from "react";
import { rememberListing } from "@/lib/search/memory";

/**
 * Puts a stay or a restaurant in the phone's "Looked at recently" memory.
 * Renders nothing. The listing page does the same with `RecordVisit`; this is
 * for the two place pages that are not listings, with the address they open at.
 */
export function RecordPlaceVisit({
  id,
  title,
  place,
  photo,
  href,
}: {
  id: string;
  title: string;
  place: string;
  photo: string | null;
  href: string;
}) {
  useEffect(() => {
    rememberListing({ id, title, place, photo, price: null, priceNote: "", mark: null, href });
  }, [id, title, place, photo, href]);
  return null;
}
