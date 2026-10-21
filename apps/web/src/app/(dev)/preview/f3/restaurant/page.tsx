import { getDictionary, formatNumber, type Locale } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { Amount } from "@/components/ui/Amount";
import { ButtonLink } from "@/components/ui/Button";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { ListingGallery } from "@/components/app/listing/ListingGallery";
import {
  DetailAboutCard,
  DetailCapsules,
  DetailPriceRow,
  DetailSpecStrip,
} from "@/components/app/listing/DetailAnatomy";
import { ICON, Section, Stack, Surface, TYPE } from "@/components/app/Screen";
import { ReserveTable } from "@/app/(app)/listing/[id]/ReserveTable";
import { RESTAURANT_PLATES } from "@/components/app/stays/restaurant-plates";

/**
 * The restaurant face: the third face of the one detail anatomy, composed
 * from the same parts the route mounts. The lit lead card carries the
 * open-now line, the name, the place, the bordered spec strip, the typical
 * spend with its rating and the capsule row; the About card carries the
 * venue's words and its host row; the reservation opens the run beneath it
 * and the hours close the page.
 *
 * The venue here is the fixture restaurant with service windows, so the
 * open-now line is the real one `lib/stays/hours` computes on the Lagos
 * clock rather than a drawn pill.
 */
export default async function RestaurantFacePreview() {
  const locale: Locale = await getLocale();
  const t = getDictionary(locale);
  const copy = t.restaurantPage;
  const id = "00000000-0000-4000-8000-00000000f351";
  const title = "The Lagoon Kitchen";
  const where = "Ikoyi, Lagos";
  const hours = { openNow: true, label: "Open until 23:00" };
  const windows = [
    { id: "w1", weekday: 4, opens: "12:00", closes: "23:00" },
    { id: "w2", weekday: 5, opens: "12:00", closes: "23:30" },
    { id: "w3", weekday: 6, opens: "10:00", closes: "23:30" },
  ];
  const messageHref = `/messages/new?listing=${id}`;

  return (
    <div>
      <ListingGallery
        listingId={id}
        title={title}
        hue={0}
        kind="restaurant"
        photos={[]}
        plates={RESTAURANT_PLATES as string[]}
        backFallback="/preview/f3/restaurants"
        mark={{ label: t.stays.restaurantsTitle, icon: "utensils" }}
      />

      <div className="mx-auto max-w-2xl px-gutter pb-section">
        <div className="nf-glass nf-glass--card nf-detail-lead relative z-10 -mt-xl sm:-mt-2xl">
          <div className="flex flex-wrap items-center gap-xs">
            <span className="nf-reg-open nf-reg-open--open" data-testid="open-now">
              <UiIcon name="history" size={12} />
              {hours.label}
            </span>
          </div>
          <h1 className="nf-h2 mt-row [text-wrap:balance]">{title}</h1>
          <p className={`mt-inline-tight flex items-center gap-inline-tight ${TYPE.body}`}>
            <UiIcon name="location" size={ICON.inline} className="shrink-0 text-[var(--nf-brand-secondary)]" />
            {where}
          </p>

          <DetailSpecStrip
            pairs={[
              { key: "cuisine", icon: "utensils", label: "Nigerian" },
              { key: "dress", icon: "user", label: "Smart casual" },
              { key: "covers", icon: "grid", label: copy.covers.replace("{count}", "80") },
            ]}
          />

          <DetailPriceRow
            figure={<Amount minorUnits={25_000_00} locale={locale} />}
            unit={copy.perHead}
            rating={{
              average: formatNumber(4.7, locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
              reviews: t.catalogue.stays.reviews.replace("{count}", formatNumber(64, locale)),
            }}
          />

          <DetailCapsules
            label={t.catalogue.detail.amenities}
            items={[
              { key: "parking", icon: "parking", label: copy.parking },
              { key: "power", icon: "bolt", label: copy.backupPower },
              { key: "outdoor", icon: "map", label: copy.outdoor },
              { key: "grill", icon: "utensils", label: "Grill" },
            ]}
          />
        </div>

        <div className="mt-block">
          <DetailAboutCard
            title={copy.aboutTitle}
            paragraphs={[
              "The Lagoon Kitchen is in Ikoyi and serves Nigerian cooking over the water, with an open grill and a terrace that seats eighty.",
            ]}
            host={{
              name: "Lagoon Hospitality",
              role: t.stays.restaurantsTitle,
              verified: true,
              verifiedLabel: t.catalogue.detail.verifiedHost,
              messageHref,
              messageLabel: t.catalogue.detail.message,
            }}
          />
        </div>

        <Stack className="mt-block">
          <Section title={copy.reserveTitle} description={copy.reserveBody}>
            <ReserveTable listingId={id} messageHref={messageHref} copy={t.memberFlows} locale={locale} />
          </Section>

          <Section title={copy.hoursTitle}>
            <Surface>
              <p className="nf-reg-open nf-reg-open--open mb-row" data-testid="hours-open-now">
                <UiIcon name="history" size={12} />
                {hours.label}
              </p>
              <ul className="divide-y divide-[var(--nf-divider)]" data-testid="service-windows">
                {windows.map((window) => (
                  <li key={window.id} className={`flex items-center justify-between gap-sm py-xs ${TYPE.body}`}>
                    <span className="font-medium text-[var(--nf-content-primary)]">
                      {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][window.weekday]}
                    </span>
                    <span className="nf-numeric">
                      {window.opens} to {window.closes}
                    </span>
                  </li>
                ))}
              </ul>
              <ButtonLink href={messageHref} variant="secondary" className="mt-row">
                {copy.message}
              </ButtonLink>
            </Surface>
          </Section>
        </Stack>
      </div>
    </div>
  );
}
