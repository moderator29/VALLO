import { Suspense, type ReactNode } from "react";
import { sheetWordsOf } from "@/components/social/sheet-words";
import { getDictionary } from "@vallo/i18n";
import { AppShell } from "@/components/app/AppShell";
import { PageHeader } from "@/components/app/PageHeader";
import { ListingCard } from "@/components/app/ListingCard";
import { StayCard } from "@/components/app/stays/StayCard";
import { InspectionRows } from "@/components/app/inspections/InspectionRows";
import { KycStatus, type KycStatusView } from "@/components/verification/KycStatus";
import { SavedSearchBoard } from "@/components/app/saved-searches/SavedSearchBoard";
import { searchChipCopyOf } from "@/lib/saved/searches";
import { ModeratorApply } from "@/app/(app)/around/[slug]/ModeratorApply";
import { ModeratorNote, PlaceAbout, PlaceNotes } from "@/app/(app)/around/[slug]/PlacePanels";
import { ProposeAreaForm } from "@/app/(app)/around/new/ProposeAreaForm";
import { AreaRow, ProposalsAnswered, ProposalsWaiting } from "@/app/(app)/around/settings/PlaceRows";
import { TripSpine } from "@/components/app/plans/TripSpine";
import { BookingDetailCard } from "@/app/(app)/bookings/[bookingId]/BookingDetailCard";
import { ReviewForm } from "@/app/(app)/bookings/[bookingId]/review/ReviewForm";
import { AlreadyReviewedPanel, ReviewSubjectPanel } from "@/app/(app)/bookings/[bookingId]/review/ReviewPanels";
import { RentSummary } from "@/app/(app)/rent/pay/[inspectionId]/RentSummary";
import { PayPanel } from "@/app/(app)/rent/pay/[inspectionId]/PayPanel";
import { SavedBoard, type SavedBoardItem } from "@/app/(app)/saved/SavedBoard";
import { ThreadView } from "@/app/(app)/post/[id]/ThreadView";
import LoadingArea from "@/app/(app)/around/[slug]/loading";
import LoadingAroundManage from "@/app/(app)/around/manage/loading";
import LoadingProposeArea from "@/app/(app)/around/new/loading";
import LoadingAroundSettings from "@/app/(app)/around/settings/loading";
import LoadingBookings from "@/app/(app)/bookings/loading";
import LoadingReview from "@/app/(app)/bookings/[bookingId]/review/loading";
import LoadingVerification from "@/app/(app)/verification/loading";
import LoadingSaved from "@/app/(app)/saved/loading";
import LoadingSavedSearches from "@/app/(app)/saved/searches/loading";
import LoadingThread from "@/app/(app)/post/[id]/loading";
import LoadingNewStory from "@/app/(app)/stories/new/loading";
import LoadingStory from "@/app/(app)/stories/[id]/loading";
import { BOOKINGS, RESTAURANTS, SHELF, STAYS } from "../../f3/fixtures";
import { INSPECTION } from "../../f5/fixtures";
import { THREAD } from "../../f4/fixtures";
import { PlacePicker } from "@/components/social/PlacePicker";
import { CancelSheetFixture, DistrictChipsFixture, KycFlowFixture } from "./Client";
import {
  AREAS,
  MODERATORS,
  PICKER_OPEN,
  PICKER_TREE,
  PROPOSALS,
  RENT_VIEW,
  RENT_VIEW_LARGE,
  REVIEW,
  REVIEW_SUBJECT,
  SAVED_SEARCHES,
  STATES,
} from "./fixtures";

/**
 * `/preview/session-b/sweep-orphans?v=<view>`: the 23 routes no sweep group
 * owned (audit B3), drawn inside the real app shell, signed in, on fixture
 * props (rule R-G). Behind the preview gate in `../../layout.tsx`. Every
 * view renders the route's real components; nothing here restyles them. The
 * signed-in routes are also shot live as the QA member (ledger 13, orphans).
 */

const ROUTES: Record<string, string> = {
  place: "/around/yaba",
  "place-new": "/around/new",
  places: "/around/settings",
  bookings: "/bookings",
  booking: "/bookings/b",
  "booking-cancel": "/bookings",
  review: "/bookings/b/review",
  reviewed: "/bookings/b/review",
  kyc: "/verification",
  "kyc-status": "/verification",
  "rent-pay": "/rent/pay/i",
  saved: "/saved",
  "saved-searches": "/saved/searches",
  post: "/post/p",
  "inspection-rows": "/bookings",
  district: "/around/yaba",
  picker: "/around/settings",
};

