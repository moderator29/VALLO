import { cache } from "react";
import { catalogueReader } from "../catalogue/listings";

/**
 * ONE LOOKUP PER REQUEST (Track M performance), FROM THE SHARED CACHE
 * (platform speed, 13 November 2026).
 *
 * The listing page read its listing twice, once for the metadata and once for
 * the page, and the stay and restaurant routes read it a third time before
 * handing over to the listing page when there is no accommodation or
 * restaurant row. React's `cache` shares one read across a request.
 *
 * The read itself is the published listing as a stranger sees it, so it comes
 * from the catalogue cache (`lib/catalogue/listings.ts`): three round trips in
 * series (the row, then its reviews, badges and lister, then its compound,
 * service and unit facts) are paid once per edit, not once per reader. A write
 * through this app expires it at once (`catalogueChanged`).
 */
export const listingById = cache((id: string) => catalogueReader().byId(id));
