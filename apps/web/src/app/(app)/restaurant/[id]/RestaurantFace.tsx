import type { ComponentProps } from "react";
import type { Dictionary, Locale } from "@vallo/i18n/core";
import { Amount } from "@/components/ui/Amount";
import { ButtonLink } from "@/components/ui/Button";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { ListingGallery } from "@/components/app/listing/ListingGallery";
import {
  DetailAboutCard,
  DetailCapsules,
  DetailPriceRow,
  DetailSpecStrip,
  type SpecPair,
} from "@/components/app/listing/DetailAnatomy";
import { ICON, Section, Stack, Surface, TYPE } from "@/components/app/Screen";
import { ReserveTable } from "../../listing/[id]/ReserveTable";
import { PlaceTabs } from "@/components/app/listing/PlaceTabs";
import { PlaceMapPanel } from "@/components/app/listing/PlaceMapPanel";
import { AnchorFoot } from "@/components/app/listing/AnchorFoot";
import { PhotoViewerProvider } from "@/components/app/listing/PhotoViewer";

/* The table card's id, for the anchored foot that scrolls to it. */
const TABLE_FORM_ID = "reserve-table";
import { panelClass } from "@/components/ui/Panel";
import { ReportSheet } from "@/components/app/ReportSheet";
import "@/app/css/catalogue.css";

const WEEKDAY: Record<number, string> = {
  0: "Sunday",
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
};

export type RestaurantFaceProps = {
  locale: Locale;
  t: Dictionary;
  /** The gallery exactly as the route mounts it (photos, plates, heart). */
  gallery: ComponentProps<typeof ListingGallery>;
  title: string;
  /** "Area, City", or empty when the venue gave neither. */
  where: string;
  /** The open-now line `lib/stays/hours` computes, or null with no windows. */
  hours: { openNow: boolean; label: string } | null;
  specPairs: SpecPair[];
  /** A stated price per head; null for a venue that states none. */
  price: { minor: number; currency: string } | null;
  rating: { average: string; reviews: string } | null;
  capsules: { key: string; icon: UiIconName; label: string }[];
  aboutParagraphs: string[];
  host: ComponentProps<typeof DetailAboutCard>["host"];
  /** The table form's target and deposit; its words and locale come from this face's own `t` and `locale`. */
  reserve: Omit<ComponentProps<typeof ReserveTable>, "copy" | "locale">;
  /** The venue's service windows, `HH:MM` or `HH:MM:SS`; null when unread. */
  windows: { id: string; weekday: number; opens: string; closes: string }[] | null;
  messageHref: string | null;
  /** The report control for this venue (STORE-P2-01): a catalogue listing is
      reported as a listing, an onboarded venue as a business. Absent in a
      static preview. */
  report?: { targetType: "listing" | "business"; targetId: string; signedIn: boolean };
  /** An example venue offers no table to hold. D24: it carries no label. */
  isExample?: boolean;
  /** The venue's point rounded to about a kilometre on the server, for the Map tab. */
  areaPoint?: { lat: number; lng: number } | null;
  /**
   * The venue's own table rules, in plain sentences (`tableRuleLines`): a
   * table is free to ask for and never paid in advance, the bill is paid at
   * the restaurant, and the notice, hold and sitting the venue set. Shown
   * before the guest asks for a table, so nothing about it is a surprise.
   */
  tableRules?: string[];
};

/**
 * THE RESTAURANT FACE, LIFTED OUT OF THE ROUTE SO ITS PROOF IS THE ROUTE.
 *
 * `/restaurant/[id]` reads two kinds of venue and flattens them into the props
 * below; everything it then draws lives here. The sweep's fixture harness
 * (`(dev)/preview/session-b/sweep-stays/restaurant`) mounts this same
 * component with fixture props, so the committed proof cannot drift from the
 * route again. It used to re-export an older harness that wrote its own lead
 * card on the pre-sweep 22px glass (the second audit's S-B).
 *
 * The anatomy is B047A0CE's third face of the one detail anatomy: the lit lead
 * card over the photograph, the bordered spec strip, the blue figure with its
 * unit and rating, the capsule row and the About card with its host row. What
 * differs is the foot: a restaurant's decision is a table, so the reservation
 * opens the run under the card and the week's hours close the page.
 */
