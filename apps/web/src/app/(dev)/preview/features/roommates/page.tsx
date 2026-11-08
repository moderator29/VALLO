import { notFound } from "next/navigation";
import { getDictionary } from "@vallo/i18n";

import { CopyScope } from "@/lib/i18n/copy-scope";
import { copyScopeOf } from "@/lib/i18n/copy-scope-of";
import { EMPTY_PEOPLE_FILTERS, EMPTY_ROOM_FILTERS } from "@/lib/features/roommates/model";
import { previewHarnessIsOpen } from "@/lib/preview-harness";

import "@/app/(app)/roommates/roommates.css";
import { RoommatesHomeView } from "@/app/(app)/roommates/_parts/HomeView";
import { DiscoverView } from "@/app/(app)/roommates/discover/_parts/DiscoverView";
import { RoommateProfileScreen } from "@/app/(app)/roommates/p/[userId]/_parts/ProfileScreen";
import { RoomListingScreen } from "@/app/(app)/roommates/r/[id]/_parts/ListingScreen";
import { CampusView } from "@/app/(app)/roommates/campus/_parts/CampusViews";
import { SafetyView } from "@/app/(app)/roommates/safety/_parts/SafetyView";
import { NyscView } from "@/app/(app)/roommates/nysc/_parts/NyscView";
import { RoommatesHubView } from "@/app/(app)/roommates/me/_parts/HubView";
import { GroupDashboardView } from "@/app/(app)/roommates/groups/[id]/_parts/GroupDashboardView";
import { SplitCalculator } from "@/app/(app)/roommates/split/SplitCalculator";
import { ProfileFlowScreen } from "@/app/(app)/roommates/profile/_parts/ProfileFlowScreen";
import { PostFlowScreen } from "@/app/(app)/roommates/new/_parts/PostFlowScreen";
import { PageFrame } from "@/components/app/PageFrame";
import { Celebration } from "@/components/roommates/Celebrate";
import { FirstRunCard } from "@/components/roommates/FirstRunCard";
import { ButtonLink } from "@/components/ui/Button";
import { EMPTY_LISTING, EMPTY_PROFILE } from "@/lib/features/roommates/model";

import { GROUP, HOME, HOME_NEW, HUB, NOW, PEOPLE, PROFILE, ROOMS, ROOM_DETAIL, UNILAG } from "./fixtures";

/**
 * /preview/features/roommates?screen=<name>: Vallo Roommates' REAL screens
 * (the same components the routes render) with fictional rows, for visual
 * review before the database update is run. Dev only: `previewHarnessIsOpen`
 * refuses on Vercel and in production. Every person here is invented.
 *
 *   home, home-new, first-run, people, rooms, profile, listing, campus, safety,
 *   nysc, hub, hub-requests, group, split, onboarding, post, published
 */
export const dynamic = "force-dynamic";

export default async function PreviewRoommates({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (!previewHarnessIsOpen(process.env)) notFound();
  const screen = (await searchParams).screen ?? "home";
  const dict = getDictionary("en");
  const t = dict.roommates;

  let body: React.ReactNode;
  switch (screen) {
    case "home-new":
      body = <RoommatesHomeView home={HOME_NEW} t={t} now={NOW} />;
      break;
    case "people":
      body = (
        <DiscoverView
          t={t}
          result={{ mode: "people", state: "ok", items: PEOPLE, next: null }}
          people={EMPTY_PEOPLE_FILTERS}
          rooms={EMPTY_ROOM_FILTERS}
          schools={[UNILAG]}
          pages={1}
          now={NOW}
        />
      );
      break;
    case "rooms":
      body = (
        <DiscoverView
          t={t}
          result={{ mode: "rooms", state: "ok", items: ROOMS, next: null }}
          people={EMPTY_PEOPLE_FILTERS}
          rooms={EMPTY_ROOM_FILTERS}
          schools={[UNILAG]}
          pages={1}
          now={NOW}
        />
      );
      break;
    case "profile":
      body = <RoommateProfileScreen read={{ state: "ok", profile: PROFILE }} groups={[]} t={t} now={NOW} userId={PROFILE.userId} />;
      break;
    case "listing":
      body = <RoomListingScreen read={{ state: "ok", listing: ROOM_DETAIL, signedIn: true }} groups={[{ id: "g1", name: "UNILAG girls, 3 bed in Akoka" }]} t={t} now={NOW} />;
      break;
    case "campus":
      body = (
        <CampusView
          page={{ state: "ok", institution: { ...UNILAG, emailVerifyOn: true }, people: 214, roomsCount: 61, rooms: ROOMS.slice(0, 2), students: PEOPLE.slice(0, 2) }}
          t={t}
          now={NOW}
        />
      );
      break;
    case "safety":
      body = <SafetyView t={t} />;
      break;
    case "hub":
      body = <RoommatesHubView hub={HUB} tab="connections" now={NOW} />;
      break;
    case "hub-requests":
      body = <RoommatesHubView hub={HUB} tab="requests" now={NOW} />;
      break;
    case "group":
      body = <GroupDashboardView read={{ state: "ok", group: GROUP }} viewerId={GROUP.members[0]?.userId ?? null} now={NOW} />;
      break;
    case "split":
      body = (
        <PageFrame title={t.split.title} subtitle={t.split.intro} fallback="/roommates">
          <SplitCalculator initial={{ rentMinor: 180_000_000, period: "year", people: 3 }} groups={[{ id: GROUP.id, name: GROUP.name }]} />
        </PageFrame>
      );
      break;
    case "first-run":
      body = (
        <PageFrame title={t.title} fallback="/roommates" width="wide">
          <FirstRunCard href="/roommates/profile" />
        </PageFrame>
      );
      break;
    case "onboarding":
      body = <ProfileFlowScreen read={{ state: "ok", profile: EMPTY_PROFILE, exists: false, hasPhoto: false, name: "Kemi" }} schools={[UNILAG]} t={t} />;
      break;
    case "post":
      body = (
        <PostFlowScreen
          read={{ state: "ok", initial: { ...EMPTY_LISTING, kind: "room_offer" }, status: null, me: { userId: PROFILE.userId, name: "Kemi A.", avatarUrl: null } }}
          schools={[UNILAG]}
          t={t}
        />
      );
      break;
    case "published":
      body = (
        <Celebration
          testId="post-live"
          title={t.create.published}
          body={t.create.publishedBody.replace("{city}", "Lagos")}
          actions={
            <>
              <ButtonLink href="/roommates/r/x" variant="primary" size="lg" full arrow glow>
                {t.ui.create.publishedCta}
              </ButtonLink>
              <ButtonLink href="/roommates" variant="secondary" size="lg" full>
                {t.ui.create.backHome}
              </ButtonLink>
            </>
          }
        />
      );
      break;
    case "nysc":
      body = <NyscView t={t} />;
      break;
    default:
      body = <RoommatesHomeView home={HOME} t={t} now={NOW} />;
  }

  return (
    <CopyScope copy={copyScopeOf(dict, ["roommates"])}>
      {/* The app shell's 16px gutter, which the harness layout does not draw. */}
      <div className="px-md" data-testid={`preview-roommates-${screen}`}>
        {body}
      </div>
    </CopyScope>
  );
}
