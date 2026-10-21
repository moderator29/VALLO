import { getDictionary } from "@vallo/i18n";
import { formatDate } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { InspectionHero, InspectionSheet } from "@/components/app/inspections/InspectionSheet";
import { VisitCalendar } from "@/components/agent/visit-calendar/VisitCalendar";
import { ViewingWindows } from "@/components/agent/ViewingWindows";
import { SaturdayRoute } from "@/components/agent/SaturdayRoute";
import { routeFor } from "@/lib/viewings/route";
import { LISTER_INSPECTIONS, LISTER_ROWS, TODAY } from "../fixtures";

/**
 * The lister's visit calendar (/agent/inspections) from fixtures, on the
 * pinned Tuesday 13 October 2026. The calendar, the rows and the sheet are
 * the page's own components; only the data is invented. `?empty=1` draws the
 * calendar with no visits at all.
 */
export const dynamic = "force-dynamic";

export default async function PreviewListerVisits({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const locale = await getLocale();
  const t = getDictionary(locale);
  const empty = params.empty === "1";
  const rows = empty ? [] : LISTER_ROWS;
  const sheets = Object.fromEntries(
    LISTER_INSPECTIONS.map((one) => [
      one.id,
      <InspectionSheet key={one.id} inspection={one} side="lister" facts={null} locale={locale} open now={Date.parse(`${TODAY}T08:00:00Z`)} viewingCopy={t.threads.rental} flowCopy={t.memberFlows.inspection} />,
    ]),
  );
  const route = routeFor(
    LISTER_INSPECTIONS.filter((one) => one.state === "CONFIRMED" && one.slotAt?.startsWith(TODAY)).map((one) => ({
      inspectionId: one.id,
      listingId: one.listingId,
      listingTitle: one.listingTitle,
      area: "Yaba",
      slotAt: one.slotAt!,
      counterpartName: one.counterpartName,
      conversationId: null,
    })),
  );
  const aside = (
    <>
      <ViewingWindows
        windows={[
          { id: "w1", listingIds: ["a", "b", "c"], weekday: 6, starts: "10:00", ends: "14:00", slotMinutes: 30 },
          { id: "w2", listingIds: ["a"], weekday: 3, starts: "16:00", ends: "18:00", slotMinutes: 20 },
        ]}
        homes={[{ id: "a", title: "Two bed flat, Sabo" }]}
        copy={t.frontDoor.viewings}
        locale={locale}
        className=""
      />
      <SaturdayRoute
        dayLabel={formatDate(new Date(`${TODAY}T12:00:00+01:00`), locale, { weekday: "long", day: "numeric", month: "short", timeZone: "Africa/Lagos" })}
        route={route}
        next={null}
        copy={t.frontDoor.viewings}
        locale={locale}
        className=""
      />
    </>
  );

  return (
    <div className="nf-shell py-section-tight">
      <div className="nf-console">
        <InspectionHero back={false} sub="Check the property, confirm details, submit your report." />
        <VisitCalendar
          rows={rows}
          sheets={sheets}
          today={TODAY}
          copy={t.visitOps}
          locale={locale}
          aside={aside}
          notice={
            empty ? (
              <div className="nf-vcal-card">
                <p className="nf-h4">{t.visitOps.calendar.noneTitle}</p>
                <p className="mt-inline nf-body-sm text-[var(--nf-content-secondary)]">{t.visitOps.calendar.noneBody}</p>
              </div>
            ) : null
          }
        />
      </div>
    </div>
  );
}
