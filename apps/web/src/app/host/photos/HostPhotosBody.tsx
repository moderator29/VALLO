import Link from "next/link";
import { countOf, getDictionary, type Dictionary, type Locale } from "@vallo/i18n";
import type { MyAccommodation, MyBusiness } from "@/lib/host/queries";
import type { BusinessPhoto } from "@/lib/stays/business-photos";
import type { AccommodationPhoto } from "@/lib/stays/accommodation-photos";
import { EmptyState } from "@/components/app/Screen";
import { PageFrame } from "@/components/app/PageFrame";
import { ButtonLink } from "@/components/ui/Button";
import { BusinessPhotoManager } from "@/components/host/BusinessPhotoManager";
import { AccommodationPhotoManager } from "@/components/host/AccommodationPhotoManager";

/**
 * The screen, apart from its reads, so the whole thing can be drawn from
 * fixtures in the preview harness and read against the register at 390 dark.
 */
export function HostPhotosBody({
  userId,
  businesses,
  chosen,
  photos,
  accommodation = null,
  propertyPhotos = [],
  copy = getDictionary("en").hostWorkspace,
  words = getDictionary("en").experienceHost,
  locale = "en",
}: {
  userId: string;
  businesses: MyBusiness[];
  chosen: MyBusiness | null;
  /** The venue's own photographs, on the business spine. */
  photos: BusinessPhoto[];
  /** The property under the chosen business, when it has one. */
  accommodation?: MyAccommodation | null;
  /** That property's photographs, on the accommodation spine. */
  propertyPhotos?: AccommodationPhoto[];
  /** The host workspace words in the reader's language; English in the previews. */
  copy?: Dictionary["hostWorkspace"];
  /** The page's own words in the reader's language; English in the previews. */
  words?: Dictionary["experienceHost"];
  /** The reader's language, for the count; English in the previews. */
  locale?: Locale;
}) {
  /* Every state sits under the Grade 1 page frame: the large title with
     Back, so the page always has its heading and its one way back. */
  if (!chosen) {
    return (
      <PageFrame title={words.screens.photos} fallback="/host">
        <EmptyState
          icon="camera"
          title={copy.photos.noVenueTitle}
          body={copy.photos.noVenueBody}
          action={
            <ButtonLink href="/host/apply" variant="primary" size="lg">
              {copy.doors.startApplication}
            </ButtonLink>
          }
        />
      </PageFrame>
    );
  }

  /* The subject of this screen: the property when there is one, the venue
     itself when there is not. One count and one sentence, so the heading never
     describes one spine while the manager below writes to the other. */
  const onRecord = accommodation ? propertyPhotos.length : photos.length;
  const subjectName = accommodation ? accommodation.name : chosen.name;

  return (
    <PageFrame
      title={words.screens.photos}
      subtitle={onRecord === 0 ? words.photosNone.replace("{name}", subjectName) : `${subjectName}${countOf(onRecord, "photographsOnRecord", locale)}`}
      fallback="/host"
      /* Only drawn where there is a choice to make. One venue is the common
         case and a picker above it would be furniture. */
      tabs={
        businesses.length > 1 ? (
          <nav className="flex flex-wrap gap-inline" aria-label={copy.photos.venuesLabel}>
            {businesses.map((business) => (
              <Link
                key={business.id}
                href={`/host/photos?business=${business.id}`}
                className={`nf-chip${business.id === chosen.id ? " nf-chip--active" : ""}`}
                aria-current={business.id === chosen.id ? "page" : undefined}
              >
                {business.name}
              </Link>
            ))}
          </nav>
        ) : undefined
      }
    >
      <div>
        {accommodation ? (
          <AccommodationPhotoManager
            accommodationId={accommodation.id}
            userId={userId}
            photos={propertyPhotos.map((photo) => ({ id: photo.id, url: photo.url }))}
          />
        ) : chosen.kind === "restaurant" ? (
          <BusinessPhotoManager
            businessId={chosen.id}
            userId={userId}
            photos={photos.map((photo) => ({ id: photo.id, url: photo.url }))}
          />
        ) : (
          /* A stays business whose property has not been saved yet. The
             photographs hang on the property, so there is one thing to do
             first and it is named rather than drawn as an empty grid. */
          <EmptyState
            icon="camera"
            title={copy.photos.saveFirstTitle}
            body={copy.photos.saveFirstBody}
            action={
              <ButtonLink href="/host/apply" variant="primary" size="lg">
                {copy.doors.openApplication}
              </ButtonLink>
            }
          />
        )}
      </div>
    </PageFrame>
  );
}
