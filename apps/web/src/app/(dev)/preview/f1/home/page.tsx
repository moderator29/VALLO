import { getDictionary, type Locale } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { daypartFor, lagosHour, type HomeOverview } from "@/lib/app/home-queries";
import { HomeScreen } from "@/components/app/home/HomeScreen";
import { UpNextCard } from "@/components/app/home/UpNext";
import { pickUpNext } from "@/components/app/home/up-next";
import { PERSON } from "../../_fixtures/people";
import { LISTINGS } from "../listings";

/**
 * The in-app home as a signed-in person sees it, with the identity and the
 * listings from fixtures. The route itself needs a session, and the
 * catalogue cannot be read from this sandbox, so this renders the same
 * screen on the same shell width from fixture rows so the look can be
 * screenshotted here. Never the proof of the writes.
 */
export const dynamic = "force-dynamic";

export default async function PreviewHome({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale: Locale = await getLocale();
  /* `?upnext=1` draws the "Up next" card (plan item 15) from a fixture: the
     route itself only draws it from the account's own records. */
  const showUpNext = (await searchParams).upnext === "1";
  const t = getDictionary(locale);
  const listings = LISTINGS;

  const overview: HomeOverview = {
    daypart: daypartFor(lagosHour()),
    firstName: PERSON.name.split(" ")[0] ?? "",
    avatarUrl: PERSON.avatarUrl,
    unreadNotifications: 2,
    signedIn: true,
    place: {
      stateCode: "LA",
      stateName: "Lagos",
      lgaCode: "la_eti_osa",
      lgaName: "Lekki",
      label: "Lekki",
      context: "Lagos",
      isOwn: true,
    },
    areas: [],
    trending: [],
    askIntent: false,
  };

  /*
   * THE MARKET COUNT, CITY AND INVESTMENT FIXTURES STOOD HERE AND ARE GONE
   * WITH THE BLOCKS THEY FED.
   *
   * `GOVERNING-01` screen one draws a hero plate, four category tiles with no
   * counts on them, and one featured row. The nine market tiles, the cities
   * rail and the investment band are not on that screen, so the harness has
   * nothing left to hand them. The market reads (`market-queries.ts`) were
   * removed on 17 October with nothing calling them.
   */

  return (
    <main id="main" className="min-h-dvh pb-4xl">
      <div className="nf-shell py-section-tight">
        {/* `manageHref` is the chooser here, because a fixture holds no
            account and a harness must never imply one. See HomeScreen. */}
        <HomeScreen
          t={t}
          locale={locale}
          overview={overview}
          listings={listings}
          roles={[]}
          manageHref="/profile/setup"
          upNext={
            showUpNext ? (
              <UpNextCard
                copy={t.directHome.upNext}
                next={pickUpNext({
                  viewings: [
                    {
                      id: "preview-viewing",
                      state: "CONFIRMED",
                      slotAt: "2099-10-03T09:00:00Z",
                      listingTitle: LISTINGS[0]?.title ?? null,
                      counterpartName: "Tunde",
                    },
                  ],
                  stays: [
                    {
                      id: "preview-stay",
                      status: "PENDING",
                      title: "Shortlet in Lekki Phase 1",
                      checkIn: "2099-10-10",
                      checkOut: "2099-10-12",
                      dateRange: "Sat 10 Oct to Mon 12 Oct",
                    },
                  ],
                  threads: [
                    {
                      id: "preview-thread",
                      counterpartName: "Ada Okafor",
                      listingTitle: "Two bedroom flat in Yaba",
                      lastMessage: "Saturday at ten works. The gate code is on the listing.",
                      whenLabel: "09:40",
                      unread: 2,
                    },
                  ],
                })}
              />
            ) : null
          }
        />
      </div>
    </main>
  );
}
