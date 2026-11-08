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

import { HOME, HOME_NEW, NOW, PEOPLE, PROFILE, ROOMS, ROOM_DETAIL, UNILAG } from "./fixtures";

/**
 * /preview/features/roommates?screen=<name>: Vallo Roommates' REAL screens
 * (the same components the routes render) with fictional rows, for visual
 * review before the database update is run. Dev only: `previewHarnessIsOpen`
 * refuses on Vercel and in production. Every person here is invented.
 *
 *   home, home-new, people, rooms, profile, listing, campus, safety, nysc
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
