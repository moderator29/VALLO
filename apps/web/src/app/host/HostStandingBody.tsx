import type { ReactNode } from "react";
import Link from "next/link";
import { countOf, DEFAULT_LOCALE, getDictionary, type Locale } from "@vallo/i18n";
import type { MyBusiness } from "@/lib/host/queries";
import { missingFrom, type HostDraft } from "@/lib/host/onboarding";
import { EmptyState, Row, RowList, Stack, TYPE } from "@/components/app/Screen";
import { ButtonLink } from "@/components/ui/Button";
import { StatusPill, toneForStatus } from "@/components/ui/StatusPill";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import { Unfold } from "@/components/ui/Unfold";
import { HostTodayView } from "./HostTodayView";
import type { HostToday } from "./today";
import { IconPlate } from "@/components/ui/IconPlate";

/**
 * Where a host stands, apart from its reads.
 *
 * Separated so the whole screen can be rendered from fixtures in the preview
 * harness and read against the register at 390 dark. The route passes exactly
 * what it read; nothing here fetches anything.
 */
export function HostStandingBody({
  businesses,
  draft: open,
  locale = DEFAULT_LOCALE,
  today,
  figure,
  dashboard,
  t = getDictionary(locale),
}: {
  businesses: MyBusiness[];
  locale?: Locale;
  /** The application still in progress, or null when there is none. */
  draft: HostDraft | null;
  /** The workspace home's figures (`hostToday`), computed from the host's rows. */
  today: HostToday;
  /** The figure card (reference 5); omitted, none is drawn. */
  figure?: ReactNode;
  /** The hotel and restaurant dashboards, drawn under the band. */
  dashboard?: ReactNode;
  t?: ReturnType<typeof getDictionary>;
}) {
  const missing = open ? missingFrom(open) : [];
  const words = t.experienceHost;
  const home = words.home;
  const statusWord = (status: string) => words.businessStatus[status as keyof typeof words.businessStatus] ?? status;
  const stoppedMeans = (status: string) => home.stopped[status as keyof typeof home.stopped] as string | undefined;

  return (
    <>
      <HostTodayView
        today={today}
        t={t}
        locale={locale}
        figure={figure}
        dashboard={dashboard}
        sub={
          businesses.length === 0
            ? t.hostWorkspace.nothingYet.home
            : home.onAccount.replace("{businesses}", countOf(businesses.length, "businesses", locale))
        }
        action={
          /* A HOST WHO HAS NOT STARTED IS ASKED WHAT THEY ARE, NOT ASKED TO
             FILL IN A FORM. `/host/start` draws the three stays doors of
             GOVERNING-09; a host with an application already open goes
             straight back to it, because the question has been answered. */
          <ButtonLink href={open ? "/host/apply" : "/profile/setup?side=stays"} variant="primary">
            {open ? t.hostWorkspace.doors.continueApplication : t.hostWorkspace.doors.startApplication}
          </ButtonLink>
        }
      />

      <Stack>
        {/*
          CLEAN SPACES (the unify recommendations, 7 October): the desk is one
          band, one figure and one list above. The application in progress and
          the businesses on the account fold one tap deeper, each with its
          count, instead of stacking three more groups under the list.
        */}
        {open || businesses.length > 0 ? (
          <Unfold
            headingLevel={2}
            data-testid="host-more"
            className="mt-block"
            /* A business the review stopped opens with its reason and its
               Contact us showing; folded, the one thing the host must act
               on sat behind a closed row. */
            defaultValue={businesses.some((b) => stoppedMeans(b.status)) ? ["businesses"] : undefined}
            items={[
              ...(open
                ? [
                    {
                      id: "application",
                      icon: "document" as const,
                      title: open.status === "SUBMITTED" ? home.draftWithTeam : home.draftInProgress,
                      hint: open.name || home.yourBusiness,
                      content: (
                        <ListGroup bare>
                          <ListRow
                            href="/host/apply"
                            leading={
                              <IconPlate size="sm" tone="brand">
                                <UiIcon name="file-text" size={20} />
                              </IconPlate>
                            }
                            title={open.name || home.yourBusiness}
                            sub={
                              open.status === "SUBMITTED"
                                ? home.draftReadNext
                                : missing.length === 0
                                  ? home.draftReady
                                  : home.draftMissing.replace("{things}", countOf(missing.length, "things", locale))
                            }
                            status={
                              <StatusPill tone={toneForStatus(open.status ?? "DRAFT")}>
                                {statusWord(open.status ?? "DRAFT")}
                              </StatusPill>
                            }
                          />
                        </ListGroup>
                      ),
                    },
                  ]
                : []),
              ...(businesses.length > 0
                ? [
                    {
                      id: "businesses",
                      icon: "building-hotel" as const,
                      title: home.businessesTitle,
                      hint: countOf(businesses.length, "businesses", locale),
                      content: (
                          /* Unboxed: the fold is already the container, so the
                             businesses are rows on it with hairlines between
                             them, not a card inside the card (pass 3). */
                          <RowList inset={false}>
                            {businesses.map((business) => (
                              <Row key={business.id} className="flex-col items-stretch gap-xs py-md">
                                {/*
                                  THE NAME AND THE STATE DO NOT SHARE A LINE ON A PHONE.

                                  "The Harbour Kitchen" beside "Needs more from you" left
                                  about 120px for a business name, so the name broke in two
                                  and the pill sat across its second line. A grid rather
                                  than a flex row, because the two of them are a stack at
                                  390 and a pair from `sm` up, and that is a layout
                                  statement rather than a wrapping accident.
                                */}
                                <div className="grid gap-2xs sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-sm">
                                  <span className="min-w-0">
                                    <span className={`block ${TYPE.rowTitle}`}>{business.name}</span>
                                    <span className={`block ${TYPE.rowMeta}`}>
                                      {(business.verified ? home.tierVerified : home.tier).replace("{tier}", String(business.verificationTier))}
                                    </span>
                                  </span>
                                  <StatusPill
                                    tone={toneForStatus(business.status)}
                                    className="justify-self-start sm:justify-self-end"
                                  >
                                    {statusWord(business.status)}
                                  </StatusPill>
                                </div>
                                {stoppedMeans(business.status) ? (
                                  <div
                                    className="nf-panel nf-panel--card p-sm"
                                    role="status"
                                    data-testid="host-business-stopped"
                                  >
                                    <p className={TYPE.rowMeta}>{stoppedMeans(business.status)}</p>
                                    <p className={`${TYPE.rowMeta} mt-2xs whitespace-pre-wrap`}>
                                      {business.reviewNotes
                                        ? home.reviewerWrote.replace("{note}", business.reviewNotes)
                                        : home.noReason}
                                    </p>
                                    {/* `block w-fit`, not `inline-block`: the theme's `--spacing-block`
                                        makes Tailwind's `inline-block` also set `inline-size:
                                        var(--nf-gap-block)`, which drew "Contact us" in a 32px box
                                        (AccessScreen.tsx records the same collision). */}
                                    {/* A refused or sent-back application is edited and sent
                                        again on the same business, as on Airbnb and
                                        Booking.com, so the way in is right here. */}
                                    {(business.status === "REJECTED" || business.status === "MORE_INFO_REQUIRED") && (
                                      <Link
                                        href="/host/apply"
                                        className="nf-tap mt-2xs block w-fit whitespace-nowrap font-semibold text-[var(--nf-content-link)] underline-offset-4 hover:underline"
                                      >
                                        {t.hostWorkspace.doors.openApplication}
                                      </Link>
                                    )}
                                    <Link
                                      href="/contact?topic=verification"
                                      className="nf-tap mt-2xs block w-fit whitespace-nowrap text-[var(--nf-content-link)] underline-offset-4 hover:underline"
                                    >
                                      {home.contactUs}
                                    </Link>
                                  </div>
                                ) : (
                                  business.reviewNotes && (
                                    <p className={`${TYPE.rowMeta} whitespace-pre-wrap`}>{business.reviewNotes}</p>
                                  )
                                )}
                                {/*
                                  THE DOORS A VENUE OWNER NEEDS, and none of them existed.
                                  `private.notify_reservation` has pointed a business host at
                                  /host/reservations since M7 with no such route, and an
                                  owner's own photographs had nowhere to go at all.

                                  PHOTOGRAPHS ARE NOW DRAWN FOR A STAY AS WELL. The note here
                                  used to say a stay's photographs hang on its property and a
                                  link to a surface that cannot show what it saved is worse
                                  than no link, which was true while `accommodation_photos`
                                  had no writer anywhere in the application. /host/photos now
                                  serves both spines, so the door is honest on both.
                                */}
                                <div className="flex flex-wrap gap-inline">
                                  {business.kind === "restaurant" ? (
                                    <Link href="/host/reservations" className="nf-chip">
                                      {words.businessDoors.tables}
                                    </Link>
                                  ) : (
                                    /* ROOMS AND NIGHTS, for the same reason Tables exists on
                                       the other spine. `stays_search` treats a night with no
                                       `room_inventory` row as not offered, so a hotel with no
                                       rows cannot be found by anybody who types dates, and
                                       nothing in the application wrote or read that table
                                       until now. This is where a host sees how far ahead they
                                       are bookable and changes it. */
                                    <Link href={`/host/rooms?business=${business.id}`} className="nf-chip">
                                      {words.businessDoors.rooms}
                                    </Link>
                                  )}
                                  <Link href={`/host/photos?business=${business.id}`} className="nf-chip">
                                    {words.businessDoors.photos}
                                  </Link>
                                  {/* V-57: every charge a guest can be asked for at the door. */}
                                  {business.kind !== "restaurant" && (
                                    <Link href={`/host/arrival?business=${business.id}`} className="nf-chip">
                                      {words.businessDoors.arrival}
                                    </Link>
                                  )}
                                </div>
                              </Row>
                            ))}
                          </RowList>
                      ),
                    },
                  ]
                : []),
            ]}
          />
        ) : null}

        {!open && businesses.length === 0 && (
          <EmptyState
            icon="hotel"
            title={t.hostWorkspace.home.startTitle}
            body={t.hostWorkspace.home.startBody}
            action={
              /* ONE PRIMARY PER SCREEN (T-44). The band above already holds
                 the start door as the screen's primary, to the same
                 door, so this one is the quiet second way in. */
              <ButtonLink href="/profile/setup?side=stays" variant="secondary" size="lg">
                {t.hostWorkspace.doors.start}
              </ButtonLink>
            }
          />
        )}
      </Stack>
    </>
  );
}