const LOADING: Record<string, { route: string; view: () => ReactNode }> = {
  "loading-place": { route: "/around/yaba", view: () => <LoadingArea /> },
  "loading-manage": { route: "/around/manage", view: () => <LoadingAroundManage /> },
  "loading-place-new": { route: "/around/new", view: () => <LoadingProposeArea /> },
  "loading-places": { route: "/around/settings", view: () => <LoadingAroundSettings /> },
  "loading-bookings": { route: "/bookings", view: () => <LoadingBookings /> },
  "loading-review": { route: "/bookings/b/review", view: () => <LoadingReview /> },
  "loading-kyc": { route: "/verification", view: () => <LoadingVerification /> },
  "loading-saved": { route: "/saved", view: () => <LoadingSaved /> },
  "loading-saved-searches": { route: "/saved/searches", view: () => <LoadingSavedSearches /> },
  "loading-post": { route: "/post/p", view: () => <LoadingThread /> },
  "loading-story-new": { route: "/stories/new", view: () => <LoadingNewStory /> },
  "loading-story": { route: "/stories/s", view: () => <LoadingStory /> },
};

const KYC: Record<string, KycStatusView> = {
  pending: { state: "pending", submittedAt: "2026-09-20T09:00:00.000Z" },
  approved: { state: "approved" },
  rejected: {
    state: "rejected",
    reason: "The photo of the identity card is cut off along the bottom edge.",
    fix: "Photograph the whole card on a flat surface and send it again.",
  },
  more_info: {
    state: "more_info",
    request: "A utility bill from the last three months, showing the same address.",
    fix: "Send the bill through the steps below. Anything already approved stays approved.",
  },
  suspended: { state: "suspended", reason: "Two accounts were opened with the same document." },
};

function Frame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-2xl pb-4xl pt-md">
      <PageHeader title={title} fallback="/preview/session-b/sweep-orphans" />
      {children}
    </div>
  );
}

