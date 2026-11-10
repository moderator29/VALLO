import Link from "next/link";
import { countOf, getDictionary, type Dictionary, type Locale } from "@vallo/i18n";
import type { MyAccommodation, MyBusiness, MyRoomType } from "@/lib/host/queries";
import { EmptyState } from "@/components/app/Screen";
import { PageFrame } from "@/components/app/PageFrame";
import { ButtonLink } from "@/components/ui/Button";
import { RoomNightsEditor } from "@/components/host/RoomNightsEditor";

/**
 * The screen, apart from its reads, so the whole thing can be drawn from
 * fixtures in the preview harness and read against the register at 390 dark.
 */
export function HostRoomsBody({
  businesses,
  chosen,
  accommodation,
  rooms,
  locale,
  copy = getDictionary("en").hostWorkspace,
  words = getDictionary("en").experienceHost.rooms,
}: {
  businesses: MyBusiness[];
  chosen: MyBusiness | null;
  accommodation: MyAccommodation | null;
  rooms: MyRoomType[];
  locale: Locale;
  /** The host workspace words in the reader's language; English in the previews. */
  copy?: Dictionary["hostWorkspace"];
  /** The page's own words in the reader's language; English in the previews. */
  words?: Dictionary["experienceHost"]["rooms"];
}) {
  /* Every state sits under the Grade 1 page frame: the large title with
     Back, so the page always has its heading and its one way back. */
  if (!chosen) {
    return (
      <PageFrame title={words.title} fallback="/host">
        <EmptyState
          icon="hotel"
          title={copy.rooms.noPropertyTitle}
          body={copy.rooms.noPropertyBody}
          action={
            <ButtonLink href="/host/apply" variant="primary" size="lg">
              {copy.doors.startApplication}
            </ButtonLink>
          }
        />
      </PageFrame>
    );
  }

  if (!accommodation) {
    return (
      <PageFrame title={words.title} fallback="/host">
        <EmptyState
          icon="hotel"
          title={copy.rooms.saveFirstTitle}
          body={copy.rooms.saveFirstBody}
          action={
            <ButtonLink href="/host/apply" variant="primary" size="lg">
              {copy.doors.openApplication}
            </ButtonLink>
          }
        />
      </PageFrame>
    );
  }

  const onSale = rooms.filter((room) => room.nightsOnSale > 0).length;

  return (
    <PageFrame
      title={words.title}
      subtitle={(rooms.length === 0 ? words.noTypes : onSale === 0 ? words.noneOnSale : words.someOnSale)
        .replace("{name}", accommodation.name)
        .replace("{types}", countOf(rooms.length, "roomTypes", locale))
        .replace("{onSale}", String(onSale))}
      fallback="/host"
      /* Only drawn where there is a choice to make. One property is the
         common case and a picker above it would be furniture. */
      tabs={
        businesses.length > 1 ? (
          <nav className="flex flex-wrap gap-inline" aria-label={copy.rooms.propertiesLabel}>
            {businesses.map((business) => (
              <Link
                key={business.id}
                href={`/host/rooms?business=${business.id}`}
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
        {rooms.length === 0 ? (
          <EmptyState
            icon="hotel"
            title={copy.rooms.noRoomTypesTitle}
            body={copy.rooms.noRoomTypesBody}
            action={
              <ButtonLink href="/host/apply" variant="primary" size="lg">
                {words.addRoomType}
              </ButtonLink>
            }
          />
        ) : (
          <RoomNightsEditor rooms={rooms} locale={locale} />
        )}
      </div>
    </PageFrame>
  );
}