export function RestaurantFace({
  locale,
  t,
  gallery,
  title,
  where,
  hours,
  specPairs,
  price,
  rating,
  capsules,
  aboutParagraphs,
  host,
  reserve,
  windows,
  messageHref,
  report,
  isExample = false,
  areaPoint,
  tableRules = [],
}: RestaurantFaceProps) {
  const copy = t.restaurantPage;
  const placeCopy = t.catalogue.stays.place;
  return (
    <PhotoViewerProvider title={title} photos={gallery.photos} hue={gallery.hue} kind="restaurant">
    <div className="nf-cat-surface">
      <ListingGallery {...gallery} />

      <div className="mx-auto max-w-2xl px-gutter pb-section">
        <div className={panelClass({ variant: "card", className: "nf-detail-lead relative z-10 -mt-xl block sm:-mt-2xl" })}>
          <div className="flex flex-wrap items-center gap-xs empty:hidden">
            {hours && (
              <span className={`nf-reg-open ${hours.openNow ? "nf-reg-open--open" : "nf-reg-open--closed"}`} data-testid="open-now">
                <UiIcon name="history" size={12} />
                {hours.label}
              </span>
            )}
          </div>
          <h1 className="nf-h2 mt-row [text-wrap:balance]">{title}</h1>
          {where && (
            <p className={`mt-inline-tight flex items-center gap-inline-tight ${TYPE.body}`}>
              <UiIcon name="location" size={ICON.inline} className="shrink-0 text-[var(--nf-brand-secondary)]" />
              {where}
            </p>
          )}

          <DetailSpecStrip pairs={specPairs} />

          {price && price.minor > 0 && (
            <DetailPriceRow
              figure={<Amount minorUnits={price.minor} locale={locale} currency={price.currency} />}
              unit={copy.perHead}
              /* Real rows only: the rating is averaged from `reviews`, so this
                 is absent until somebody has actually reviewed the venue. */
              rating={rating}
            />
          )}

          <DetailCapsules items={capsules} label={t.catalogue.detail.amenities} />
        </div>

        <div className="mt-block">
          <DetailAboutCard title={copy.aboutTitle} paragraphs={aboutParagraphs} host={host} />
        </div>

        {/* THE TABLE AND ITS MAP (the travel-app reference): one switch, the
            reservation on one side and the area, its hours and the photo
            tour on the other. One table card, under one heading. */}
        <div className="mt-block">
          <PlaceTabs
            label={title}
            labels={{ main: copy.tabTable, map: placeCopy.tabMap }}
            map={
              <PlaceMapPanel
                lead={placeCopy.mapLeadTable}
                coords={areaPoint ?? null}
                area={where}
                unavailable={placeCopy.mapUnavailable.replace("{area}", where)}
                facts={[
                  ...(where ? [{ key: "area", icon: "location" as const, label: placeCopy.area, value: where }] : []),
                  ...(hours ? [{ key: "hours", icon: "history" as const, label: copy.openNowTitle, value: hours.label }] : []),
                ]}
                photoTour={
                  gallery.photos.length > 0
                    ? {
                        label: placeCopy.photoTour,
                        caption: placeCopy.photos.replace("{count}", String(gallery.photos.length)),
                        count: gallery.photos.length,
                      }
                    : null
                }
              />
            }
            main={
              <Stack>
                {isExample ? (
                  <Section title={copy.reserveTitle}>
                    <Surface>
                      <p className={TYPE.rowMeta} data-testid="restaurant-not-bookable">
                        {t.experienceDetail.closed.restaurantBody}
                      </p>
                      <ButtonLink href="/restaurants" variant="primary" className="mt-row w-full">
                        {t.experienceDetail.closed.restaurantAction}
                      </ButtonLink>
                    </Surface>
                  </Section>
                ) : (
                  <Section title={copy.reserveTitle} description={copy.reserveBody}>
                    {/* THE WINDOW PICKER: the times on offer are the ones inside
                        the hours this venue publishes, for the day picked. The
                        card carries no second title under this heading. */}
                    <ReserveTable
                      {...reserve}
                      title={null}
                      formId={TABLE_FORM_ID}
                      windows={windows ?? undefined}
                      windowCopy={t.experienceDetail.window}
                      success={t.success}
                      copy={t.memberFlows}
                      locale={locale}
                    />
                    {tableRules.length > 0 && (
                      <ul className="mt-row grid gap-inline-tight" data-testid="table-rules">
                        {tableRules.map((line) => (
                          <li key={line} className={TYPE.rowMeta}>
                            {line}
                          </li>
                        ))}
                      </ul>
                    )}
                  </Section>
                )}

                {/*
                  THE HOURS. `lib/stays/hours` answers "is it seating right now"
                  on the Lagos clock from the venue's own service windows. A
                  venue that has published no windows says so plainly, never a
                  guessed "Open now" that sends somebody to a locked door.
                */}
                <Section title={copy.hoursTitle}>
                  <Surface>
                    {hours && (
                      <p
                        className={`nf-reg-open ${hours.openNow ? "nf-reg-open--open" : "nf-reg-open--closed"} mb-row`}
                        data-testid="hours-open-now"
                      >
                        <UiIcon name="history" size={12} />
                        {hours.label}
                      </p>
                    )}
                    {windows && windows.length > 0 ? (
                      <ul className="divide-y divide-[var(--nf-divider)]" data-testid="service-windows">
                        {windows.map((window) => (
                          <li key={window.id} className={`flex items-center justify-between gap-sm py-xs ${TYPE.body}`}>
                            <span className="font-semibold text-[var(--nf-content-primary)]">{WEEKDAY[window.weekday] ?? window.weekday}</span>
                            <span className="nf-numeric">
                              {window.opens.slice(0, 5)} to {window.closes.slice(0, 5)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <>
                        <p className={TYPE.body}>{copy.hoursUnknown}</p>
                        <p className={`mt-row ${TYPE.rowMeta}`}>{copy.hoursAsk}</p>
                        {messageHref && (
                          <ButtonLink href={messageHref} variant="secondary" className="mt-row">
                            {copy.message}
                          </ButtonLink>
                        )}
                      </>
                    )}
                  </Surface>
                </Section>

                {report && (
                  <div className="py-md" data-testid="restaurant-report">
                    <ReportSheet
                      targetType={report.targetType}
                      targetId={report.targetId}
                      targetLabel={title}
                      signedIn={report.signedIn}
                    />
                  </div>
                )}
              </Stack>
            }
          />
        </div>
      </div>

      {/* THE ONE ANCHORED ACTION: it takes the guest to the table card and
          steps aside while the card is on screen (`AnchorFoot`). */}
      {isExample ? null : (
        <AnchorFoot
          targetId={TABLE_FORM_ID}
          label={copy.reserveTitle}
          figure={price && price.minor > 0 ? <Amount minorUnits={price.minor} locale={locale} currency={price.currency} /> : undefined}
          caption={price && price.minor > 0 ? copy.perHead : copy.reserveFootCaption}
        />
      )}
    </div>
    </PhotoViewerProvider>
  );
}
