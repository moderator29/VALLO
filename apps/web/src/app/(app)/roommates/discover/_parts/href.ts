import { ROOMMATES_ROUTES, filtersQuery, type PeopleFilters, type RoomFilters } from "@/lib/features/roommates/model";

export type Mode = "people" | "rooms";
export type Draft = Partial<PeopleFilters & RoomFilters>;

/** The address for a mode and its filters; a rooms search keeps "Best match", which `filtersQuery` leaves to the default. */
export function discoverHref(mode: Mode, f: Draft): string {
  let q = filtersQuery({ ...f, mode });
  if (mode === "rooms" && f.sort === "match") q += q ? "&sort=match" : "?sort=match";
  if (mode === "people" && f.sort === "newest") q += q ? "&sort=newest" : "?sort=newest";
  return `${ROOMMATES_ROUTES.discover}${q}`;
}