function View({ v, s }: { v: string; s?: string }) {
  const t = getDictionary("en");
  const locale = "en" as const;
  const loading = LOADING[v];
  if (loading) return <>{loading.view()}</>;

  switch (v) {
    case "place":
      return (
        <Frame title="Around Yaba">
          <PlaceNotes status="PROPOSED" slowMode={false} />
          <PlaceNotes status="PAUSED" slowMode={false} />
          <PlaceNotes status="ACTIVE" slowMode />
          <PlaceAbout area={AREAS[0]!} moderators={MODERATORS} locale={locale} />
          <PlaceAbout area={AREAS[1]!} moderators={[]} locale={locale} />
          <div className="mb-md">
            <ModeratorApply areaId={AREAS[0]!.id} areaName="Yaba" pendingApplication={false} />
          </div>
          <div className="mb-md">
            <ModeratorApply areaId={AREAS[0]!.id} areaName="Yaba" pendingApplication />
          </div>
          <ModeratorNote areaName="Yaba" />
        </Frame>
      );
    case "district":
      return (
        <Frame title="Around Yaba">
          <DistrictChipsFixture />
        </Frame>
      );
    case "picker":
      /* The place picker inside Lagos (`s=` a state code to open another):
         the back chip, the local governments, and two already open. */
      return (
        <Frame title={t.social.manage}>
          <PlacePicker
            tree={PICKER_TREE}
            open={PICKER_OPEN}
            signedIn
            initialStateCode={s === "none" ? null : (s ?? "LA")}
          />
        </Frame>
      );
    case "place-new":
      return (
        <Frame title="Suggest a place">
          <ProposeAreaForm states={STATES} signedIn={s !== "out"} />
        </Frame>
      );
    case "places":
      return (
        <Frame title={t.social.manage}>
          <ProposalsWaiting proposals={PROPOSALS.filter((p) => p.status === "PROPOSED")} />
          <ProposalsAnswered proposals={PROPOSALS.filter((p) => p.status === "REJECTED")} />
          <ul className="flex flex-col gap-xs">
            <AreaRow area={AREAS[0]!} joined signedIn locale={locale} />
            <AreaRow area={AREAS[1]!} joined={false} signedIn locale={locale} />
            <AreaRow area={AREAS[2]!} joined={false} signedIn locale={locale} />
          </ul>
        </Frame>
      );
    case "bookings":
      return (
        <Frame title={t.shape.plans.title}>
          <TripSpine bookings={BOOKINGS} today="2026-09-24" locale={locale} />
        </Frame>
      );
    case "booking":
      return (
        <Frame title={t.nav.bookings}>
          <div className="grid gap-md">
            {BOOKINGS.slice(0, 3).map((booking) => (
              <BookingDetailCard key={booking.id} booking={booking} locale={locale} />
            ))}
          </div>
        </Frame>
      );
    case "booking-cancel":
      return (
        <Frame title={t.nav.bookings}>
          <CancelSheetFixture booking={BOOKINGS[0]!} words={t.memberFlows.cancelBooking} />
        </Frame>
      );
    case "review":
      return (
        <Frame title="Review your stay">
          <ReviewSubjectPanel words={t.memberFlows.review} subject={REVIEW_SUBJECT} />
          <div className="mt-block">
            <ReviewForm words={t.memberFlows.review} subject={REVIEW_SUBJECT} plansAction={{ label: t.shape.plans.seeStays, href: "/bookings?side=stays&from=stays" }} />
          </div>
        </Frame>
      );
    case "reviewed":
      return (
        <Frame title="Review your stay">
          <AlreadyReviewedPanel words={t.memberFlows.review} subject={REVIEW_SUBJECT} review={REVIEW} />
        </Frame>
      );
    case "kyc":
      return (
        <Frame title="Verification">
          <KycFlowFixture copy={t.experienceAccount.kyc} />
        </Frame>
      );
    case "kyc-status":
      return (
        <Frame title="Verification">
          <KycStatus status={KYC[s ?? "rejected"] ?? KYC.rejected!} locale={locale} />
        </Frame>
      );
    case "rent-pay":
      return (
        <Frame title="Pay the rent">
          <RentSummary view={s === "large" ? RENT_VIEW_LARGE : RENT_VIEW} />
          <div className="mt-lg">
            <PayPanel
              view={
                s === "large"
                    ? RENT_VIEW_LARGE
                    : RENT_VIEW
              }
              payCopy={getDictionary(locale).afterTheGate.pay}
            />
          </div>
        </Frame>
      );
    case "saved": {
      const stay = STAYS[0]!;
      const table = RESTAURANTS[0]!;
      const items: SavedBoardItem[] = [
        {
          id: stay.id,
          mode: "db",
          savedAt: 1_789_700_000,
          place: { kind: "accommodation", id: stay.id },
          card: (
            <StayCard
              stay={{ ...stay, place: { kind: "accommodation", id: stay.id } }}
              locale={locale}
              t={t}
              saved
              canSavePlaces
            />
          ),
        },
        {
          id: table.id,
          mode: "db",
          savedAt: 1_789_699_000,
          place: { kind: "restaurant", id: table.id },
          card: (
            <StayCard
              stay={{ ...table, place: { kind: "restaurant", id: table.id } }}
              locale={locale}
              t={t}
              saved
              canSavePlaces
            />
          ),
        },
        ...SHELF.slice(0, 2).map<SavedBoardItem>((listing, i) => ({
          id: listing.id,
          mode: "local",
          savedAt: 1_789_698_000 - i * 60,
          card: <ListingCard listing={listing} locale={locale} t={t} />,
        })),
      ];
      return (
        <div className="mx-auto max-w-3xl pb-4xl pt-md">
          <PageHeader title={t.nav.saved} fallback="/preview/session-b/sweep-orphans" />
          <SavedBoard items={items} />
        </div>
      );
    }
    case "saved-searches":
      return (
        <Frame title="Saved searches">
          <SavedSearchBoard initial={SAVED_SEARCHES} locale={locale} chipCopy={searchChipCopyOf(t.shape)} copy={t.experienceDiscover.saved.board} />
        </Frame>
      );
    case "post":
      return (
        <Frame title="Thread">
          <ThreadView thread={THREAD} signedIn openReply={false} sheet={sheetWordsOf(t)} />
        </Frame>
      );
    case "inspection-rows":
      return (
        <Frame title={t.nav.bookings}>
          <InspectionRows inspections={[INSPECTION, { ...INSPECTION, id: `${INSPECTION.id.slice(0, -1)}2`, state: "REQUESTED" }]} side="requester" locale={locale} viewingCopy={getDictionary(locale).threads.rental} flowCopy={getDictionary(locale).memberFlows.inspection} />
        </Frame>
      );
    default:
      return (
        <Frame title="Orphans sweep">
          <ul className="grid gap-xs">
            {[...Object.keys(ROUTES), ...Object.keys(LOADING)].map((key) => (
              <li key={key}>
                <a className="nf-link" href={`/preview/session-b/sweep-orphans?v=${key}`}>
                  {key}
                </a>
              </li>
            ))}
          </ul>
        </Frame>
      );
  }
}

export default async function SweepOrphansPreview({
  searchParams,
}: {
  searchParams: Promise<{ v?: string; s?: string }>;
}) {
  const { v = "index", s } = await searchParams;
  const route = ROUTES[v] ?? LOADING[v]?.route ?? "/home";
  return (
    <Suspense>
      <AppShell
        t={getDictionary("en")}
        userName="Seyi Omojuni"
        userHandle="seyifunmi"
        signedIn
        unreadNotifications={2}
        preview={{ route }}
      >
        <View v={v} s={s} />
      </AppShell>
    </Suspense>
  );
}
